from pydantic import BaseModel
from typing import List, Optional


class BundleOut(BaseModel):
    bundle_id: str
    bundle_name: str
    products: list[str]
    expected_lift_pct: float
    confidence: float
    support: float
    status: str


class BundleProduct(BaseModel):
    product_id: str
    product_name: str
    category: str
    movement_label: str
    retail_price: float


class BundleItem(BaseModel):
    bundle_id: int
    bundle_rank: int
    product_count: int
    products: List[BundleProduct]
    categories: List[str]
    movement_labels: List[str]
    fast_product_count: int
    medium_product_count: int
    slow_product_count: int
    support: float
    pair_support: float
    confidence: float
    lift: float
    graph_density: float
    test_attachment_rate: float
    seasonal_demand_score: float
    score: float
    normal_bundle_retail_price: Optional[float] = None
    estimated_bundle_cost: Optional[float] = None
    normal_bundle_profit: Optional[float] = None
    suggested_discount_pct: Optional[float] = None
    promo_bundle_price: Optional[float] = None
    promo_bundle_profit: Optional[float] = None
    promo_profit_margin: Optional[float] = None
    estimated_revenue: float
    estimated_profit: float
    insight: str
    source: str


class BundlePeriodSummary(BaseModel):
    recommended_bundles: int
    average_lift: float
    average_confidence: float
    expected_revenue: float
    expected_profit: float
    average_revenue: Optional[float] = None
    average_profit: Optional[float] = None


class BundlePeriodAnalysisResponse(BaseModel):
    selected_date: str
    period_type: str
    period_start: str
    period_end: str
    period_label: str
    total: int
    page: int
    limit: int
    periods: List[str]
    summary: BundlePeriodSummary
    data: List[BundleItem]
