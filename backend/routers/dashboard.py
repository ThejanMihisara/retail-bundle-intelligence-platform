from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models.user import User
from models.transaction import SalesTransaction
from services.model_service import model_service
from utils.dependencies import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

DASHBOARD_CACHE = {}


def clear_dashboard_cache():
    DASHBOARD_CACHE.clear()



def _db_has_data(db: Session) -> bool:
    return (db.query(func.count(SalesTransaction.id)).scalar() or 0) > 0


@router.get("/overview")
async def get_overview(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """
    Returns KPI summary entirely from uploaded MySQL data.
    Returns all-zeros when no CSV has been uploaded — never falls back to training data.
    Movement counts come from the RF model inference on DB data when available,
    or from the pre-trained CSV predictions when the DB is populated but RF hasn't re-run.
    Bundle count always comes from the pre-trained FP-Growth recommendations.
    """
    cache_key = "overview"
    if cache_key in DASHBOARD_CACHE:
        return DASHBOARD_CACHE[cache_key]

    model_service.load_models()

    # --- Sales KPIs from MySQL ---
    if db:
        stats = db.query(
            func.sum(SalesTransaction.quantity_sold).label("total_sales"),
            func.sum(SalesTransaction.total_revenue).label("total_revenue"),
            func.sum(SalesTransaction.profit).label("total_profit"),
            func.count(func.distinct(SalesTransaction.invoice_id)).label("total_invoices"),
            func.count(func.distinct(SalesTransaction.product_id)).label("total_products"),
        ).first()

        total_sales = int(stats.total_sales or 0)
        total_revenue = float(stats.total_revenue or 0.0)
        total_profit = float(stats.total_profit or 0.0)
        total_invoices = int(stats.total_invoices or 0)
        total_products = int(stats.total_products or 0)
    else:
        # Strict empty state — no fallback to training data
        total_sales = 0
        total_revenue = 0.0
        total_profit = 0.0
        total_invoices = 0
        total_products = 0

    # --- Movement counts ---
    # When DB has data: use live RF predictions if available, else pre-trained CSV
    fast_count = medium_count = slow_count = 0
    if total_products > 0:
        # Check if live_rf_predictions have been computed (set by products router)
        live_rf = getattr(model_service, "live_rf_predictions", None)
        df_rf = live_rf if live_rf is not None else model_service.rf_predictions
        if df_rf is not None:
            level_counts = df_rf["predicted_movement_level"].value_counts()
            fast_count = int(level_counts.get("Fast Moving", 0))
            medium_count = int(level_counts.get("Medium Moving", 0))
            slow_count = int(level_counts.get("Slow Moving", 0))

    # --- Bundle count from FP-Growth (always pre-trained, no need for live recompute) ---
    total_bundles = 0
    df_bundles = model_service.fp_recommendations
    if df_bundles is not None:
        total_bundles = len(df_bundles[df_bundles["product_count"] >= 4])

    result = {
        "total_sales": total_sales,
        "total_revenue": round(total_revenue, 2),
        "total_profit": round(total_profit, 2),
        "total_invoices": total_invoices,
        "total_products": total_products,
        "fast_moving_count": fast_count,
        "medium_moving_count": medium_count,
        "slow_moving_count": slow_count,
        "total_recommended_bundles": total_bundles,
    }
    DASHBOARD_CACHE[cache_key] = result
    return result


@router.get("/monthly-sales")
async def get_monthly_sales(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """
    Returns monthly revenue/profit/quantity from MySQL data only.
    Returns an empty array when no CSV has been uploaded.
    """
    cache_key = "monthly-sales"
    if cache_key in DASHBOARD_CACHE:
        return DASHBOARD_CACHE[cache_key]

    results = db.query(
        func.date_format(SalesTransaction.sale_date, "%Y-%m").label("month"),
        func.sum(SalesTransaction.total_revenue).label("revenue"),
        func.sum(SalesTransaction.profit).label("profit"),
        func.sum(SalesTransaction.quantity_sold).label("quantity"),
    ).group_by("month").order_by("month").all()

    result = [
        {
            "month": r.month,
            "revenue": round(float(r.revenue or 0.0), 2),
            "profit": round(float(r.profit or 0.0), 2),
            "quantity": int(r.quantity or 0),
        }
        for r in results
    ]
    DASHBOARD_CACHE[cache_key] = result
    return result


@router.get("/category-performance")
async def get_category_performance(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """
    Returns revenue/profit/quantity grouped by category from MySQL.
    Returns empty array when no CSV uploaded.
    """
    cache_key = "category-performance"
    if cache_key in DASHBOARD_CACHE:
        return DASHBOARD_CACHE[cache_key]

    results = db.query(
        SalesTransaction.category.label("category"),
        func.sum(SalesTransaction.total_revenue).label("revenue"),
        func.sum(SalesTransaction.profit).label("profit"),
        func.sum(SalesTransaction.quantity_sold).label("quantity"),
    ).group_by(SalesTransaction.category).order_by(
        func.sum(SalesTransaction.total_revenue).desc()
    ).all()

    result = [
        {
            "category": r.category,
            "revenue": round(float(r.revenue or 0.0), 2),
            "profit": round(float(r.profit or 0.0), 2),
            "quantity": int(r.quantity or 0),
        }
        for r in results
    ]
    DASHBOARD_CACHE[cache_key] = result
    return result


@router.get("/top-products")
async def get_top_products(limit: int = 10, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """
    Returns top products by profit from MySQL.
    Returns empty array when no CSV uploaded.
    """
    cache_key = f"top-products-{limit}"
    if cache_key in DASHBOARD_CACHE:
        return DASHBOARD_CACHE[cache_key]

    results = db.query(
        SalesTransaction.product_id,
        SalesTransaction.product_name,
        SalesTransaction.category,
        func.sum(SalesTransaction.quantity_sold).label("quantity_sold"),
        func.sum(SalesTransaction.total_revenue).label("revenue"),
        func.sum(SalesTransaction.profit).label("profit"),
    ).group_by(
        SalesTransaction.product_id,
        SalesTransaction.product_name,
        SalesTransaction.category,
    ).order_by(func.sum(SalesTransaction.profit).desc()).limit(limit).all()

    result = [
        {
            "product_id": r.product_id,
            "product_name": r.product_name,
            "category": r.category,
            "quantity_sold": int(r.quantity_sold or 0),
            "revenue": round(float(r.revenue or 0.0), 2),
            "profit": round(float(r.profit or 0.0), 2),
        }
        for r in results
    ]
    DASHBOARD_CACHE[cache_key] = result
    return result


@router.get("/recent-insights")
async def get_recent_insights(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """
    Returns AI insights derived from actual model predictions + DB data.
    When no data is uploaded, returns a welcome/onboarding message.
    """
    cache_key = "recent-insights"
    if cache_key in DASHBOARD_CACHE:
        return DASHBOARD_CACHE[cache_key]

    model_service.load_models()
    insights = []

    if not _db_has_data(db):
        result = [
            {"id": 1, "type": "info", "text": "Welcome to BundleMind. Upload a retail sales CSV to start generating live AI predictions and insights."},
            {"id": 2, "type": "success", "text": "FP-Growth and Random Forest models are loaded and ready. Import your historical transaction data to begin analysis."},
        ]
        DASHBOARD_CACHE[cache_key] = result
        return result

    # Use live RF predictions if available
    live_rf = getattr(model_service, "live_rf_predictions", None)
    df_rf = live_rf if live_rf is not None else model_service.rf_predictions

    if df_rf is not None:
        slow_products = df_rf[df_rf["predicted_movement_level"] == "Slow Moving"]
        fast_products = df_rf[df_rf["predicted_movement_level"] == "Fast Moving"]

        if len(slow_products) > 0:
            top_slow = slow_products.sort_values("total_revenue", ascending=False).iloc[0]
            insights.append({
                "id": 1,
                "type": "warning",
                "text": f"Slow Moving Alert: '{top_slow['product_name']}' has low inventory velocity. Consider bundle promotions to accelerate sales.",
            })
        if len(fast_products) > 0:
            top_fast = fast_products.sort_values("total_revenue", ascending=False).iloc[0]
            rev = round(float(top_fast["total_revenue"]), 2)
            insights.append({
                "id": 2,
                "type": "success",
                "text": f"Top Performer: '{top_fast['product_name']}' generates the highest revenue of Rs.{rev:,.2f}. Prioritize restocking.",
            })

    df_bundles = model_service.fp_recommendations
    if df_bundles is not None and len(df_bundles) > 0:
        top_bundle = df_bundles.sort_values("avg_pair_lift", ascending=False).iloc[0]
        insights.append({
            "id": 3,
            "type": "info",
            "text": f"Bundle Opportunity: Bundle #{int(top_bundle['bundle_id'])} delivers a lift of {round((float(top_bundle['avg_pair_lift']) - 1) * 100, 1)}% across {int(top_bundle['product_count'])} items.",
        })

    if not insights:
        insights = [
            {"id": 1, "type": "info", "text": "Models loaded successfully. Run product movement analysis to generate personalized insights."},
        ]

    DASHBOARD_CACHE[cache_key] = insights
    return insights
