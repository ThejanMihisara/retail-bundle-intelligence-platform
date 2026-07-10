from datetime import date
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
