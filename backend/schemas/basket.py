from pydantic import BaseModel, Field


class BasketGenerateRequest(BaseModel):
    dataset_id: int | None = None
    min_support: float = Field(default=0.05, gt=0, le=1)
    min_confidence: float = Field(default=0.6, gt=0, le=1)
    min_lift: float = Field(default=1.2, ge=0)


class BasketApplyRequest(BaseModel):
    dataset_id: int | None = None
