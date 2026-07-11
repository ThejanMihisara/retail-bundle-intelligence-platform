from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from models.user import User
from services.model_service import model_service
from utils.dependencies import get_current_user
import json

router = APIRouter(prefix="/api/models", tags=["model-status"])

@router.get("/status")
async def get_status(_: User = Depends(get_current_user)):
    model_service.load_models()
    return model_service.get_model_status()

@router.get("/random-forest/summary")
async def get_rf_summary(_: User = Depends(get_current_user)):
    model_service.load_models()
    if model_service.rf_training_summary is None:
        raise HTTPException(status_code=404, detail="Random Forest training summary not found.")
    return {
        "summary": model_service.rf_training_summary,
        "classification_report": model_service.rf_classification_report
    }

@router.get("/random-forest/feature-importance")
async def get_rf_feature_importance(_: User = Depends(get_current_user)):
    model_service.load_models()
    df = model_service.rf_feature_importance
    if df is None:
        raise HTTPException(status_code=404, detail="Random Forest feature importance not found.")
    
    # Sort and return as list of dicts
    sorted_df = df.sort_values("importance", ascending=False)
    return sorted_df.to_dict("records")

@router.get("/fp-growth/summary")
async def get_fp_summary(_: User = Depends(get_current_user)):
    model_service.load_models()
    if model_service.fp_training_summary is None:
        raise HTTPException(status_code=404, detail="FP-Growth training summary not found.")
    return model_service.fp_training_summary
