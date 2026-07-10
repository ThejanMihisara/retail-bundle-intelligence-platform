import os
from pathlib import Path
from uuid import uuid4
from fastapi import HTTPException, UploadFile
import pandas as pd
from sqlalchemy.orm import Session
from models.dataset import Dataset, ValidationStatus
from models.user import User

REQUIRED_COLUMNS = [
    "invoiceID",
    "product_name",
    "category",
    "sale_date",
    "quantity_sold",
    "unit_price",
    "total_revenue",
]


def read_upload(file: UploadFile) -> pd.DataFrame:
    filename = file.filename or ""
    try:
        if filename.lower().endswith((".xlsx", ".xls")):
            return pd.read_excel(file.file)
        return pd.read_csv(file.file)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Unable to read uploaded file: {exc}") from exc


def validate_dataframe(df: pd.DataFrame) -> dict:
    detected = [str(col) for col in df.columns]
    lower_to_actual = {col.lower(): col for col in detected}
    mapping = {required: lower_to_actual[required.lower()] for required in REQUIRED_COLUMNS if required.lower() in lower_to_actual}
    missing = [required for required in REQUIRED_COLUMNS if required.lower() not in lower_to_actual]
    return {
        "is_valid": not missing,
        "row_count": int(len(df)),
        "columns_detected": detected,
        "column_mapping": mapping,
        "missing_columns": missing,
        "message": "Dataset is valid" if not missing else f"Missing required columns: {', '.join(missing)}",
    }


def save_dataset_file(file: UploadFile, user: User, dataset_name: str, channel_store: str, db: Session) -> Dataset:
    df = read_upload(file)
    validation = validate_dataframe(df)
    if not validation["is_valid"]:
        raise HTTPException(status_code=422, detail=validation["message"])

    upload_dir = Path(os.getenv("UPLOAD_DIR", "./uploads")) / str(user.id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    extension = Path(file.filename or "dataset.csv").suffix or ".csv"
    saved_path = upload_dir / f"{uuid4().hex}{extension}"
    if extension.lower() in [".xlsx", ".xls"]:
        df.to_excel(saved_path, index=False)
    else:
        df.to_csv(saved_path, index=False)

    dataset = Dataset(
        user_id=user.id,
        dataset_name=dataset_name,
        channel_store=channel_store,
        file_path=str(saved_path),
        row_count=int(len(df)),
        columns_detected=validation["columns_detected"],
        validation_status=ValidationStatus.valid,
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return dataset

