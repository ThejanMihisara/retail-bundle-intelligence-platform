import calendar
import collections
import logging
from datetime import datetime, date, timedelta, time
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.transaction import SalesTransaction
from services.hybrid_forecast_predictor import predict_bundle

logger = logging.getLogger(__name__)


class ForecastService:
    def __init__(self):
        self.base_dir = Path(__file__).resolve().parent.parent
        self.models_dir = self.base_dir / "models" / "Future Forecast"
        self.tx_model_path = self.models_dir / "transaction_forecast_model.pkl"
        self.qty_model_path = self.models_dir / "quantity_forecast_model.pkl"
        
        self._tx_bundle = None
        self._qty_bundle = None
        self.loaded = False
        self._cache = {
            "transactions": {},
            "quantity_sold": {}
        }

    def load_models(self):
        if self.loaded:
            return

        # Check dependencies
        try:
            import joblib
            import pandas as pd
            import numpy as np
            import logging
            logging.getLogger("prophet.plot").setLevel(logging.CRITICAL)
            import prophet
            import sklearn
        except ImportError as e:
            logger.error(f"Missing required Python dependencies for forecasting: {e}")
            raise RuntimeError(f"Missing required Python dependencies for forecasting: {e}")

        # Check files existence
        if not self.tx_model_path.exists():
            logger.error(f"Missing model file: {self.tx_model_path}")
            raise FileNotFoundError(f"Missing model file: {self.tx_model_path}")
        if not self.qty_model_path.exists():
            logger.error(f"Missing model file: {self.qty_model_path}")
            raise FileNotFoundError(f"Missing model file: {self.qty_model_path}")

        # Load bundles
        try:
            self._tx_bundle = joblib.load(self.tx_model_path)
        except Exception as e:
            logger.error(f"Corrupted or invalid transaction model: {e}")
            raise ValueError(f"Corrupted or invalid transaction model: {e}")

        try:
            self._qty_bundle = joblib.load(self.qty_model_path)
        except Exception as e:
            logger.error(f"Corrupted or invalid quantity model: {e}")
            raise ValueError(f"Corrupted or invalid quantity model: {e}")

        # Validate bundles structure
        required_fields = [
            "artifact_version", "model_version", "target", "selected_model",
            "prophet_model", "gradient_boosting_model", "gradient_boosting_columns",
            "ensemble_weight", "history", "lags", "rolling_windows"
        ]

        for field in required_fields:
            if not isinstance(self._tx_bundle, dict) or field not in self._tx_bundle:
                raise ValueError(f"Transaction bundle is invalid: missing field '{field}'")
            if not isinstance(self._qty_bundle, dict) or field not in self._qty_bundle:
                raise ValueError(f"Quantity bundle is invalid: missing field '{field}'")

        if self._tx_bundle.get("target") != "transactions":
            raise ValueError(f"Transaction bundle target mismatch: expected 'transactions', got '{self._tx_bundle.get('target')}'")
        if self._qty_bundle.get("target") != "quantity_sold":
            raise ValueError(f"Quantity bundle target mismatch: expected 'quantity_sold', got '{self._qty_bundle.get('target')}'")

        self.loaded = True
        logger.info("Forecasting model bundles loaded successfully.")
        
        # Warm up forecast cache
        try:
            self.warmup_cache()
        except Exception as e:
            logger.error(f"Failed to warm up prediction cache: {e}")

    def warmup_cache(self):
        logger.info("Warming up prediction cache (2024-01-01 to 2026-12-31)...")
        self.get_cached_predictions("transactions", "2024-01-01", "2026-12-31")
        logger.info("Prediction cache warmed up successfully.")

    def get_cached_predictions(self, target: str, start_date_str: str, end_date_str: str) -> List[Dict[str, Any]]:
        start = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        end = datetime.strptime(end_date_str, "%Y-%m-%d").date()

        # Check if range is fully cached
        all_cached = True
        curr = start
        while curr <= end:
            if curr not in self._cache[target]:
                all_cached = False
                break
            curr += timedelta(days=1)

        if not all_cached:
            logger.info(f"Cache miss for {target} range: {start_date_str} to {end_date_str}. Generating...")
            dates = pd.date_range(start=start, end=end, freq='D')
            
            tx_df = predict_bundle(self._tx_bundle, dates)
            qty_df = predict_bundle(self._qty_bundle, dates)

            for i, dt in enumerate(dates):
                d = dt.date()
                pred_tx = int(tx_df.iloc[i]["prediction"])
                tx_l = int(tx_df.iloc[i]["lower"])
                tx_u = int(tx_df.iloc[i]["upper"])
                
                pred_qty = int(qty_df.iloc[i]["prediction"])
                qty_l = int(qty_df.iloc[i]["lower"])
                qty_u = int(qty_df.iloc[i]["upper"])

                self._cache["transactions"][d] = {
                    "predicted_transactions": pred_tx,
                    "transaction_lower": tx_l,
                    "transaction_upper": tx_u
                }
                self._cache["quantity_sold"][d] = {
                    "predicted_quantity_sold": pred_qty,
                    "quantity_lower": qty_l,
                    "quantity_upper": qty_u
                }

        results = []
        curr = start
        while curr <= end:
            d_str = curr.strftime("%Y-%m-%d")
            entry = {
                "forecast_date": d_str,
                "period_start": d_str,
                "period_end": d_str,
                "period_label": d_str,
                "day_of_week": curr.strftime("%A")
            }
            entry.update(self._cache["transactions"][curr])
            entry.update(self._cache["quantity_sold"][curr])
            results.append(entry)
            curr += timedelta(days=1)

        return results

    def check_ready(self):
        if not self.loaded:
            try:
                self.load_models()
            except Exception as e:
                logger.error(f"Lazy load of forecast models failed: {e}")
                raise HTTPException(
                    status_code=503,
                    detail=f"Forecast models not loaded or corrupted: {e}"
                )

    def run_future_forecast(self, db: Session, view: str = "daily", start_date: Optional[str] = None, end_date: Optional[str] = None, days: Optional[int] = None) -> List[Dict[str, Any]]:
        self.check_ready()

        default_start = date.today()

        # Parse inputs
        if start_date:
            try:
                requested_start = datetime.strptime(start_date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid start_date format: {start_date}")
            start = requested_start
        else:
            start = default_start

        if end_date:
            try:
                end = datetime.strptime(end_date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid end_date format: {end_date}")
        elif days is not None:
            end = start + timedelta(days=days - 1)
        else:
            # default to 30 days
            end = start + timedelta(days=29)

        if start > end:
            raise HTTPException(status_code=400, detail="Start date must be before or equal to end date.")

        daily_records = self.get_cached_predictions("transactions", start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))

        # Aggregate for response
        return self.aggregate_future_forecasts(daily_records, view)

    def aggregate_future_forecasts(self, daily_records: List[Dict[str, Any]], view: str) -> List[Dict[str, Any]]:
        if view == "daily":
            res = []
            for r in daily_records:
                d = r["forecast_date"]
                d_str = d.strftime("%Y-%m-%d") if isinstance(d, date) else d
                d_obj = d if isinstance(d, date) else datetime.strptime(d, "%Y-%m-%d").date()
                res.append({
                    "forecast_date": d_str,
                    "period_start": d_str,
                    "period_end": d_str,
                    "period_label": d_str,
                    "day_of_week": d_obj.strftime("%A"),
                    "predicted_transactions": int(r["predicted_transactions"]),
                    "transaction_lower": int(r["transaction_lower"]),
                    "transaction_upper": int(r["transaction_upper"]),
                    "predicted_quantity_sold": int(r["predicted_quantity_sold"]),
                    "quantity_lower": int(r["quantity_lower"]),
                    "quantity_upper": int(r["quantity_upper"])
                })
            return res

        elif view == "weekly":
            weeks = collections.defaultdict(list)
            for r in daily_records:
                d = r["forecast_date"]
                if isinstance(d, str):
                    d = datetime.strptime(d, "%Y-%m-%d").date()
                monday = d - timedelta(days=d.weekday())
                weeks[monday].append(r)

            weekly_res = []
            for monday, day_list in sorted(weeks.items()):
                day_list = sorted(day_list, key=lambda x: x["forecast_date"] if isinstance(x["forecast_date"], date) else datetime.strptime(x["forecast_date"], "%Y-%m-%d").date())
                p_start = day_list[0]["forecast_date"]
                if isinstance(p_start, date):
                    p_start = p_start.strftime("%Y-%m-%d")
                p_end = day_list[-1]["forecast_date"]
                if isinstance(p_end, date):
                    p_end = p_end.strftime("%Y-%m-%d")

                weekly_res.append({
                    "period_start": p_start,
                    "period_end": p_end,
                    "period_label": f"{p_start} to {p_end}",
                    "predicted_transactions": int(sum(d["predicted_transactions"] for d in day_list)),
                    "transaction_lower": int(sum(d["transaction_lower"] for d in day_list)),
                    "transaction_upper": int(sum(d["transaction_upper"] for d in day_list)),
                    "predicted_quantity_sold": int(sum(d["predicted_quantity_sold"] for d in day_list)),
                    "quantity_lower": int(sum(d["quantity_lower"] for d in day_list)),
                    "quantity_upper": int(sum(d["quantity_upper"] for d in day_list))
                })
            return weekly_res

        elif view == "monthly":
            months = collections.defaultdict(list)
            for r in daily_records:
                d = r["forecast_date"]
                if isinstance(d, str):
                    d = datetime.strptime(d, "%Y-%m-%d").date()
                month_key = (d.year, d.month)
                months[month_key].append(r)

            monthly_res = []
            for (year, month), day_list in sorted(months.items()):
                day_list = sorted(day_list, key=lambda x: x["forecast_date"] if isinstance(x["forecast_date"], date) else datetime.strptime(x["forecast_date"], "%Y-%m-%d").date())
                p_start = day_list[0]["forecast_date"]
                if isinstance(p_start, date):
                    p_start = p_start.strftime("%Y-%m-%d")
                p_end = day_list[-1]["forecast_date"]
                if isinstance(p_end, date):
                    p_end = p_end.strftime("%Y-%m-%d")

                first_date = datetime.strptime(p_start, "%Y-%m-%d").date()
                period_label = first_date.strftime("%B %Y")

                monthly_res.append({
                    "period_start": p_start,
                    "period_end": p_end,
                    "period_label": period_label,
                    "predicted_transactions": int(sum(d["predicted_transactions"] for d in day_list)),
                    "transaction_lower": int(sum(d["transaction_lower"] for d in day_list)),
                    "transaction_upper": int(sum(d["transaction_upper"] for d in day_list)),
                    "predicted_quantity_sold": int(sum(d["predicted_quantity_sold"] for d in day_list)),
                    "quantity_lower": int(sum(d["quantity_lower"] for d in day_list)),
                    "quantity_upper": int(sum(d["quantity_upper"] for d in day_list))
                })
            return monthly_res

        else:
            raise ValueError(f"Invalid view: {view}")

    def get_actual_vs_predicted(self, db: Session, start_date: date, end_date: date, view: str = "daily", target: str = "transactions") -> Dict[str, Any]:
        # 1. Run predictions for the entire requested range in real time
        try:
            predictions = self.run_future_forecast(
                db=db,
                view="daily",
                start_date=start_date.strftime("%Y-%m-%d"),
                end_date=end_date.strftime("%Y-%m-%d")
            )
        except Exception as e:
            logger.error(f"Failed to generate predictions in comparison: {e}")
            predictions = []

        if not predictions:
            return {
                "summary": {
                    "actual_total": 0,
                    "matched_predicted_total": 0,
                    "complete_period_predicted_total": 0,
                    "matched_dates": 0,
                    "prediction_only_dates": 0,
                    "actual_coverage_percentage": 0.0,
                    "average_forecast_error": 0.0,
                    "mape": 0.0,
                    "rmse": 0.0,
                    "forecast_bias": 0.0,
                    "forecast_accuracy": 100.0
                },
                "data": []
            }

        # 3. Query actual sales values from SalesTransaction
        actual_rows = db.query(
            func.date(SalesTransaction.sale_date).label("date_val"),
            func.count(func.distinct(SalesTransaction.invoice_id)).label("tx_count"),
            func.sum(SalesTransaction.quantity_sold).label("qty_sum")
        ).filter(
            SalesTransaction.sale_date >= datetime.combine(start_date, time.min),
            SalesTransaction.sale_date <= datetime.combine(end_date, time.max)
        ).group_by(func.date(SalesTransaction.sale_date)).all()

        # Map actual values to date
        actuals_map = {}
        for r in actual_rows:
            d = r.date_val
            if isinstance(d, str):
                d = datetime.strptime(d[:10], "%Y-%m-%d").date()
            elif isinstance(d, datetime):
                d = d.date()
            actuals_map[d] = (r.tx_count, r.qty_sum)

        # 4. Left join actual values onto in-memory predictions
        daily_comparison = []
        for pred in predictions:
            pred_date_str = pred["forecast_date"]
            pred_date = datetime.strptime(pred_date_str, "%Y-%m-%d").date()
            
            actual_val = None
            if pred_date in actuals_map:
                tx_c, qty_s = actuals_map[pred_date]
                actual_val = tx_c if target == "transactions" else qty_s
                if actual_val is not None:
                    actual_val = int(actual_val)

            predicted_val = pred["predicted_transactions"] if target == "transactions" else pred["predicted_quantity_sold"]
            
            error = None
            absolute_error = None
            error_percentage = None
            result = "Awaiting actual data"
            has_actual = False

            if actual_val is not None:
                has_actual = True
                error = int(predicted_val - actual_val)
                absolute_error = abs(error)
                if actual_val > 0:
                    error_percentage = round((absolute_error / actual_val * 100), 2)
                else:
                    error_percentage = 0.0

                if error > 0:
                    result = "Overpredicted"
                elif error < 0:
                    result = "Underpredicted"
                else:
                    result = "Accurate"

            daily_comparison.append({
                "date": pred_date_str,
                "period_start": pred_date_str,
                "period_end": pred_date_str,
                "period_label": pred_date_str,
                "predicted": int(predicted_val),
                "actual": actual_val,
                "error": error,
                "absolute_error": absolute_error,
                "error_percentage": error_percentage,
                "result": result,
                "has_actual": has_actual,
                "actual_coverage_days": 1 if has_actual else 0,
                "forecast_days": 1,
                "is_partial_actual_period": False,
                "calendar_days": 1,
                "is_partial_forecast_period": False
            })

        # Process view aggregation
        if view == "daily":
            comparison_rows = daily_comparison
        elif view == "weekly":
            weeks = collections.defaultdict(list)
            for r in daily_comparison:
                d = datetime.strptime(r["date"], "%Y-%m-%d").date()
                monday = d - timedelta(days=d.weekday())
                weeks[monday].append(r)

            weekly_comparison = []
            for monday, day_list in sorted(weeks.items()):
                day_list = sorted(day_list, key=lambda x: x["date"])
                p_start = day_list[0]["date"]
                p_end = day_list[-1]["date"]

                predicted_sum = sum(d["predicted"] for d in day_list)
                
                actual_sum = None
                actual_coverage_days = 0
                for d in day_list:
                    if d["actual"] is not None:
                        if actual_sum is None:
                            actual_sum = 0
                        actual_sum += d["actual"]
                        actual_coverage_days += 1

                forecast_days = len(day_list)
                has_actual = actual_coverage_days > 0
                is_partial_actual_period = has_actual and (actual_coverage_days < forecast_days)

                error = None
                absolute_error = None
                error_percentage = None
                result = "Awaiting actual data"

                if actual_sum is not None:
                    error = int(predicted_sum - actual_sum)
                    absolute_error = abs(error)
                    if actual_sum > 0:
                        error_percentage = round((absolute_error / actual_sum * 100), 2)
                    else:
                        error_percentage = 0.0

                    if error > 0:
                        result = "Overpredicted"
                    elif error < 0:
                        result = "Underpredicted"
                    else:
                        result = "Accurate"

                weekly_comparison.append({
                    "date": p_start,
                    "period_start": p_start,
                    "period_end": p_end,
                    "period_label": f"{p_start} to {p_end}",
                    "predicted": int(predicted_sum),
                    "actual": actual_sum,
                    "error": error,
                    "absolute_error": absolute_error,
                    "error_percentage": error_percentage,
                    "result": result,
                    "has_actual": has_actual,
                    "actual_coverage_days": actual_coverage_days,
                    "forecast_days": forecast_days,
                    "is_partial_actual_period": is_partial_actual_period,
                    "calendar_days": 7,
                    "is_partial_forecast_period": forecast_days < 7
                })
            comparison_rows = weekly_comparison

        elif view == "monthly":
            months_group = collections.defaultdict(list)
            for r in daily_comparison:
                d = datetime.strptime(r["date"], "%Y-%m-%d").date()
                month_key = (d.year, d.month)
                months_group[month_key].append(r)

            monthly_comparison = []
            for (year, month), day_list in sorted(months_group.items()):
                day_list = sorted(day_list, key=lambda x: x["date"])
                p_start = day_list[0]["date"]
                p_end = day_list[-1]["date"]

                first_date = datetime.strptime(p_start, "%Y-%m-%d").date()
                period_label = first_date.strftime("%B %Y")

                predicted_sum = sum(d["predicted"] for d in day_list)
                
                actual_sum = None
                actual_coverage_days = 0
                for d in day_list:
                    if d["actual"] is not None:
                        if actual_sum is None:
                            actual_sum = 0
                        actual_sum += d["actual"]
                        actual_coverage_days += 1

                forecast_days = len(day_list)
                has_actual = actual_coverage_days > 0
                is_partial_actual_period = has_actual and (actual_coverage_days < forecast_days)

                error = None
                absolute_error = None
                error_percentage = None
                result = "Awaiting actual data"

                if actual_sum is not None:
                    error = int(predicted_sum - actual_sum)
                    absolute_error = abs(error)
                    if actual_sum > 0:
                        error_percentage = round((absolute_error / actual_sum * 100), 2)
                    else:
                        error_percentage = 0.0

                    if error > 0:
                        result = "Overpredicted"
                    elif error < 0:
                        result = "Underpredicted"
                    else:
                        result = "Accurate"

                cal_days = calendar.monthrange(year, month)[1]
                is_partial_forecast = forecast_days < cal_days

                monthly_comparison.append({
                    "date": p_start,
                    "period_start": p_start,
                    "period_end": p_end,
                    "period_label": period_label,
                    "predicted": int(predicted_sum),
                    "actual": actual_sum,
                    "error": error,
                    "absolute_error": absolute_error,
                    "error_percentage": error_percentage,
                    "result": result,
                    "has_actual": has_actual,
                    "actual_coverage_days": actual_coverage_days,
                    "forecast_days": forecast_days,
                    "is_partial_actual_period": is_partial_actual_period,
                    "calendar_days": cal_days,
                    "is_partial_forecast_period": is_partial_forecast
                })
            comparison_rows = monthly_comparison
        else:
            raise ValueError(f"Invalid view: {view}")

        # Compute summary metrics ONLY from rows with actual values
        matched_rows = [r for r in comparison_rows if r["has_actual"]]
        
        actual_total = sum(r["actual"] for r in matched_rows) if matched_rows else 0
        matched_predicted_total = sum(r["predicted"] for r in matched_rows) if matched_rows else 0
        complete_period_predicted_total = sum(r["predicted"] for r in comparison_rows)
        
        matched_dates = sum(r["actual_coverage_days"] for r in comparison_rows)
        total_forecast_days = sum(r["forecast_days"] for r in comparison_rows)
        prediction_only_dates = total_forecast_days - matched_dates

        actual_coverage_percentage = round((matched_dates / total_forecast_days * 100), 2) if total_forecast_days > 0 else 0.0

        if matched_rows:
            mae = sum(abs(r["predicted"] - r["actual"]) for r in matched_rows) / len(matched_rows)
            
            mape_rows = [r for r in matched_rows if r["actual"] > 0]
            mape = (sum(abs(r["predicted"] - r["actual"]) / r["actual"] * 100 for r in mape_rows) / len(mape_rows)) if mape_rows else 0.0
            
            rmse = (sum((r["predicted"] - r["actual"]) ** 2 for r in matched_rows) / len(matched_rows)) ** 0.5
            
            bias = sum(r["predicted"] - r["actual"] for r in matched_rows) / len(matched_rows)
            
            forecast_accuracy = max(0.0, 100.0 - mape)
        else:
            mae = 0.0
            mape = 0.0
            rmse = 0.0
            bias = 0.0
            forecast_accuracy = 100.0

        summary = {
            "actual_total": int(actual_total),
            "matched_predicted_total": int(matched_predicted_total),
            "complete_period_predicted_total": int(complete_period_predicted_total),
            "matched_dates": int(matched_dates),
            "prediction_only_dates": int(prediction_only_dates),
            "actual_coverage_percentage": float(actual_coverage_percentage),
            "average_forecast_error": round(float(mae), 2),
            "mape": round(float(mape), 2),
            "rmse": round(float(rmse), 2),
            "forecast_bias": round(float(bias), 2),
            "forecast_accuracy": round(float(forecast_accuracy), 2)
        }

        return {
            "summary": summary,
            "data": comparison_rows
        }


forecast_service = ForecastService()
