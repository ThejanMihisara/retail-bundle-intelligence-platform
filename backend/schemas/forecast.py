from typing import List, Optional
from pydantic import BaseModel


class FutureForecastRecord(BaseModel):
    forecast_date: Optional[str] = None
    period_start: str
    period_end: str
    period_label: str
    day_of_week: Optional[str] = None
    predicted_transactions: int
    transaction_lower: int
    transaction_upper: int
    predicted_quantity_sold: int
    quantity_lower: int
    quantity_upper: int


class ComparisonRecord(BaseModel):
    date: str
    period_start: str
    period_end: str
    period_label: str
    predicted: int
    actual: Optional[int]
    error: Optional[int]
    absolute_error: Optional[int]
    error_percentage: Optional[float]
    result: str
    has_actual: bool
    actual_coverage_days: int
    forecast_days: int
    is_partial_actual_period: bool
    calendar_days: Optional[int] = None
    is_partial_forecast_period: Optional[bool] = None


class ComparisonSummary(BaseModel):
    actual_total: int
    matched_predicted_total: int
    complete_period_predicted_total: int
    matched_dates: int
    prediction_only_dates: int
    actual_coverage_percentage: float
    average_forecast_error: float
    mape: float
    rmse: float
    forecast_bias: float
    forecast_accuracy: float


class ComparisonResponse(BaseModel):
    summary: ComparisonSummary
    data: List[ComparisonRecord]
