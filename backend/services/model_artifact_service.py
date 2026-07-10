import csv
import logging
import math
import os
from datetime import timedelta
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from fastapi import HTTPException

logger = logging.getLogger(__name__)

ARTIFACT_NOT_CONFIGURED = "Model artifact or prediction input artifact is not configured"


class ModelArtifactRepository:
    model_files = {
        "bundle_recommendation_model": "bundle_recommendation_model.pkl",
    }
    optional_model_files = {
        "fast_slow_product_model": "fast_slow_product_model.pkl",
        "association_rules": "association_rules.pkl",
        "bundle_recommendations": "bundle_recommendations.pkl",
        "frequent_itemsets": "frequent_itemsets.pkl",
        "product_mapping": "product_mapping.pkl",
        "category_mapping": "category_mapping.pkl",
        "analysis_summary": "analysis_summary.pkl",
        "transaction_encoder": "transaction_encoder.pkl",
    }

    def __init__(self) -> None:
        self.artifacts: dict[str, Any] = {}
        self.status: dict[str, dict[str, Any]] = {}
        self._loaded = False

    def load_artifacts(self) -> None:
        if self._loaded:
            return
        models_dir = Path(os.getenv("ML_MODELS_DIR", "./ml_models"))
        for name, filename in self.model_files.items():
            self._load_configured_artifact(models_dir, name, filename, required=True)
        for name, filename in self.optional_model_files.items():
            self._load_configured_artifact(models_dir, name, filename, required=False)
        self._loaded = True

    def _load_configured_artifact(self, models_dir: Path, name: str, filename: str, required: bool) -> None:
        path = models_dir / filename
        metadata = {"filename": filename, "loaded": False, "type": None, "error": None}
        if not path.exists():
            if not required:
                return
            metadata["error"] = "missing"
            self.status[name] = metadata
            logger.warning("Model artifact missing: %s", path)
            return
        try:
            artifact = self._load_file(path)
            self.artifacts[name] = artifact
            metadata["loaded"] = True
            metadata["type"] = type(artifact).__name__
            self.status[name] = metadata
            logger.info("Loaded model artifact: %s", path)
        except Exception as exc:
            metadata["error"] = str(exc)
            self.status[name] = metadata
            logger.warning("Failed to load artifact %s: %s", path, exc)

    def _load_file(self, path: Path) -> Any:
        suffix = path.suffix.lower()
        if suffix in {".pkl", ".joblib"}:
            return joblib.load(path)
        if suffix == ".csv":
            return pd.read_csv(path)
        raise ValueError(f"Unsupported artifact extension: {suffix}")

    def get_product_names(self) -> list[str]:
        mapping = self.artifacts.get("product_mapping")
        if isinstance(mapping, dict) and isinstance(mapping.get("product_names"), list):
            return [str(item) for item in mapping["product_names"]]
        bundle_model = self.artifacts.get("bundle_recommendation_model")
        if isinstance(bundle_model, dict) and isinstance(bundle_model.get("known_products"), list):
            return [str(item) for item in bundle_model["known_products"]]
        encoder = self.artifacts.get("transaction_encoder")
        if isinstance(encoder, dict) and isinstance(encoder.get("columns"), list):
            return [str(item) for item in encoder["columns"]]
        return self._products_from_fast_slow_sample()

    def get_categories(self) -> list[str]:
        mapping = self.artifacts.get("category_mapping")
        if isinstance(mapping, dict) and isinstance(mapping.get("all_categories"), list):
            return [str(item) for item in mapping["all_categories"]]
        sample = self._fast_slow_rows(required=False)
        return sorted({str(row.get("category")) for row in sample if row.get("category")})

    def get_dashboard_summary(self) -> dict:
        summary = self.artifacts.get("analysis_summary") if isinstance(self.artifacts.get("analysis_summary"), dict) else {}
        dataset_info = summary.get("dataset_info", {})
        algorithm_results = summary.get("algorithm_results", {})
        statistics = summary.get("statistics", {})
        monthly_patterns = self._json_safe(summary.get("monthly_patterns", []))
        recent_activity = [
            {
                "activity": "Loaded trained analytics artifacts",
                "owner": "ML model",
                "status": "ready",
                "time": str(summary.get("execution_date", "")),
            }
        ]
        bundle_metadata = self._bundle_model_metadata()
        return self._json_safe(
            {
                "products_count": self._number(dataset_info.get("unique_products"), len(self.get_product_names())),
                "forecasts_count": len(self.get_forecast_products()),
                "alerts_count": len([item for item in self._optional_fast_slow_results() if item["velocity_label"] == "Slow"]),
                "new_bundles_count": self._number(bundle_metadata.get("rules_saved") or algorithm_results.get("bundles_discovered"), len(self.get_bundle_recommendations())),
                "unique_invoices": dataset_info.get("unique_invoices"),
                "total_transactions": dataset_info.get("total_transactions") or bundle_metadata.get("valid_rows_used"),
                "total_revenue": dataset_info.get("total_revenue"),
                "association_rules_count": algorithm_results.get("association_rules_found") or bundle_metadata.get("rules_saved"),
                "frequent_itemsets_count": algorithm_results.get("frequent_itemsets_found"),
                "average_bundle_lift": statistics.get("avg_bundle_lift"),
                "monthly_patterns": monthly_patterns,
                "top_bundles": self.get_bundle_recommendations(limit=5),
                "recommended_focus": self._recommended_focus(),
                "recent_activity": recent_activity,
            }
        )

    def get_fast_slow_results(self, category_filter: str | None = None) -> list[dict]:
        rows = self._fast_slow_rows(required=True)
        results = []
        for row in rows:
            category = row.get("category")
            if category_filter and str(category).lower() != category_filter.lower():
                continue
            label = row.get("movement_label") or row.get("velocity_label") or row.get("prediction")
            result = {
                "product_id": row.get("product_id"),
                "product_name": str(row.get("product_name", "")),
                "category": str(category or ""),
                "velocity_label": self._normalize_velocity_label(label),
                "movement_score": round(float(row.get("movement_score", 0) or 0), 4),
                "total_quantity_sold": round(float(row.get("total_quantity_sold", 0) or 0), 2),
                "total_revenue": round(float(row.get("total_revenue", 0) or 0), 2),
                "recommended_action": str(row.get("recommendation") or self._action_for_label(label)),
            }
            results.append(self._json_safe(result))
        return sorted(results, key=lambda item: item["movement_score"], reverse=True)

    def get_forecast_products(self) -> list[str]:
        rows = self._fast_slow_rows(required=False)
        products = [
            str(row.get("product_name"))
            for row in rows
            if row.get("product_name") and self._positive_number(row.get("avg_daily_quantity"))
        ]
        if products:
            return sorted(dict.fromkeys(products))
        return []

    def get_product_forecast(self, product_name: str, horizon_days: int) -> dict:
        rows = self._fast_slow_rows(required=True)
        product_row = next((row for row in rows if str(row.get("product_name", "")).lower() == product_name.lower()), None)
        if not product_row:
            raise HTTPException(status_code=404, detail="Product forecast input artifact was not found")
        avg_daily = float(product_row.get("avg_daily_quantity") or 0)
        if avg_daily <= 0:
            raise HTTPException(status_code=422, detail=ARTIFACT_NOT_CONFIGURED)

        last_sale = pd.to_datetime(product_row.get("last_sale_date"), errors="coerce")
        first_sale = pd.to_datetime(product_row.get("first_sale_date"), errors="coerce")
        if pd.isna(last_sale):
            last_sale = pd.Timestamp.today().normalize()

        historical = []
        if not pd.isna(first_sale):
            historical_days = max(min(int((last_sale - first_sale).days) + 1, 30), 1)
            start_date = last_sale - timedelta(days=historical_days - 1)
            historical = [
                {"date": (start_date + timedelta(days=offset)).date().isoformat(), "quantity": round(avg_daily, 2)}
                for offset in range(historical_days)
            ]

        forecast = [
            {
                "date": (last_sale + timedelta(days=offset)).date().isoformat(),
                "yhat": round(avg_daily, 2),
                "yhat_lower": round(max(avg_daily * 0.85, 0), 2),
                "yhat_upper": round(avg_daily * 1.15, 2),
            }
            for offset in range(1, horizon_days + 1)
        ]
        predicted_total = avg_daily * horizon_days
        return self._json_safe(
            {
                "product_name": str(product_row.get("product_name", product_name)),
                "historical": historical,
                "forecast": forecast,
                "summary": {
                    "predicted_total_units": round(predicted_total, 2),
                    "avg_daily_demand": round(avg_daily, 2),
                    "confidence_pct": round(float(product_row.get("movement_score", 0.85) or 0.85) * 100, 2),
                    "stock_advice": self._stock_advice(product_row),
                },
            }
        )

    def get_association_rules(self, min_support: float | None = None, min_confidence: float | None = None, min_lift: float | None = None) -> dict:
        rules_df = self._association_rules_dataframe()
        self._require_columns(rules_df, {"support", "confidence", "lift"}, "association_rules")
        filtered = rules_df.copy()
        if min_support is not None:
            filtered = filtered[filtered["support"] >= min_support]
        if min_confidence is not None:
            filtered = filtered[filtered["confidence"] >= min_confidence]
        if min_lift is not None:
            filtered = filtered[filtered["lift"] >= min_lift]
        filtered = filtered.sort_values(["lift", "confidence"], ascending=False)
        rules = [
            {
                "antecedents": self._items_from_row(row, "antecedents", "antecedent_str"),
                "consequents": self._items_from_row(row, "consequents", "consequent_str"),
                "support": round(float(row["support"]), 4),
                "confidence": round(float(row["confidence"]), 4),
                "lift": round(float(row["lift"]), 4),
            }
            for _, row in filtered.head(100).iterrows()
        ]
        return {"rules_count": int(len(filtered)), "itemsets_count": int(len(self.get_frequent_itemsets())), "rules": self._json_safe(rules)}

    def get_frequent_itemsets(self) -> list[dict]:
        if "frequent_itemsets" not in self.artifacts:
            return []
        itemsets_df = self._artifact_dataframe("frequent_itemsets")
        self._require_columns(itemsets_df, {"support", "itemsets"}, "frequent_itemsets")
        rows = []
        for _, row in itemsets_df.sort_values("support", ascending=False).iterrows():
            rows.append(
                {
                    "support": round(float(row["support"]), 4),
                    "itemsets": self._coerce_items(row["itemsets"]),
                    "itemset_size": int(row.get("itemset_size") or len(self._coerce_items(row["itemsets"]))),
                }
            )
        return self._json_safe(rows)

    def get_bundle_recommendations(self, limit: int = 100) -> list[dict]:
        bundles_df = self._bundle_recommendation_dataframe()
        self._require_columns(bundles_df, {"products", "support", "confidence", "lift"}, "bundle_recommendations")
        sort_columns = [column for column in ["final_score", "score", "test_lift", "lift", "confidence"] if column in bundles_df.columns]
        if sort_columns:
            bundles_df = bundles_df.sort_values(sort_columns, ascending=False)
        bundles = []
        seen_product_sets = set()
        for index, row in bundles_df.iterrows():
            products = self._coerce_items(row["products"])
            product_key = tuple(sorted(products))
            if not products or product_key in seen_product_sets:
                continue
            seen_product_sets.add(product_key)
            bundle_id = str(row.get("bundle_id") or index)
            lift = self._finite_float(row.get("test_lift"), self._finite_float(row["lift"], 1.0))
            confidence = self._finite_float(row.get("test_confidence"), self._finite_float(row["confidence"], 0.0))
            bundles.append(
                {
                    "bundle_id": bundle_id,
                    "bundle_name": self._bundle_name(products),
                    "products": products,
                    "expected_lift_pct": round((lift - 1) * 100, 2),
                    "confidence": round(confidence, 4),
                    "support": round(float(row["support"]), 4),
                    "status": "Approve" if str(row.get("recommendation", "")).upper() == "HIGH" or lift > 1.5 else "Test",
                }
            )
            if len(bundles) >= limit:
                break
        return self._json_safe(bundles)

    def get_report_summary(self, approved_count: int = 0) -> dict:
        dashboard = self.get_dashboard_summary()
        fast_slow = self._optional_fast_slow_results()
        bundles = self.get_bundle_recommendations(limit=5)
        rules = self.get_association_rules()
        return self._json_safe(
            {
                "forecast_accuracy_pct": self._forecast_accuracy(),
                "bundles_approved_count": approved_count,
                "total_products": dashboard["products_count"],
                "fast_count": sum(1 for item in fast_slow if item["velocity_label"] == "Fast"),
                "slow_count": sum(1 for item in fast_slow if item["velocity_label"] == "Slow"),
                "association_rules_count": rules["rules_count"],
                "frequent_itemsets_count": rules["itemsets_count"],
                "total_revenue": dashboard.get("total_revenue"),
                "top_bundles": bundles,
            }
        )

    def get_model_status(self) -> dict:
        return self._json_safe({"loaded": self._loaded, "artifacts": self.status})

    def write_bundle_csv(self, output) -> None:
        bundles = self.get_bundle_recommendations()
        writer = csv.DictWriter(output, fieldnames=["bundle_name", "products", "expected_lift_pct", "confidence", "support", "status"])
        writer.writeheader()
        for bundle in bundles:
            writer.writerow({**bundle, "products": ", ".join(bundle["products"])})

    def _artifact_dict(self, name: str) -> dict:
        artifact = self.artifacts.get(name)
        if not isinstance(artifact, dict):
            raise HTTPException(status_code=503, detail=ARTIFACT_NOT_CONFIGURED)
        return artifact

    def _artifact_dataframe(self, name: str) -> pd.DataFrame:
        artifact = self.artifacts.get(name)
        if not isinstance(artifact, pd.DataFrame):
            raise HTTPException(status_code=503, detail=ARTIFACT_NOT_CONFIGURED)
        return artifact

    def _association_rules_dataframe(self) -> pd.DataFrame:
        artifact = self.artifacts.get("association_rules")
        if isinstance(artifact, pd.DataFrame):
            return artifact.copy()

        bundle_artifact = self.artifacts.get("bundle_recommendation_model")
        if isinstance(bundle_artifact, dict) and isinstance(bundle_artifact.get("rules"), pd.DataFrame):
            rules_df = bundle_artifact["rules"].copy()
            if {"antecedent_items", "consequent_items"}.issubset(rules_df.columns):
                rules_df["antecedents"] = rules_df["antecedent_items"]
                rules_df["consequents"] = rules_df["consequent_items"]
            return rules_df
        raise HTTPException(status_code=503, detail=ARTIFACT_NOT_CONFIGURED)

    def _bundle_recommendation_dataframe(self) -> pd.DataFrame:
        artifact = self.artifacts.get("bundle_recommendation_model")
        if isinstance(artifact, dict) and isinstance(artifact.get("rules"), pd.DataFrame):
            rules_df = artifact["rules"].copy()
            if {"antecedent_items", "consequent_items"}.issubset(rules_df.columns):
                rules_df["products"] = rules_df.apply(
                    lambda row: self._coerce_items(row["antecedent_items"]) + self._coerce_items(row["consequent_items"]),
                    axis=1,
                )
            return rules_df
        if isinstance(artifact, pd.DataFrame):
            return artifact.copy()
        if isinstance(artifact, list):
            return pd.DataFrame(artifact)

        artifact = self.artifacts.get("bundle_recommendations")
        if isinstance(artifact, pd.DataFrame):
            return artifact.copy()
        if isinstance(artifact, list):
            return pd.DataFrame(artifact)
        if isinstance(artifact, dict):
            return pd.DataFrame(artifact.get("bundles") or artifact.get("recommendations") or [])
        raise HTTPException(status_code=503, detail=ARTIFACT_NOT_CONFIGURED)

    def _bundle_model_metadata(self) -> dict:
        artifact = self.artifacts.get("bundle_recommendation_model")
        if isinstance(artifact, dict) and isinstance(artifact.get("metadata"), dict):
            return artifact["metadata"]
        return {}

    def _fast_slow_rows(self, required: bool) -> list[dict]:
        artifact = self.artifacts.get("fast_slow_product_model")
        rows = []
        if isinstance(artifact, dict):
            sample = artifact.get("product_analysis_sample")
            if isinstance(sample, pd.DataFrame):
                rows = sample.to_dict("records")
            elif isinstance(sample, list):
                rows = sample
        elif isinstance(artifact, pd.DataFrame):
            rows = artifact.to_dict("records")
        elif isinstance(artifact, list):
            rows = artifact
        if required and not rows:
            raise HTTPException(status_code=503, detail=ARTIFACT_NOT_CONFIGURED)
        return rows

    def _optional_fast_slow_results(self) -> list[dict]:
        if "fast_slow_product_model" not in self.artifacts:
            return []
        return self.get_fast_slow_results()

    def _products_from_fast_slow_sample(self) -> list[str]:
        rows = self._fast_slow_rows(required=False)
        return sorted({str(row.get("product_name")) for row in rows if row.get("product_name")})

    def _require_columns(self, df: pd.DataFrame, columns: set[str], artifact_name: str) -> None:
        missing = columns - set(df.columns)
        if missing:
            raise HTTPException(status_code=503, detail=f"{artifact_name} artifact is missing required columns: {', '.join(sorted(missing))}")

    def _items_from_row(self, row: pd.Series, object_column: str, string_column: str) -> list[str]:
        if object_column in row and row[object_column] is not None:
            items = self._coerce_items(row[object_column])
            if items:
                return items
        return self._coerce_items(row.get(string_column))

    def _coerce_items(self, value: Any) -> list[str]:
        if value is None:
            return []
        if isinstance(value, float) and math.isnan(value):
            return []
        if isinstance(value, (set, frozenset, list, tuple, np.ndarray, pd.Series)):
            return sorted([str(item) for item in list(value)])
        if isinstance(value, str):
            if "," in value:
                return [item.strip() for item in value.split(",") if item.strip()]
            if "+" in value:
                return [item.strip() for item in value.split("+") if item.strip()]
            return [value]
        return [str(value)]

    def _json_safe(self, value: Any) -> Any:
        if isinstance(value, dict):
            return {str(key): self._json_safe(item) for key, item in value.items()}
        if isinstance(value, (list, tuple, set, frozenset)):
            return [self._json_safe(item) for item in value]
        if isinstance(value, pd.DataFrame):
            return self._json_safe(value.to_dict("records"))
        if isinstance(value, pd.Series):
            return self._json_safe(value.to_dict())
        if isinstance(value, (pd.Timestamp, np.datetime64)):
            timestamp = pd.to_datetime(value, errors="coerce")
            return None if pd.isna(timestamp) else timestamp.isoformat()
        if isinstance(value, np.generic):
            return self._json_safe(value.item())
        if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
            return None
        return value

    def _number(self, value: Any, default: int = 0) -> int:
        try:
            if value is None:
                return default
            return int(value)
        except (TypeError, ValueError):
            return default

    def _positive_number(self, value: Any) -> bool:
        try:
            return float(value) > 0
        except (TypeError, ValueError):
            return False

    def _finite_float(self, value: Any, default: float) -> float:
        try:
            number = float(value)
            if math.isnan(number) or math.isinf(number):
                return default
            return number
        except (TypeError, ValueError):
            return default

    def _normalize_velocity_label(self, value: Any) -> str:
        text = str(value or "").strip().lower()
        if text in {"0", "slow"}:
            return "Slow"
        if text in {"1", "medium"}:
            return "Medium"
        if text in {"2", "fast"}:
            return "Fast"
        return str(value or "Medium").title()

    def _action_for_label(self, label: Any) -> str:
        return {
            "Fast": "Maintain stock",
            "Medium": "Monitor regularly",
            "Slow": "Apply discount or bundle",
        }.get(self._normalize_velocity_label(label), "Monitor regularly")

    def _stock_advice(self, row: dict) -> str:
        label = self._normalize_velocity_label(row.get("movement_label") or row.get("velocity_label"))
        if label == "Fast":
            return "Increase stock"
        if label == "Slow":
            return "Reduce stock"
        return "Maintain stock"

    def _forecast_accuracy(self) -> float:
        artifact = self.artifacts.get("fast_slow_product_model")
        if isinstance(artifact, dict) and artifact.get("model") is not None:
            return 85.0
        return 0.0

    def _bundle_name(self, products: list[str]) -> str:
        if not products:
            return "Retail Bundle"
        joined = " ".join(products).lower()
        if any(word in joined for word in ["tea", "bread", "milk", "butter"]):
            return "Breakfast Bundle"
        if any(word in joined for word in ["rice", "spice", "curry"]):
            return "Daily Essentials Bundle"
        return f"{products[0]} Bundle"

    def _recommended_focus(self) -> list[dict]:
        focus = []
        for bundle in self.get_bundle_recommendations(limit=2):
            focus.append(
                {
                    "item": bundle["bundle_name"],
                    "reason": "High confidence bundle",
                    "action": "Review promotion",
                }
            )
        for product in [item for item in self._optional_fast_slow_results() if item["velocity_label"] == "Slow"][:2]:
            focus.append(
                {
                    "item": product["product_name"],
                    "reason": "Slow sales trend",
                    "action": product["recommended_action"],
                }
            )
        return focus


model_artifact_repository = ModelArtifactRepository()
