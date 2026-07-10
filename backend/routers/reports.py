import csv
from io import StringIO
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from models.user import User
from services.bundle_service import APPROVED_BUNDLES
from services.model_artifact_service import model_artifact_repository
from utils.dependencies import get_current_user

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/summary/{dataset_id}")
async def summary(dataset_id: int, _: User = Depends(get_current_user)):
    return model_artifact_repository.get_report_summary(len(APPROVED_BUNDLES))


@router.get("/summary")
async def all_summary(_: User = Depends(get_current_user)):
    return model_artifact_repository.get_report_summary(len(APPROVED_BUNDLES))


@router.get("/export/csv/{dataset_id}")
async def export_csv(dataset_id: int, _: User = Depends(get_current_user)):
    bundles = model_artifact_repository.get_bundle_recommendations()
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=["bundle_name", "products", "expected_lift_pct", "confidence", "support", "status"])
    writer.writeheader()
    for bundle in bundles:
        writer.writerow({**bundle, "products": ", ".join(bundle["products"])})
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=bundle_recommendations.csv"},
    )


@router.get("/export/csv")
async def export_all_csv(_: User = Depends(get_current_user)):
    bundles = model_artifact_repository.get_bundle_recommendations()
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=["bundle_name", "products", "expected_lift_pct", "confidence", "support", "status"])
    writer.writeheader()
    for bundle in bundles:
        writer.writerow({**bundle, "products": ", ".join(bundle["products"])})
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=bundle_recommendations.csv"},
    )
