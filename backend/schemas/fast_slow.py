from datetime import date
from typing import Optional
from pydantic import BaseModel


class DateRange(BaseModel):
    start_date: date
    end_date: date


class FastSlowRequest(BaseModel):
    dataset_id: int | None = None
    category_filter: str | None = None
    date_range: DateRange | None = None


class FastSlowProduct(BaseModel):
    product_id: str | int | None
    product_name: str
    category: str
    velocity_label: str
    movement_score: float
    total_quantity_sold: float
    total_revenue: float
    recommended_action: str


class MovementPredictionFilters(BaseModel):
    period_type: str
    selected_date: str
    period_start: date
    period_end: date
    period_label: str
    movement_level: Optional[str] = None
    category: Optional[str] = None
    search: Optional[str] = None


class MovementPredictionModelInfo(BaseModel):
    model_name: str
    model_version: str
    training_start_date: Optional[str] = None
    training_end_date: Optional[str] = None


class MovementPredictionSummary(BaseModel):
    total_products: int
    fast_moving_count: int
    medium_moving_count: int
    slow_moving_count: int
    average_confidence: float


class MovementDistributionItem(BaseModel):
    movement_level: str
    count: int
    percentage: float


class MovementTopProduct(BaseModel):
    product_id: str
    product_name: str
    category: str
    movement_level: str
    movement_confidence: float
    expected_quantity: int


class ProductMovementPrediction(BaseModel):
    product_id: str
    product_name: str
    category: str
    period_type: str
    period_start: date
    period_end: date
    movement_level: str
    movement_confidence: float
    probability_fast_moving: float
    probability_medium_moving: float
    probability_slow_moving: float
    probabilities: Optional[dict] = None
    expected_quantity: int
    expected_revenue: float
    expected_profit: float
    quantity_sold: int
    revenue: float
    profit: float
    overall_quantity: int
    overall_transactions: int
    seasonal_month_mean_quantity: Optional[float] = None
    is_known_product: bool = True


class ProductMovementPredictionResponse(BaseModel):
    filters: MovementPredictionFilters
    model: MovementPredictionModelInfo
    summary: MovementPredictionSummary
    distribution: list[MovementDistributionItem]
    top_fast_products: list[MovementTopProduct]
    top_slow_products: list[MovementTopProduct]
    insights: list[str]
    data: list[ProductMovementPrediction]
    total: int
    page: int
    limit: int

