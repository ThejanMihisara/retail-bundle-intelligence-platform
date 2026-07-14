
import numpy as np
import pandas as pd


def integer_values(values):
    return np.maximum(
        0,
        np.rint(np.asarray(values, dtype=float)),
    ).astype(int)


def add_calendar_features(frame):
    result = frame.copy()
    dates = pd.to_datetime(result["sale_date"])

    result["day_of_week"] = dates.dt.dayofweek
    result["day_of_month"] = dates.dt.day
    result["day_of_year"] = dates.dt.dayofyear
    result["week_of_year"] = dates.dt.isocalendar().week.astype(int)
    result["month"] = dates.dt.month
    result["quarter"] = dates.dt.quarter
    result["year"] = dates.dt.year
    result["is_weekend"] = (dates.dt.dayofweek >= 5).astype(int)
    result["is_month_start"] = dates.dt.is_month_start.astype(int)
    result["is_month_end"] = dates.dt.is_month_end.astype(int)

    result["dow_sin"] = np.sin(2 * np.pi * result["day_of_week"] / 7)
    result["dow_cos"] = np.cos(2 * np.pi * result["day_of_week"] / 7)
    result["month_sin"] = np.sin(2 * np.pi * result["month"] / 12)
    result["month_cos"] = np.cos(2 * np.pi * result["month"] / 12)
    result["doy_sin"] = np.sin(2 * np.pi * result["day_of_year"] / 365.25)
    result["doy_cos"] = np.cos(2 * np.pi * result["day_of_year"] / 365.25)

    return result


def one_future_row(date, history, lags, windows):
    row = add_calendar_features(
        pd.DataFrame({"sale_date": [pd.Timestamp(date)]})
    )
    values = pd.Series(history, dtype=float)

    for lag in lags:
        row[f"lag_{lag}"] = values.iloc[-lag]

    for window in windows:
        recent = values.iloc[-window:]
        row[f"mean_{window}"] = recent.mean()
        row[f"std_{window}"] = recent.std()
        row[f"min_{window}"] = recent.min()
        row[f"max_{window}"] = recent.max()
        row[f"median_{window}"] = recent.median()

    return row


def gradient_boosting_predict(bundle, dates):
    target = bundle["target"]
    history = bundle["history"][target].astype(float).tolist()
    predictions = []

    dates_pd = pd.to_datetime(dates)
    calendar_df = add_calendar_features(pd.DataFrame({"sale_date": dates_pd}))

    lags = bundle["lags"]
    windows = bundle["rolling_windows"]
    gb_cols = bundle["gradient_boosting_columns"]
    model = bundle["gradient_boosting_model"]

    for i, date_val in enumerate(dates_pd):
        # Fetch precomputed calendar features for this date
        row_dict = calendar_df.iloc[i].to_dict()

        # Add lag features
        for lag in lags:
            row_dict[f"lag_{lag}"] = history[-lag]

        # Add rolling window features
        for window in windows:
            recent = history[-window:]
            row_dict[f"mean_{window}"] = sum(recent) / window
            row_dict[f"std_{window}"] = np.std(recent, ddof=1) if len(recent) > 1 else 0.0
            row_dict[f"min_{window}"] = min(recent)
            row_dict[f"max_{window}"] = max(recent)
            row_dict[f"median_{window}"] = np.median(recent)

        # Convert to single-row DataFrame ordered by gb_cols
        row_data = [row_dict[col] for col in gb_cols]
        row_df = pd.DataFrame([row_data], columns=gb_cols)

        prediction = max(
            0,
            int(round(
                model.predict(row_df)[0]
            )),
        )
        predictions.append(prediction)
        history.append(prediction)

    return np.asarray(predictions, dtype=int)


def seasonal_naive(bundle, periods):
    target = bundle["target"]
    history = bundle["history"][target].astype(float).tolist()
    predictions = []

    for _ in range(periods):
        prediction = max(0, int(round(history[-7])))
        predictions.append(prediction)
        history.append(prediction)

    return np.asarray(predictions, dtype=int)


def predict_bundle(bundle, dates):
    dates = pd.to_datetime(pd.Series(dates))

    prophet_frame = bundle["prophet_model"].predict(
        pd.DataFrame({"ds": dates})
    )
    prophet_prediction = integer_values(
        prophet_frame["yhat"]
    )
    gb_prediction = gradient_boosting_predict(
        bundle,
        dates,
    )

    selected = bundle["selected_model"]

    if selected == "prophet":
        point = prophet_prediction
    elif selected == "gradient_boosting":
        point = gb_prediction
    elif selected == "ensemble":
        weights = bundle["ensemble_weight"]
        point = integer_values(
            weights["prophet_weight"] * prophet_prediction
            + weights["gradient_boosting_weight"] * gb_prediction
        )
    else:
        point = seasonal_naive(bundle, len(dates))

    lower = np.floor(
        np.maximum(
            0,
            prophet_frame["yhat_lower"].to_numpy(),
        )
    ).astype(int)
    upper = np.ceil(
        np.maximum(
            0,
            prophet_frame["yhat_upper"].to_numpy(),
        )
    ).astype(int)

    lower = np.minimum(lower, point)
    upper = np.maximum(upper, point)

    return pd.DataFrame({
        "forecast_date": dates,
        "prediction": point.astype(int),
        "lower": lower.astype(int),
        "upper": upper.astype(int),
    })


def aggregate_forecast_view(daily_records, view):
    frame = daily_records.copy()
    frame["forecast_date"] = pd.to_datetime(frame["forecast_date"])

    value_columns = [
        "predicted_transactions",
        "transaction_lower",
        "transaction_upper",
        "predicted_quantity_sold",
        "quantity_lower",
        "quantity_upper",
    ]

    if view == "daily":
        frame["period_start"] = frame["forecast_date"]
        frame["period_end"] = frame["forecast_date"]
        return frame

    indexed = frame.set_index("forecast_date")

    if view == "weekly":
        grouped = indexed[value_columns].resample(
            "W-MON",
            label="left",
            closed="left",
        ).sum()
        grouped["period_start"] = grouped.index
        grouped["period_end"] = grouped.index + pd.Timedelta(days=6)
    elif view == "monthly":
        grouped = indexed[value_columns].resample("MS").sum()
        grouped["period_start"] = grouped.index
        grouped["period_end"] = grouped.index + pd.offsets.MonthEnd(1)
    else:
        raise ValueError("view must be daily, weekly, or monthly")

    return grouped.reset_index(drop=True)
