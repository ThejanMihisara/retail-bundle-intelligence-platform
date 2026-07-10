from datetime import datetime
from pydantic import BaseModel


class ValidationResponse(BaseModel):
    is_valid: bool
    row_count: int
    columns_detected: list[str]
    column_mapping: dict[str, str]
    missing_columns: list[str]
    message: str


class DatasetSaveRequest(BaseModel):
    dataset_name: str
    channel_store: str


class DatasetOut(BaseModel):
    id: int
    user_id: int
    dataset_name: str
    channel_store: str
    file_path: str
    row_count: int
    columns_detected: list[str]
    validation_status: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}
