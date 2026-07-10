from pydantic import BaseModel


class BundleOut(BaseModel):
    bundle_id: str
    bundle_name: str
    products: list[str]
    expected_lift_pct: float
    confidence: float
    support: float
    status: str
