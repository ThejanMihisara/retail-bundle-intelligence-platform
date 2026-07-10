from services.model_artifact_service import model_artifact_repository

FAST_SLOW_CACHE: dict[str, list[dict]] = {}


def analyze_fast_slow(category_filter: str | None = None) -> list[dict]:
    results = model_artifact_repository.get_fast_slow_results(category_filter)
    FAST_SLOW_CACHE["artifact"] = results
    return results
