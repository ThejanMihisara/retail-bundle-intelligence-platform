from services.model_artifact_service import model_artifact_repository

BASKET_CACHE: dict[str, dict] = {}
SAVED_RULES: dict[str, dict] = {}


def generate_basket_rules(min_support: float | None = None, min_confidence: float | None = None, min_lift: float | None = None) -> dict:
    result = model_artifact_repository.get_association_rules(min_support, min_confidence, min_lift)
    BASKET_CACHE["artifact"] = result
    return result
