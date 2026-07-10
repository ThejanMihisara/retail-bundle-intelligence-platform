from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session
from database import get_db
from models.dataset import Dataset
from models.user import User
from schemas.upload import DatasetOut, ValidationResponse
from services.upload_service import read_upload, save_dataset_file, validate_dataframe
from utils.dependencies import get_current_user

router = APIRouter(prefix="/api/upload", tags=["upload"])


@router.post("/validate", response_model=ValidationResponse)
async def validate_upload(file: UploadFile = File(...), _: User = Depends(get_current_user)):
    df = read_upload(file)
    return validate_dataframe(df)


@router.post("/save", response_model=DatasetOut)
async def save_upload(
    dataset_name: str = Form(...),
    channel_store: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return save_dataset_file(file, current_user, dataset_name, channel_store, db)


@router.get("/datasets", response_model=list[DatasetOut])
async def list_datasets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Dataset)
    if current_user.role.value != "admin":
        query = query.filter(Dataset.user_id == current_user.id)
    return query.order_by(Dataset.uploaded_at.desc()).all()
