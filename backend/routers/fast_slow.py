from fastapi import APIRouter, Depends
from models.user import User
from schemas.fast_slow import FastSlowProduct, FastSlowRequest
from services.model_artifact_service import model_artifact_repository
from utils.dependencies import get_current_user

router = APIRouter(prefix="/api/fast-slow", tags=["fast-slow"])


@router.post("/analyze", response_model=list[FastSlowProduct])
async def analyze(payload: FastSlowRequest, _: User = Depends(get_current_user)):
    return model_artifact_repository.get_fast_slow_results(payload.category_filter)


@router.get("/results/{dataset_id}", response_model=list[FastSlowProduct])
async def results(dataset_id: int, _: User = Depends(get_current_user)):
    return model_artifact_repository.get_fast_slow_results()


@router.get("/results", response_model=list[FastSlowProduct])
async def all_results(_: User = Depends(get_current_user)):
    return model_artifact_repository.get_fast_slow_results()
