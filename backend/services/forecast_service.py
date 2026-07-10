from services.model_artifact_service import model_artifact_repository

FORECAST_CACHE: dict[str, list[dict]] = {}


def run_forecast(product_name: str, horizon_days: int) -> dict:
    result = model_artifact_repository.get_product_forecast(product_name, horizon_days)
    FORECAST_CACHE.setdefault("artifact", []).append(result)
    return result
