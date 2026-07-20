"""
products.py — Product Movement router

Data source priority:
  1. If MySQL has uploaded transaction data → compute features from DB and run
     the pre-trained Random Forest model for live inference (real-time predictions).
  2. If MySQL is empty → serve the pre-computed training-era predictions CSV
     as a reference (these are clearly labeled as "pre-trained model reference").

This ensures the product movement page always reflects the most current data
without requiring retraining.
"""
import logging
import calendar
from datetime import datetime, date, timedelta
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models.transaction import SalesTransaction
from models.user import User
from services.inference_service import compute_product_features_from_db, run_rf_inference
from services.model_service import model_service
from services.product_movement_service import product_movement_service
from schemas.fast_slow import ProductMovementPredictionResponse
from utils.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/products/movement", tags=["product-movement"])



# ---------------------------------------------------------------------------
# Internal: get or build live predictions DataFrame
# ---------------------------------------------------------------------------

def _get_live_predictions(db: Session) -> pd.DataFrame | None:
    """
    Returns current monthly predictions from the same ProductMovementService
    used by the detailed /predict endpoint.
    """
    return product_movement_service.get_predictions(date.today().isoformat(), "month")


def _get_pretrained_df() -> pd.DataFrame:
    """Returns the pre-trained predictions CSV (training-era reference)."""
    df = model_service.rf_predictions
    if df is None:
        return pd.DataFrame(columns=[
            "product_id", "product_name", "category",
            "total_quantity_sold", "quantity_sold", "total_revenue", "total_profit", "profit",
            "predicted_movement_level", "probability_fast_moving", "probability_medium_moving", "probability_slow_moving"
        ])
    return df


def _get_period_analysis_df() -> pd.DataFrame:
    model_service.load_models()
    df = model_service.rf_period_analysis
    if df is None:
        return pd.DataFrame(columns=[
            "period_type", "period_start", "period_label", "product_id", "product_name", "category",
            "quantity_sold", "total_revenue", "total_profit", "transaction_count", "active_days",
            "movement_level", "movement_rank", "period_movement_score", "quantity_share", "revenue_share",
            "profit_share", "period_growth_pct", "insight"
        ])
    return df


# ---------------------------------------------------------------------------
# Route handlers
# ---------------------------------------------------------------------------

@router.get("/model-info")
async def get_product_movement_model_info(_: User = Depends(get_current_user)):
    try:
        product_movement_service.check_ready()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Product movement model is not available: {exc}") from exc

    bundle = product_movement_service.bundle or {}
    return {
        "model_loaded": product_movement_service.bundle is not None,
        "predictions_loaded": product_movement_service.bundle is not None,
        "period_analysis_loaded": bool(bundle.get("supported_period_types")),
        "training_summary_loaded": bool(bundle.get("test_metrics")),
        "model_name": "Random Forest",
        "model_version": bundle.get("model_version"),
        "training_start_date": bundle.get("training_start_date"),
        "training_end_date": bundle.get("training_end_date"),
    }

def _format_row(row: pd.Series) -> dict:
    return {
        "product_id": str(row.get("product_id", "")),
        "product_name": str(row.get("product_name", "")),
        "category": str(row.get("category", "")),
        "quantity_sold": int(row.get("total_quantity_sold", row.get("quantity_sold", 0))),
        "revenue": float(row.get("total_revenue", 0.0)),
        "profit": float(row.get("total_profit", row.get("profit", 0.0))),
        "movement_level": str(row.get("predicted_movement_level", row.get("movement_level", "Unknown"))),
        "probabilities": {
            "fast": float(row.get("probability_fast_moving", 0.0)),
            "medium": float(row.get("probability_medium_moving", 0.0)),
            "slow": float(row.get("probability_slow_moving", 0.0)),
        },
    }


def _format_period_row(row: pd.Series) -> dict:
    return {
        "period_type": str(row.get("period_type", "")),
        "period_start": str(row.get("period_start", "")),
        "period_label": str(row.get("period_label", "")),
        "product_id": str(row.get("product_id", "")),
        "product_name": str(row.get("product_name", "")),
        "category": str(row.get("category", "")),
        "quantity_sold": int(row.get("quantity_sold", 0)),
        "revenue": float(row.get("total_revenue", 0.0)),
        "profit": float(row.get("total_profit", 0.0)),
        "transaction_count": int(row.get("transaction_count", 0)),
        "active_days": int(row.get("active_days", 0)),
        "movement_level": str(row.get("movement_level", "Unknown")),
        "movement_rank": int(row.get("movement_rank", 0)),
        "movement_score": float(row.get("period_movement_score", 0.0)),
        "quantity_share": float(row.get("quantity_share", 0.0)),
        "revenue_share": float(row.get("revenue_share", 0.0)),
        "profit_share": float(row.get("profit_share", 0.0)),
        "growth_pct": float(row.get("period_growth_pct", 0.0)),
        "insight": str(row.get("insight", "")),
    }


@router.get("")
async def get_all_movement(
    page: int = 1,
    limit: int = 50,
    level: Optional[str] = None,
    search: Optional[str] = None,
    category: Optional[str] = None,
    sort_by: str = "total_revenue",
    sort_desc: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    df = _get_live_predictions(db)

    filtered_df = df.copy()

    if level:
        level_str = level.strip().title()
        if "moving" not in level_str.lower():
            level_str = f"{level_str} Moving"
        filtered_df = filtered_df[
            filtered_df["predicted_movement_level"].str.lower() == level_str.lower()
        ]

    if search:
        sl = search.lower()
        filtered_df = filtered_df[
            filtered_df["product_name"].str.lower().str.contains(sl, na=False)
            | filtered_df["category"].str.lower().str.contains(sl, na=False)
        ]

    if category:
        filtered_df = filtered_df[filtered_df["category"].str.lower() == category.lower()]

    # Sort
    if sort_by in filtered_df.columns:
        filtered_df = filtered_df.sort_values(sort_by, ascending=not sort_desc)
    elif "product_name" in filtered_df.columns:
        filtered_df = filtered_df.sort_values("product_name", ascending=not sort_desc)

    total_records = len(filtered_df)
    start = (page - 1) * limit
    paginated = filtered_df.iloc[start : start + limit]

    return {
        "total": total_records,
        "page": page,
        "limit": limit,
        "data": [_format_row(row) for _, row in paginated.iterrows()],
    }


@router.get("/summary")
async def get_movement_summary(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    df = _get_live_predictions(db)

    level_counts = df["predicted_movement_level"].value_counts()
    fast_count = int(level_counts.get("Fast Moving", 0))
    medium_count = int(level_counts.get("Medium Moving", 0))
    slow_count = int(level_counts.get("Slow Moving", 0))

    rev_col = "total_revenue" if "total_revenue" in df.columns else "revenue"
    prof_col = "total_profit" if "total_profit" in df.columns else "profit"
    qty_col = "total_quantity_sold" if "total_quantity_sold" in df.columns else "quantity_sold"

    total_rev = float(df[rev_col].sum())
    total_prof = float(df[prof_col].sum())
    total_qty = float(df[qty_col].sum())
    n = max(len(df), 1)

    return {
        "total_products": len(df),
        "fast_moving_count": fast_count,
        "medium_moving_count": medium_count,
        "slow_moving_count": slow_count,
        "avg_revenue": round(total_rev / n, 2),
        "avg_profit": round(total_prof / n, 2),
        "total_revenue": round(total_rev, 2),
        "total_profit": round(total_prof, 2),
        "total_quantity_sold": int(total_qty),
    }


@router.get("/period-analysis")
async def get_movement_period_analysis(
    period_type: str = Query("month", pattern="^(month|week)$"),
    period_label: Optional[str] = None,
    level: Optional[str] = None,
    page: int = 1,
    limit: int = 12,
    search: Optional[str] = None,
    category: Optional[str] = None,
    _: User = Depends(get_current_user),
):
    df = _get_period_analysis_df().copy()
    filtered_df = df[df["period_type"].str.lower() == period_type.lower()].copy()

    if period_label:
        filtered_df = filtered_df[filtered_df["period_label"].astype(str) == period_label]

    if level and level.lower() != "all":
        level_str = level.strip().title()
        if "moving" not in level_str.lower():
            level_str = f"{level_str} Moving"
        filtered_df = filtered_df[filtered_df["movement_level"].str.lower() == level_str.lower()]

    if category:
        filtered_df = filtered_df[filtered_df["category"].str.lower().str.contains(category.lower(), na=False)]

    if search:
        search_lower = search.lower()
        filtered_df = filtered_df[
            filtered_df["product_name"].str.lower().str.contains(search_lower, na=False)
            | filtered_df["category"].str.lower().str.contains(search_lower, na=False)
            | filtered_df["product_id"].astype(str).str.contains(search_lower, na=False)
        ]

    periods = (
        df[df["period_type"].str.lower() == period_type.lower()]["period_label"]
        .dropna()
        .astype(str)
        .drop_duplicates()
        .sort_values()
        .tolist()
    )

    filtered_df = filtered_df.sort_values(["period_start", "movement_rank"], ascending=[False, True])
    total_records = len(filtered_df)
    paginated = filtered_df.iloc[(page - 1) * limit:(page - 1) * limit + limit]

    summary = {}
    if not filtered_df.empty:
        counts = filtered_df["movement_level"].value_counts()
        summary = {
            "period_type": period_type,
            "selected_period": period_label or "All",
            "period_count": int(filtered_df["period_label"].nunique()),
            "fast_count": int(counts.get("Fast Moving", 0)),
            "medium_count": int(counts.get("Medium Moving", 0)),
            "slow_count": int(counts.get("Slow Moving", 0)),
            "total_quantity": int(filtered_df["quantity_sold"].sum()),
            "total_revenue": round(float(filtered_df["total_revenue"].sum()), 2),
            "total_profit": round(float(filtered_df["total_profit"].sum()), 2),
            "avg_growth_pct": round(float(filtered_df["period_growth_pct"].mean()), 2),
        }

    return {
        "total": total_records,
        "page": page,
        "limit": limit,
        "periods": periods,
        "summary": summary,
        "data": [_format_period_row(row) for _, row in paginated.iterrows()],
    }


@router.get("/fast")
async def get_fast_movement(page: int = 1, limit: int = 50, search: Optional[str] = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return await get_all_movement(page=page, limit=limit, level="Fast Moving", search=search, db=db, _=_)


@router.get("/medium")
async def get_medium_movement(page: int = 1, limit: int = 50, search: Optional[str] = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return await get_all_movement(page=page, limit=limit, level="Medium Moving", search=search, db=db, _=_)


@router.get("/slow")
async def get_slow_movement(page: int = 1, limit: int = 50, search: Optional[str] = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return await get_all_movement(page=page, limit=limit, level="Slow Moving", search=search, db=db, _=_)


    return [_format_row(row) for _, row in match.iterrows()]


def get_period_dates_and_label(selected_date: date, period_type: str):
    if period_type == "day":
        period_start = selected_date
        period_end = selected_date
        period_label = f"{selected_date.day} {selected_date.strftime('%B %Y')}"
    elif period_type == "week":
        start_offset = selected_date.weekday()
        period_start = selected_date - timedelta(days=start_offset)
        period_end = period_start + timedelta(days=6)
        period_label = f"{period_start.day} {period_start.strftime('%B %Y')} to {period_end.day} {period_end.strftime('%B %Y')}"
    elif period_type == "month":
        period_start = selected_date.replace(day=1)
        _, last_day = calendar.monthrange(selected_date.year, selected_date.month)
        period_end = selected_date.replace(day=last_day)
        period_label = selected_date.strftime("%B %Y")
    else:
        raise ValueError("period_type must be day, week, or month")
    return period_start, period_end, period_label


def get_custom_period_label(period_start: date, period_end: date, period_type: str):
    if period_start == period_end:
        return f"{period_start.day} {period_start.strftime('%B %Y')}"
    if period_type == "month":
        return f"{period_start.strftime('%d %B %Y')} to {period_end.strftime('%d %B %Y')}"
    return f"{period_start.day} {period_start.strftime('%B %Y')} to {period_end.day} {period_end.strftime('%B %Y')}"


def format_prediction_row(row, period_end):
    return {
        "product_id": str(row["product_id"]),
        "product_name": str(row["product_name"]),
        "category": str(row["category"]),
        "period_type": str(row["period_type"]),
        "period_start": row["period_start"],
        "period_end": period_end,
        "movement_level": str(row["predicted_movement_level"]),
        "movement_confidence": float(row["movement_confidence"]),
        "probability_fast_moving": float(row["probability_fast_moving"]),
        "probability_medium_moving": float(row["probability_medium_moving"]),
        "probability_slow_moving": float(row["probability_slow_moving"]),
        "probabilities": {
            "fast": float(row["probability_fast_moving"]),
            "medium": float(row["probability_medium_moving"]),
            "slow": float(row["probability_slow_moving"]),
        },
        "expected_quantity": int(row["expected_quantity"]),
        "expected_revenue": float(row["expected_revenue"]),
        "expected_profit": float(row["expected_profit"]),
        "quantity_sold": int(row["quantity_sold"]),
        "revenue": float(row["revenue"]),
        "profit": float(row["profit"]),
        "overall_quantity": int(row["overall_quantity"]),
        "overall_transactions": int(row["overall_transactions"]),
        "seasonal_month_mean_quantity": float(row["seasonal_month_mean_quantity"]) if pd.notna(row["seasonal_month_mean_quantity"]) else None,
        "is_known_product": bool(row["is_known_product"]),
    }


@router.get("/predict", response_model=ProductMovementPredictionResponse)
async def predict_movement(
    period_type: str = Query("month", pattern="^(day|week|month)$"),
    selected_date: str = Query("2026-01-15"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    movement_level: Optional[str] = "all",
    category: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(15, ge=1),
    sort_by: Optional[str] = "expected_revenue",
    sort_desc: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    try:
        dt = datetime.strptime(selected_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")

    period_start, period_end, period_label = get_period_dates_and_label(dt, period_type)

    if start_date or end_date:
        if period_type == "day":
            raise HTTPException(status_code=400, detail="Date range is only supported for weekly and monthly predictions.")
        if not start_date or not end_date:
            raise HTTPException(status_code=400, detail="Both start_date and end_date are required for a date range.")
        try:
            custom_start = datetime.strptime(start_date, "%Y-%m-%d").date()
            custom_end = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date range format. Expected YYYY-MM-DD.")
        if custom_start > custom_end:
            raise HTTPException(status_code=400, detail="start_date must be on or before end_date.")
        period_start = custom_start
        period_end = custom_end
        period_label = get_custom_period_label(period_start, period_end, period_type)

    df_raw = product_movement_service.get_predictions(selected_date, period_type)
    
    df = df_raw.copy()
    
    if period_type == "month":
        expected_qty = df["seasonal_month_mean_quantity"].fillna(0).round().astype(int)
    else:
        expected_qty = df["profile_mean_quantity"].fillna(0).round().astype(int)

    df["expected_quantity"] = expected_qty
    df["expected_revenue"] = (expected_qty * df["average_unit_price"].fillna(0)).round(2)
    df["expected_profit"] = (df["expected_revenue"] * df["overall_profit_margin"].fillna(0)).round(2)

    df["quantity_sold"] = df["expected_quantity"]
    df["revenue"] = df["expected_revenue"]
    df["profit"] = df["expected_profit"]
    df["is_known_product"] = True
    
    try:
        db_products = db.query(
            SalesTransaction.product_id,
            SalesTransaction.product_name,
            SalesTransaction.category
        ).group_by(
            SalesTransaction.product_id,
            SalesTransaction.product_name,
            SalesTransaction.category
        ).all()
    except Exception as e:
        logger.error(f"Error querying database products: {e}")
        db_products = []
        
    known_ids = set(df["product_id"].astype(str))
    unknown_rows = []
    for pid, pname, pcat in db_products:
        if str(pid) not in known_ids:
            unknown_rows.append({
                "period_start": period_start,
                "period_type": period_type,
                "product_id": str(pid),
                "product_name": pname,
                "category": pcat,
                "overall_quantity": 0,
                "overall_transactions": 0,
                "overall_daily_quantity_rate": 0.0,
                "profile_mean_quantity": 0.0,
                "seasonal_month_mean_quantity": 0.0,
                "average_unit_price": 0.0,
                "overall_profit_margin": 0.0,
                "predicted_movement_level": "Unknown",
                "probability_fast_moving": 0.0,
                "probability_medium_moving": 0.0,
                "probability_slow_moving": 0.0,
                "movement_confidence": 0.0,
                "movement_score": 0.0,
                "expected_quantity": 0,
                "expected_revenue": 0.0,
                "expected_profit": 0.0,
                "quantity_sold": 0,
                "revenue": 0.0,
                "profit": 0.0,
                "is_known_product": False
            })
            
    if unknown_rows:
        df_unknown = pd.DataFrame(unknown_rows)
        df = pd.concat([df, df_unknown], ignore_index=True)
        
    df["period_start"] = period_start

    df_filtered = df.copy()
    if category and category.lower() != "all" and category.lower() != "all categories":
        df_filtered = df_filtered[df_filtered["category"].str.lower() == category.lower()]
        
    if search:
        sl = search.lower()
        df_filtered = df_filtered[
            df_filtered["product_name"].str.lower().str.contains(sl, na=False) |
            df_filtered["product_id"].astype(str).str.contains(sl, na=False) |
            df_filtered["category"].str.lower().str.contains(sl, na=False)
        ]

    known_filtered = df_filtered[df_filtered["is_known_product"]]
    top_fast_df = known_filtered.sort_values("probability_fast_moving", ascending=False).head(5)
    top_slow_df = known_filtered.sort_values("probability_slow_moving", ascending=False).head(5)

    top_fast_products = []
    for _, r in top_fast_df.iterrows():
        top_fast_products.append({
            "product_id": str(r["product_id"]),
            "product_name": str(r["product_name"]),
            "category": str(r["category"]),
            "movement_level": str(r["predicted_movement_level"]),
            "movement_confidence": float(r["movement_confidence"]),
            "expected_quantity": int(r["expected_quantity"]),
        })

    top_slow_products = []
    for _, r in top_slow_df.iterrows():
        top_slow_products.append({
            "product_id": str(r["product_id"]),
            "product_name": str(r["product_name"]),
            "category": str(r["category"]),
            "movement_level": str(r["predicted_movement_level"]),
            "movement_confidence": float(r["movement_confidence"]),
            "expected_quantity": int(r["expected_quantity"]),
        })

    df_fully_filtered = df_filtered.copy()
    if movement_level and movement_level.lower() != "all" and movement_level.lower() != "all movement":
        ml_lower = movement_level.lower()
        if "fast" in ml_lower:
            target = "Fast Moving"
        elif "medium" in ml_lower:
            target = "Medium Moving"
        elif "slow" in ml_lower:
            target = "Slow Moving"
        elif "unknown" in ml_lower:
            target = "Unknown"
        else:
            target = movement_level
        df_fully_filtered = df_fully_filtered[df_fully_filtered["predicted_movement_level"].str.lower() == target.lower()]

    total_products = len(df_fully_filtered)
    fast_count = int((df_fully_filtered["predicted_movement_level"] == "Fast Moving").sum())
    medium_count = int((df_fully_filtered["predicted_movement_level"] == "Medium Moving").sum())
    slow_count = int((df_fully_filtered["predicted_movement_level"] == "Slow Moving").sum())
    avg_confidence = float(df_fully_filtered["movement_confidence"].mean()) if total_products > 0 else 0.0

    summary = {
        "total_products": total_products,
        "fast_moving_count": fast_count,
        "medium_moving_count": medium_count,
        "slow_moving_count": slow_count,
        "average_confidence": round(avg_confidence, 2)
    }

    distribution = [
        {
            "movement_level": "Fast Moving",
            "count": fast_count,
            "percentage": round(fast_count / total_products * 100, 2) if total_products > 0 else 0.0
        },
        {
            "movement_level": "Medium Moving",
            "count": medium_count,
            "percentage": round(medium_count / total_products * 100, 2) if total_products > 0 else 0.0
        },
        {
            "movement_level": "Slow Moving",
            "count": slow_count,
            "percentage": round(slow_count / total_products * 100, 2) if total_products > 0 else 0.0
        }
    ]

    insights = []
    insights.append(f"For {period_label}, {fast_count} products are expected to be Fast Moving.")
    
    fast_subset = df_fully_filtered[df_fully_filtered["predicted_movement_level"] == "Fast Moving"]
    if not fast_subset.empty:
        top_fast_item = fast_subset.sort_values("movement_confidence", ascending=False).iloc[0]
        insights.append(f"{top_fast_item['product_name']} has the highest Fast Moving confidence.")
    else:
        insights.append("No products are expected to be Fast Moving for this selection.")
        
    slow_pct = round(slow_count / total_products * 100, 1) if total_products > 0 else 0.0
    insights.append(f"Approximately {slow_pct}% of products are expected to be Slow Moving.")
    
    insights.append(f"The average model confidence for the selected period is {round(avg_confidence * 100)}%.")
    
    if not fast_subset.empty:
        cat_counts = fast_subset["category"].value_counts()
        if not cat_counts.empty:
            insights.append(f"{cat_counts.index[0]} contains the highest number of expected Fast Moving products.")
        else:
            insights.append("No categories contain expected Fast Moving products.")
    else:
        insights.append("No categories contain expected Fast Moving products.")

    sort_column = "expected_revenue"
    if sort_by:
        mapping = {
            "product_name": "product_name",
            "category": "category",
            "movement_level": "predicted_movement_level",
            "movement_confidence": "movement_confidence",
            "movement_score": "movement_score",
            "probability_fast_moving": "probability_fast_moving",
            "probability_medium_moving": "probability_medium_moving",
            "probability_slow_moving": "probability_slow_moving",
            "expected_quantity": "expected_quantity",
            "quantity_sold": "expected_quantity",
            "expected_revenue": "expected_revenue",
            "revenue": "expected_revenue",
            "expected_profit": "expected_profit",
            "profit": "expected_profit",
            "overall_quantity": "overall_quantity",
            "overall_transactions": "overall_transactions",
        }
        sort_column = mapping.get(sort_by, sort_by)
        
    if sort_column in df_fully_filtered.columns:
        df_fully_filtered = df_fully_filtered.sort_values(sort_column, ascending=not sort_desc)

    start = (page - 1) * limit
    paginated = df_fully_filtered.iloc[start : start + limit]

    data = []
    for _, row in paginated.iterrows():
        data.append(format_prediction_row(row, period_end))

    model_info = {
        "model_name": "Random Forest",
        "model_version": product_movement_service.bundle["model_version"],
        "training_start_date": product_movement_service.bundle.get("training_start_date", "2024-01-01"),
        "training_end_date": product_movement_service.bundle.get("training_end_date", "2025-12-31"),
    }

    return {
        "filters": {
            "period_type": period_type,
            "selected_date": selected_date,
            "start_date": start_date,
            "end_date": end_date,
            "period_start": period_start,
            "period_end": period_end,
            "period_label": period_label,
            "movement_level": movement_level,
            "category": category,
            "search": search
        },
        "model": model_info,
        "summary": summary,
        "distribution": distribution,
        "top_fast_products": top_fast_products,
        "top_slow_products": top_slow_products,
        "insights": insights,
        "data": data,
        "total": total_products,
        "page": page,
        "limit": limit
    }

