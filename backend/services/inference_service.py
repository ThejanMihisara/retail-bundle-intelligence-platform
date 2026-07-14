"""
inference_service.py
--------------------
Computes product-level features from uploaded sales transactions and runs them
through the pre-trained Random Forest model to produce live movement predictions.

Feature engineering must exactly match the training pipeline used to build
fast_medium_slow_random_forest_model.pkl.

Training features (from random_forest_feature_importance.csv):
  total_quantity_sold, high_demand_quantity, invoice_count,
  sales_frequency_per_day, active_days, active_months,
  avg_monthly_quantity, normal_month_quantity, std_monthly_quantity,
  max_monthly_quantity, total_revenue, high_demand_revenue,
  selling_period_days, category_* (one-hot), total_profit,
  normal_month_revenue, avg_quantity_per_line, avg_quantity_per_invoice,
  recency_days, normal_month_quantity_share, cost_price,
  avg_revenue_per_invoice, max_quantity_per_line, avg_profit_per_invoice,
  high_demand_quantity_share, retail_price, profit_margin, unit_profit,
  min_monthly_quantity
"""
import logging
from typing import Any

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from models.transaction import SalesTransaction

logger = logging.getLogger(__name__)

# Category columns expected by the RF model (from feature_importance.csv)
# These are one-hot encoded; any unseen category gets all zeros.
TRAINING_CATEGORIES = [
    "Baby & Kids",
    "Beverages",
    "Cleaning & Household",
    "Cooking Essentials",
    "Dairy & Chilled",
    "General Grocery",
    "Health & Medicine",
    "Meat, Fish & Frozen",
    "Personal Care",
    "Snacks & Confectionery",
    "Staples & Dry Groceries",
    "Stationery",
]

# Ordered feature columns exactly as the RF was trained
RF_FEATURE_COLUMNS = [
    "total_quantity_sold",
    "high_demand_quantity",
    "invoice_count",
    "sales_frequency_per_day",
    "active_days",
    "active_months",
    "avg_monthly_quantity",
    "normal_month_quantity",
    "std_monthly_quantity",
    "max_monthly_quantity",
    "total_revenue",
    "high_demand_revenue",
    "selling_period_days",
    "category_General Grocery",
    "total_profit",
    "normal_month_revenue",
    "avg_quantity_per_line",
    "avg_quantity_per_invoice",
    "recency_days",
    "normal_month_quantity_share",
    "cost_price",
    "avg_revenue_per_invoice",
    "max_quantity_per_line",
    "avg_profit_per_invoice",
    "high_demand_quantity_share",
    "retail_price",
    "profit_margin",
    "unit_profit",
    "category_Personal Care",
    "category_Health & Medicine",
    "category_Staples & Dry Groceries",
    "category_Cleaning & Household",
    "category_Meat, Fish & Frozen",
    "category_Baby & Kids",
    "category_Beverages",
    "category_Snacks & Confectionery",
    "category_Dairy & Chilled",
    "min_monthly_quantity",
    "category_Cooking Essentials",
    "category_Stationery",
]

MOVEMENT_LABELS = {0: "Slow Moving", 1: "Medium Moving", 2: "Fast Moving"}


def _extract_predictor(rf_artifact: Any) -> tuple[Any, list[str] | None]:
    """
    Supports both older artifacts that are the estimator directly and newer
    project-compatible artifacts saved as dictionaries with metadata.
    """
    if isinstance(rf_artifact, dict):
        feature_columns = rf_artifact.get("feature_columns")
        for key in ("model", "pipeline", "estimator", "classifier"):
            candidate = rf_artifact.get(key)
            if hasattr(candidate, "predict"):
                return candidate, feature_columns
        return None, feature_columns
    return rf_artifact, None


def compute_product_features_from_db(db: Session, reference_date: pd.Timestamp | None = None) -> pd.DataFrame:
    """
    Query aggregated transaction data from MySQL and compute the same features
    that were used to train the Random Forest model.

    Returns a DataFrame with one row per product_id containing:
      - All RF feature columns
      - product_id, product_name, category, cost_price, retail_price columns for display
    """
    # Pull all transactions
    rows = db.query(
        SalesTransaction.product_id,
        SalesTransaction.product_name,
        SalesTransaction.category,
        SalesTransaction.cost_price,
        SalesTransaction.retail_price,
        SalesTransaction.quantity_sold,
        SalesTransaction.total_revenue,
        SalesTransaction.profit,
        SalesTransaction.invoice_id,
        SalesTransaction.sale_date,
    ).all()

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows, columns=[
        "product_id", "product_name", "category", "cost_price", "retail_price",
        "quantity_sold", "total_revenue", "profit", "invoice_id", "sale_date",
    ])
    df["sale_date"] = pd.to_datetime(df["sale_date"])

    if reference_date is None:
        reference_date = df["sale_date"].max()

    products = []

    for product_id, group in df.groupby("product_id"):
        product_name = group["product_name"].iloc[0]
        category = group["category"].iloc[0]
        cost_price = float(group["cost_price"].iloc[0])
        retail_price = float(group["retail_price"].iloc[0])

        total_quantity_sold = float(group["quantity_sold"].sum())
        total_revenue = float(group["total_revenue"].sum())
        total_profit = float(group["profit"].sum())
        invoice_count = int(group["invoice_id"].nunique())
        avg_quantity_per_line = float(group["quantity_sold"].mean())
        max_quantity_per_line = float(group["quantity_sold"].max())
        avg_quantity_per_invoice = total_quantity_sold / max(invoice_count, 1)
        avg_revenue_per_invoice = total_revenue / max(invoice_count, 1)
        avg_profit_per_invoice = total_profit / max(invoice_count, 1)

        first_sale = group["sale_date"].min()
        last_sale = group["sale_date"].max()
        active_days = int((last_sale - first_sale).days) + 1
        selling_period_days = active_days
        recency_days = int((reference_date - last_sale).days)

        # Active months (distinct YYYY-MM)
        group["ym"] = group["sale_date"].dt.to_period("M")
        monthly = group.groupby("ym")["quantity_sold"].sum()
        active_months = int(monthly.shape[0])
        avg_monthly_quantity = float(monthly.mean()) if active_months > 0 else 0.0
        std_monthly_quantity = float(monthly.std()) if active_months > 1 else 0.0
        max_monthly_quantity = float(monthly.max()) if active_months > 0 else 0.0
        min_monthly_quantity = float(monthly.min()) if active_months > 0 else 0.0

        # High-demand month = month where qty > 80th percentile
        threshold = monthly.quantile(0.8) if active_months >= 3 else monthly.max()
        high_demand_months = monthly[monthly > threshold]
        high_demand_quantity = float(high_demand_months.sum())

        normal_months = monthly[monthly <= threshold]
        normal_month_quantity = float(normal_months.mean()) if len(normal_months) > 0 else avg_monthly_quantity
        normal_month_quantity_share = normal_month_quantity / max(avg_monthly_quantity, 1)

        # Revenue in high-demand months
        monthly_rev = group.groupby("ym")["total_revenue"].sum()
        high_demand_revenue = float(monthly_rev[monthly_rev.index.isin(high_demand_months.index)].sum())
        normal_month_revenue = float(monthly_rev[~monthly_rev.index.isin(high_demand_months.index)].mean()) if len(monthly_rev) > 0 else 0.0
        high_demand_quantity_share = high_demand_quantity / max(total_quantity_sold, 1)

        sales_frequency_per_day = total_quantity_sold / max(active_days, 1)
        unit_profit = total_profit / max(total_quantity_sold, 1)
        profit_margin = total_profit / max(total_revenue, 1)

        # One-hot categories
        cat_features = {f"category_{cat}": 0.0 for cat in TRAINING_CATEGORIES}
        cat_key = f"category_{category}"
        if cat_key in cat_features:
            cat_features[cat_key] = 1.0

        row = {
            "product_id": str(product_id),
            "product_name": product_name,
            "category": category,
            "cost_price": cost_price,
            "retail_price": retail_price,
            "total_quantity_sold": total_quantity_sold,
            "high_demand_quantity": high_demand_quantity,
            "invoice_count": float(invoice_count),
            "sales_frequency_per_day": sales_frequency_per_day,
            "active_days": float(active_days),
            "active_months": float(active_months),
            "avg_monthly_quantity": avg_monthly_quantity,
            "normal_month_quantity": normal_month_quantity,
            "std_monthly_quantity": std_monthly_quantity,
            "max_monthly_quantity": max_monthly_quantity,
            "total_revenue": total_revenue,
            "high_demand_revenue": high_demand_revenue,
            "selling_period_days": float(selling_period_days),
            "total_profit": total_profit,
            "normal_month_revenue": normal_month_revenue,
            "avg_quantity_per_line": avg_quantity_per_line,
            "avg_quantity_per_invoice": avg_quantity_per_invoice,
            "recency_days": float(recency_days),
            "normal_month_quantity_share": normal_month_quantity_share,
            "avg_revenue_per_invoice": avg_revenue_per_invoice,
            "max_quantity_per_line": max_quantity_per_line,
            "avg_profit_per_invoice": avg_profit_per_invoice,
            "high_demand_quantity_share": high_demand_quantity_share,
            "profit_margin": profit_margin,
            "unit_profit": unit_profit,
            "min_monthly_quantity": min_monthly_quantity,
            **cat_features,
        }
        products.append(row)

    return pd.DataFrame(products)


def run_rf_inference(features_df: pd.DataFrame, rf_model: Any) -> pd.DataFrame:
    """
    Given a features DataFrame and loaded RF model, compute predictions
    and class probabilities. Returns the same DataFrame enriched with:
      predicted_movement_level, probability_fast_moving,
      probability_medium_moving, probability_slow_moving
    """
    if features_df.empty:
        return features_df

    if rf_model is None:
        logger.error("RF inference failed: model is None.")
        result = features_df.copy()
        result["predicted_movement_level"] = "Unknown"
        result["movement_level"] = "Unknown"
        result["probability_slow_moving"] = 0.0
        result["probability_medium_moving"] = 0.0
        result["probability_fast_moving"] = 0.0
        return result

    predictor, artifact_feature_columns = _extract_predictor(rf_model)
    if predictor is None:
        logger.error("RF inference failed: loaded artifact does not contain a predictor.")
        result = features_df.copy()
        result["predicted_movement_level"] = "Unknown"
        result["movement_level"] = "Unknown"
        result["probability_slow_moving"] = 0.0
        result["probability_medium_moving"] = 0.0
        result["probability_fast_moving"] = 0.0
        return result

    # Build the X matrix in the exact column order the RF expects
    model_feature_columns = artifact_feature_columns or RF_FEATURE_COLUMNS
    X_cols = [c for c in model_feature_columns if c in features_df.columns]
    missing_cols = [c for c in model_feature_columns if c not in features_df.columns]

    X = features_df[X_cols].copy()
    for mc in missing_cols:
        X[mc] = "Unknown" if mc == "category" else 0.0

    # Reorder to match training order exactly
    X = X.reindex(columns=model_feature_columns, fill_value=0.0)
    for col in X.columns:
        if col == "category":
            X[col] = X[col].fillna("Unknown").astype(str)
        else:
            X[col] = pd.to_numeric(X[col], errors="coerce").fillna(0.0)

    try:
        preds = predictor.predict(X)
        probas = predictor.predict_proba(X) if hasattr(predictor, "predict_proba") else None
        classes = list(getattr(predictor, "classes_", []))
        if not classes and hasattr(predictor, "named_steps"):
            final_step = list(predictor.named_steps.values())[-1]
            classes = list(getattr(final_step, "classes_", []))

        # Map class indices to probability columns
        # classes are 0='Slow Moving', 1='Medium Moving', 2='Fast Moving'
        # but may differ if the model was trained differently — use class names
        label_map = {}
        for i, cls in enumerate(classes):
            if hasattr(cls, 'lower'):
                lc = cls.lower()
            else:
                lc = str(cls).lower()
            if "fast" in lc or cls == 2:
                label_map["fast"] = i
            elif "medium" in lc or cls == 1:
                label_map["medium"] = i
            elif "slow" in lc or cls == 0:
                label_map["slow"] = i

        result = features_df.copy()
        result["predicted_movement_level"] = [str(p) for p in preds]

        # Normalize label if model outputs 0/1/2
        def norm_label(lbl):
            if str(lbl) == "0" or str(lbl).lower() == "slow moving":
                return "Slow Moving"
            if str(lbl) == "1" or str(lbl).lower() == "medium moving":
                return "Medium Moving"
            if str(lbl) == "2" or str(lbl).lower() == "fast moving":
                return "Fast Moving"
            return str(lbl)

        result["predicted_movement_level"] = result["predicted_movement_level"].apply(norm_label)
        result["movement_level"] = result["predicted_movement_level"]

        if probas is not None and len(classes) > 0:
            result["probability_slow_moving"] = probas[:, label_map.get("slow", 0)]
            result["probability_medium_moving"] = probas[:, label_map.get("medium", min(1, probas.shape[1] - 1))]
            result["probability_fast_moving"] = probas[:, label_map.get("fast", min(2, probas.shape[1] - 1))]
        else:
            result["probability_slow_moving"] = 0.0
            result["probability_medium_moving"] = 0.0
            result["probability_fast_moving"] = 0.0

        logger.info("RF inference complete: %d products classified.", len(result))
        return result

    except Exception as exc:
        logger.error("RF inference failed: %s", exc, exc_info=True)
        # Return with neutral predictions rather than crashing
        result = features_df.copy()
        result["predicted_movement_level"] = "Unknown"
        result["movement_level"] = "Unknown"
        result["probability_slow_moving"] = 0.0
        result["probability_medium_moving"] = 0.0
        result["probability_fast_moving"] = 0.0
        return result
