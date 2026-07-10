from fastapi import APIRouter, Depends
from models.user import User
from schemas.basket import BasketApplyRequest, BasketGenerateRequest
from services.basket_service import SAVED_RULES
from services.model_artifact_service import model_artifact_repository
from utils.dependencies import get_current_user

router = APIRouter(prefix="/api/basket", tags=["basket"])


@router.post("/generate")
async def generate(payload: BasketGenerateRequest, _: User = Depends(get_current_user)):
    return model_artifact_repository.get_association_rules(payload.min_support, payload.min_confidence, payload.min_lift)


@router.get("/rules/{dataset_id}")
async def rules(dataset_id: int, _: User = Depends(get_current_user)):
    return SAVED_RULES.get("artifact") or model_artifact_repository.get_association_rules()


@router.get("/rules")
async def all_rules(_: User = Depends(get_current_user)):
    return SAVED_RULES.get("artifact") or model_artifact_repository.get_association_rules()


@router.post("/apply")
async def apply_rules(payload: BasketApplyRequest, _: User = Depends(get_current_user)):
    SAVED_RULES["artifact"] = model_artifact_repository.get_association_rules()
    return {"message": "Basket rules saved", "dataset_id": payload.dataset_id}
