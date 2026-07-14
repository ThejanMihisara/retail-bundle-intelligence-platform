
from __future__ import annotations

from datetime import date
from typing import Literal

import joblib
import numpy as np
import pandas as pd


PeriodType = Literal["day", "week", "month"]


def load_product_movement_bundle(model_path: str):
    bundle = joblib.load(model_path, mmap_mode="r")

    required = {
        "pipeline",
        "feature_columns",
        "profile_tables",
        "classes",
        "supported_period_types",
        "model_version",
    }

    missing = required.difference(bundle.keys())
    if missing:
        raise ValueError(
            f"Invalid product movement model bundle. Missing: {sorted(missing)}"
        )

    return bundle


def _calendar_features(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    dates = pd.to_datetime(result["period_start"])

    result["year"] = dates.dt.year
    result["month"] = dates.dt.month
    result["quarter"] = dates.dt.quarter
    result["day_of_month"] = dates.dt.day
    result["day_of_week"] = dates.dt.dayofweek
    result["day_of_year"] = dates.dt.dayofyear
    result["iso_week"] = dates.dt.isocalendar().week.astype(int)
    result["is_weekend"] = (dates.dt.dayofweek >= 5).astype(int)
    result["days_in_month"] = dates.dt.days_in_month

    result["month_sin"] = np.sin(
        2 * np.pi * result["month"] / 12
    )
    result["month_cos"] = np.cos(
        2 * np.pi * result["month"] / 12
    )
    result["dow_sin"] = np.sin(
        2 * np.pi * result["day_of_week"] / 7
    )
    result["dow_cos"] = np.cos(
        2 * np.pi * result["day_of_week"] / 7
    )
    result["doy_sin"] = np.sin(
        2 * np.pi * result["day_of_year"] / 365.25
    )
    result["doy_cos"] = np.cos(
        2 * np.pi * result["day_of_year"] / 365.25
    )
    result["week_sin"] = np.sin(
        2 * np.pi * result["iso_week"] / 52.18
    )
    result["week_cos"] = np.cos(
        2 * np.pi * result["iso_week"] / 52.18
    )

    return result


def normalize_period_start(
    selected_date: date | str,
    period_type: PeriodType,
) -> pd.Timestamp:
    selected = pd.Timestamp(selected_date).normalize()

    if period_type == "day":
        return selected

    if period_type == "week":
        return selected - pd.Timedelta(days=selected.dayofweek)

    if period_type == "month":
        return selected.to_period("M").to_timestamp()

    raise ValueError("period_type must be day, week, or month")


def build_future_rows(
    bundle: dict,
    selected_date: date | str,
    period_type: PeriodType,
) -> pd.DataFrame:
    if period_type not in bundle["supported_period_types"]:
        raise ValueError(f"Unsupported period type: {period_type}")

    period_start = normalize_period_start(
        selected_date,
        period_type,
    )

    profiles = bundle["profile_tables"]
    catalog = profiles["product_catalog"].copy()

    future = catalog[
        [
            "product_id",
            "product_name",
            "category",
            "average_unit_price",
            "overall_daily_quantity_rate",
            "overall_transaction_rate",
            "overall_active_day_rate",
            "overall_profit_margin",
            "overall_quantity",
            "overall_transactions",
        ]
    ].copy()

    future["period_type"] = period_type
    future["period_start"] = period_start
    future = _calendar_features(future)

    future = (
        future
        .merge(
            profiles["profile_base"],
            on=["product_id", "period_type"],
            how="left",
        )
        .merge(
            profiles["month_profile"],
            on=["product_id", "period_type", "month"],
            how="left",
        )
        .merge(
            profiles["dow_profile"],
            on=["product_id", "period_type", "day_of_week"],
            how="left",
        )
    )

    return future


def predict_product_movement(
    bundle: dict,
    selected_date: date | str,
    period_type: PeriodType,
) -> pd.DataFrame:
    rows = build_future_rows(
        bundle,
        selected_date,
        period_type,
    )

    pipeline = bundle["pipeline"]
    features = rows[bundle["feature_columns"]]

    predicted = pipeline.predict(features)
    probabilities = pipeline.predict_proba(features)
    classes = list(
        pipeline.named_steps["classifier"].classes_
    )

    result = rows[
        [
            "period_start",
            "period_type",
            "product_id",
            "product_name",
            "category",
            "overall_quantity",
            "overall_transactions",
            "overall_daily_quantity_rate",
            "profile_mean_quantity",
            "seasonal_month_mean_quantity",
            "average_unit_price",
            "overall_profit_margin",
        ]
    ].copy()

    result["predicted_movement_level"] = predicted

    result["probability_fast_moving"] = 0.0
    result["probability_medium_moving"] = 0.0
    result["probability_slow_moving"] = 0.0

    for index, class_name in enumerate(classes):
        if class_name == "Fast Moving":
            result["probability_fast_moving"] = probabilities[:, index]
        elif class_name == "Medium Moving":
            result["probability_medium_moving"] = probabilities[:, index]
        elif class_name == "Slow Moving":
            result["probability_slow_moving"] = probabilities[:, index]

    result["movement_confidence"] = probabilities.max(axis=1)
    result["movement_score"] = (
        result["probability_fast_moving"]
        + 0.5 * result["probability_medium_moving"]
    )

    return result.sort_values(
        ["movement_score", "movement_confidence"],
        ascending=False,
    ).reset_index(drop=True)
