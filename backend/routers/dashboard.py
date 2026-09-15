import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models.user import User
from models.transaction import SalesTransaction
from services.model_service import model_service
from services.product_movement_service import product_movement_service
from utils.dependencies import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

DASHBOARD_CACHE = {}
logger = logging.getLogger(__name__)


def clear_dashboard_cache():
    DASHBOARD_CACHE.clear()



def _db_has_data(db: Session) -> bool:
    return (db.query(func.count(SalesTransaction.id)).scalar() or 0) > 0


def _get_monthly_movement_counts() -> tuple[int, int, int]:
    try:
        df_rf = product_movement_service.get_predictions("2026-01-15", "month")
        level_counts = df_rf["predicted_movement_level"].value_counts()
        return (
            int(level_counts.get("Fast Moving", 0)),
            int(level_counts.get("Medium Moving", 0)),
            int(level_counts.get("Slow Moving", 0)),
        )
    except Exception as exc:
        logger.error("Could not load product movement counts for dashboard: %s", exc)
        return 0, 0, 0


def _get_total_predicted_bundles() -> int:
    try:
        model_service.load_models()
        df_bundles = model_service.fp_recommendations
        if df_bundles is None:
            return 0
        return int(len(df_bundles[df_bundles["product_count"] >= 4]))
    except Exception as exc:
        logger.error("Could not load predicted bundle count for dashboard: %s", exc)
        return 0


def _get_sales_kpis(db: Session) -> dict:
    if db:
        stats = db.query(
            func.sum(SalesTransaction.quantity_sold).label("total_sales"),
            func.sum(SalesTransaction.total_revenue).label("total_revenue"),
            func.sum(SalesTransaction.profit).label("total_profit"),
            func.count(func.distinct(SalesTransaction.invoice_id)).label("total_invoices"),
            func.count(func.distinct(SalesTransaction.product_id)).label("total_products"),
        ).first()

        return {
            "total_sales": int(stats.total_sales or 0),
            "total_revenue": round(float(stats.total_revenue or 0.0), 2),
            "total_profit": round(float(stats.total_profit or 0.0), 2),
            "total_invoices": int(stats.total_invoices or 0),
            "total_products": int(stats.total_products or 0),
        }

    return {
        "total_sales": 0,
        "total_revenue": 0.0,
        "total_profit": 0.0,
        "total_invoices": 0,
        "total_products": 0,
    }


@router.get("/sales-overview")
async def get_sales_overview(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """
    Returns only the uploaded-sales KPI summary needed for the first dashboard paint.
    Model and bundle values are loaded by the client after render.
    """
    cache_key = "sales-overview"
    if cache_key in DASHBOARD_CACHE:
        return DASHBOARD_CACHE[cache_key]

    result = {
        **_get_sales_kpis(db),
        "fast_moving_count": 0,
        "medium_moving_count": 0,
        "slow_moving_count": 0,
        "total_recommended_bundles": _get_total_predicted_bundles(),
    }
    DASHBOARD_CACHE[cache_key] = result
    return result


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
        
        total_sales = 0
        total_revenue = 0.0
        total_profit = 0.0
        total_invoices = 0
        total_products = 0

    
    fast_count = medium_count = slow_count = 0
    if total_products > 0:
        fast_count, medium_count, slow_count = _get_monthly_movement_counts()

    
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


@router.get("/sales-timeseries")
async def get_sales_timeseries(
    granularity: str = Query("month", pattern="^(day|week|month|year)$"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Returns chart data grouped directly from uploaded sales_transactions rows.
    """
    cache_key = ("sales-timeseries", granularity, start_date or "", end_date or "")
    if cache_key in DASHBOARD_CACHE:
        return DASHBOARD_CACHE[cache_key]

    query = db.query(SalesTransaction)
    if start_date:
        try:
            query = query.filter(SalesTransaction.sale_date >= datetime.fromisoformat(start_date))
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid start_date. Use YYYY-MM-DD.")
    if end_date:
        try:
            parsed_end = datetime.fromisoformat(end_date)
            query = query.filter(SalesTransaction.sale_date < parsed_end + timedelta(days=1))
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid end_date. Use YYYY-MM-DD.")

    label_formats = {
        "day": "%Y-%m-%d",
        "week": "%x-W%v",
        "month": "%Y-%m",
        "year": "%Y",
    }
    period = func.date_format(SalesTransaction.sale_date, label_formats[granularity])

    results = (
        query.with_entities(
            period.label("month"),
            func.min(SalesTransaction.sale_date).label("period_start"),
            func.sum(SalesTransaction.total_revenue).label("revenue"),
            func.sum(SalesTransaction.profit).label("profit"),
            func.sum(SalesTransaction.quantity_sold).label("quantity"),
        )
        .group_by(period)
        .order_by(func.min(SalesTransaction.sale_date))
        .all()
    )

    result = [
        {
            "month": r.month,
            "period_start": r.period_start.isoformat() if r.period_start else None,
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
