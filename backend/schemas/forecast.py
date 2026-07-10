from pydantic import BaseModel, Field


class ForecastRequest(BaseModel):
    dataset_id: int | None = None
    product_name: str
    horizon_days: int = Field(default=30, ge=1, le=365)
