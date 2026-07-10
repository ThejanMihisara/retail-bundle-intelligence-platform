from services.model_artifact_service import model_artifact_repository

APPROVED_BUNDLES: dict[str, dict] = {}
BUNDLE_CACHE: dict[str, list[dict]] = {}


def recommendations_for_dataset(_: int | None = None) -> list[dict]:
    bundles = model_artifact_repository.get_bundle_recommendations()
    BUNDLE_CACHE["artifact"] = bundles
    return bundles
