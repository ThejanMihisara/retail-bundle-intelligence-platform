from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_db
from models.user import User
from services.model_service import model_service
from utils.dependencies import get_current_user
import pandas as pd
from typing import Optional, List
from schemas.bundle import BundlePeriodAnalysisResponse
from services.product_movement_service import product_movement_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/bundles", tags=["bundle-recommendations"])

def get_recommendations_df():
    model_service.load_models()
    df = model_service.fp_recommendations
    if df is None:
        raise HTTPException(status_code=503, detail="Bundle recommendation data not available.")
    return df

def get_rules_df():
    model_service.load_models()
    df = model_service.fp_rules
    if df is None:
        raise HTTPException(status_code=503, detail="Association rules data not available.")
    return df

def get_period_recommendations_df():
    model_service.load_models()
    df = model_service.fp_period_recommendations
    if df is None:
        raise HTTPException(status_code=503, detail="Bundle period recommendation data not available.")
    return df

def format_bundle_row(row):
    products_names = [name.strip() for name in str(row["product_names"]).split("|") if name.strip()]
    products_ids = [pid.strip() for pid in str(row["product_ids"]).split(",") if pid.strip()]
    
    products = []
    for i in range(min(len(products_names), len(products_ids))):
        products.append({
            "product_id": products_ids[i],
            "product_name": products_names[i]
        })
        
    return {
        "bundle_id": int(row["bundle_id"]),
        "product_count": int(row["product_count"]),
        "products": products,
        "categories": [c.strip() for c in str(row["categories"]).split("|") if c.strip()],
        "support": float(row.get("fp_growth_support", 0.0)),
        "confidence": float(row.get("avg_pair_confidence", 0.0)),
        "lift": float(row.get("avg_pair_lift", 1.0)),
        "estimated_revenue": float(row.get("estimated_bundle_retail_price", 0.0)),
        "estimated_profit": float(row.get("avg_profit_per_unit", 0.0)) * int(row["product_count"]),
        "source": row.get("source", "fp_growth")
    }

def format_period_bundle_row(row):
    products_names = [name.strip() for name in str(row["product_names"]).split("|") if name.strip()]
    products_ids = [pid.strip() for pid in str(row["product_ids"]).split(",") if pid.strip()]

    products = []
    for i in range(min(len(products_names), len(products_ids))):
        products.append({
            "product_id": products_ids[i],
            "product_name": products_names[i],
        })

    return {
        "period_type": str(row["period_type"]),
        "period_start": str(row["period_start"]),
        "period_label": str(row["period_label"]),
        "bundle_rank": int(row["bundle_rank"]),
        "bundle_id": int(row["bundle_id"]),
        "product_count": int(row["product_count"]),
        "products": products,
        "categories": [c.strip() for c in str(row["categories"]).split("|") if c.strip()],
        "period_invoice_count": int(row.get("period_invoice_count", 0)),
        "matched_invoice_count": int(row.get("matched_invoice_count", 0)),
        "exact_bundle_invoice_count": int(row.get("exact_bundle_invoice_count", 0)),
        "support": float(row.get("support", 0.0)),
        "exact_support": float(row.get("exact_support", 0.0)),
        "attachment_rate": float(row.get("attachment_rate", 0.0)),
        "avg_overlap_products": float(row.get("avg_overlap_products", 0.0)),
        "lift": float(row.get("global_lift", 1.0)),
        "confidence": float(row.get("global_confidence", 0.0)),
        "score": float(row.get("period_bundle_score", 0.0)),
        "estimated_revenue": float(row.get("estimated_bundle_retail_price", 0.0)),
        "estimated_profit": float(row.get("estimated_bundle_profit", 0.0)),
        "period_revenue": float(row.get("period_revenue", 0.0)),
        "period_profit": float(row.get("period_profit", 0.0)),
        "period_quantity": float(row.get("period_quantity", 0.0)),
        "revenue_share": float(row.get("revenue_share", 0.0)),
        "profit_share": float(row.get("profit_share", 0.0)),
        "growth_pct": float(row.get("growth_pct", 0.0)),
        "insight": str(row.get("insight", "")),
    }

@router.get("")
async def get_bundles(
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
    category: Optional[str] = None,
    min_lift: Optional[float] = None,
    _: User = Depends(get_current_user)
):
    df = get_recommendations_df()
    
    # Requirement: "Each bundle must show 4 or more products"
    filtered_df = df[df["product_count"] >= 4].copy()
    
    if category:
        filtered_df = filtered_df[filtered_df["categories"].str.lower().str.contains(category.lower())]
        
    if search:
        search_lower = search.lower()
        filtered_df = filtered_df[
            filtered_df["product_names"].str.lower().str.contains(search_lower) | 
            filtered_df["product_ids"].astype(str).str.contains(search_lower)
        ]
        
    if min_lift is not None:
        filtered_df = filtered_df[filtered_df["avg_pair_lift"] >= min_lift]
        
    # Sort by lift descending
    filtered_df = filtered_df.sort_values("avg_pair_lift", ascending=False)
    
    total_records = len(filtered_df)
    
    start_idx = (page - 1) * limit
    end_idx = page * limit
    paginated_df = filtered_df.iloc[start_idx:end_idx]
    
    records = [format_bundle_row(row) for _, row in paginated_df.iterrows()]
    
    return {
        "total": total_records,
        "page": page,
        "limit": limit,
        "data": records
    }

@router.get("/recommend")
async def recommend_bundles(
    product: str, # ID or Name
    limit: int = 5,
    _: User = Depends(get_current_user)
):
    df = get_recommendations_df()
    # Filter bundles with 4 or more products
    filtered_df = df[df["product_count"] >= 4].copy()
    
    product_lower = product.lower()
    
    # Find bundles containing the product
    match_mask = filtered_df["product_names"].str.lower().str.contains(product_lower) | \
                 filtered_df["product_ids"].astype(str).str.contains(product_lower)
                 
    matching_df = filtered_df[match_mask]
    matching_df = matching_df.sort_values("avg_pair_lift", ascending=False).head(limit)
    
    return [format_bundle_row(row) for _, row in matching_df.iterrows()]

@router.get("/search")
async def search_bundles(query: str, limit: int = 10, _: User = Depends(get_current_user)):
    return await recommend_bundles(product=query, limit=limit)

@router.get("/summary")
async def get_bundles_summary(_: User = Depends(get_current_user)):
    df = get_recommendations_df()
    
    # Limit calculation to >= 4 products
    filtered_df = df[df["product_count"] >= 4]
    
    if len(filtered_df) == 0:
        return {
            "total_bundles": 0,
            "avg_lift": 0.0,
            "avg_confidence": 0.0,
            "avg_revenue": 0.0,
            "avg_profit": 0.0
        }
        
    avg_lift = float(filtered_df["avg_pair_lift"].mean())
    avg_conf = float(filtered_df["avg_pair_confidence"].mean())
    avg_rev = float(filtered_df["estimated_bundle_retail_price"].mean())
    avg_profit_per_unit = filtered_df["avg_profit_per_unit"].mean()
    avg_product_count = filtered_df["product_count"].mean()
    avg_prof = float(avg_profit_per_unit * avg_product_count)
    
    return {
        "total_bundles": len(filtered_df),
        "avg_lift": round(avg_lift, 2),
        "avg_confidence": round(avg_conf, 4),
        "avg_revenue": round(avg_rev, 2),
        "avg_profit": round(avg_prof, 2)
    }

@router.get("/rules")
async def get_rules(
    page: int = 1,
    limit: int = 50,
    search: Optional[str] = None,
    min_confidence: Optional[float] = None,
    _: User = Depends(get_current_user)
):
    df = get_rules_df()
    
    filtered_df = df.copy()
    
    if search:
        search_lower = search.lower()
        filtered_df = filtered_df[
            filtered_df["antecedent_product_names"].str.lower().str.contains(search_lower) | 
            filtered_df["consequent_product_names"].str.lower().str.contains(search_lower)
        ]
        
    if min_confidence is not None:
        filtered_df = filtered_df[filtered_df["confidence"] >= min_confidence]
        
    # Sort by lift descending
    filtered_df = filtered_df.sort_values("lift", ascending=False)
    
    total_records = len(filtered_df)
    
    start_idx = (page - 1) * limit
    end_idx = page * limit
    paginated_df = filtered_df.iloc[start_idx:end_idx]
    
    records = []
    for _, row in paginated_df.iterrows():
        antecedents = [item.strip() for item in str(row["antecedent_product_names"]).split("|") if item.strip()]
        consequents = [item.strip() for item in str(row["consequent_product_names"]).split("|") if item.strip()]
        records.append({
            "rule_id": int(row["rule_id"]),
            "antecedents": antecedents,
            "consequents": consequents,
            "support": float(row["support"]),
            "confidence": float(row["confidence"]),
            "lift": float(row["lift"]),
            "leverage": float(row.get("leverage", 0.0)),
            "conviction": float(row.get("conviction", 0.0))
        })
        
    return {
        "total": total_records,
        "page": page,
        "limit": limit,
        "data": records
    }

from datetime import datetime, timedelta
import math
import numpy as np

def make_json_safe(v, default=0.0):
    if v is None:
        return default
    try:
        if isinstance(v, float):
            if math.isnan(v) or math.isinf(v):
                return default
            return v
        if isinstance(v, (int, str, list, dict)):
            return v
        if isinstance(v, np.generic):
            val = v.item()
            if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
                return default
            return val
        return v
    except Exception:
        return default

@router.get("/period-analysis", response_model=BundlePeriodAnalysisResponse)
async def get_period_bundle_analysis(
    period_type: str = Query("day", pattern="^(day|week|month)$"),
    target_date: Optional[str] = None,
    page: int = 1,
    limit: int = 12,
    search: Optional[str] = None,
    category: Optional[str] = None,
    movement: Optional[str] = None,
    min_lift: Optional[float] = None,
    min_confidence: Optional[float] = None,
    _: User = Depends(get_current_user)
):
    # Parse target date (fallback to current date)
    if not target_date:
        target_date = datetime.now().strftime("%Y-%m-%d")
        
    try:
        target_dt = datetime.strptime(target_date, "%Y-%m-%d")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")

    # Calculate period bounds and label
    if period_type.lower() == "day":
        period_start = target_date
        period_end = target_date
        period_label = f"{target_dt.day} {target_dt.strftime('%B')} {target_dt.year}"
    elif period_type.lower() == "week":
        start_of_week = target_dt - timedelta(days=target_dt.weekday())
        end_of_week = start_of_week + timedelta(days=6)
        period_start = start_of_week.strftime("%Y-%m-%d")
        period_end = end_of_week.strftime("%Y-%m-%d")
        period_label = f"{start_of_week.day} {start_of_week.strftime('%b')} {start_of_week.year} - {end_of_week.day} {end_of_week.strftime('%b')} {end_of_week.year}"
    else:  # month
        start_of_month = target_dt.replace(day=1)
        next_month = target_dt.replace(day=28) + timedelta(days=4)
        end_of_month = next_month - timedelta(days=next_month.day)
        period_start = start_of_month.strftime("%Y-%m-%d")
        period_end = end_of_month.strftime("%Y-%m-%d")
        period_label = target_dt.strftime("%B %Y")

    # Load model and fallbacks
    model_service.load_models()
    
    if model_service.fp_recommendations is None:
        raise HTTPException(status_code=503, detail="Bundle recommendations data is missing or corrupted.")

    df_csv = model_service.fp_period_recommendations
    csv_match = pd.DataFrame()
    if df_csv is not None and not df_csv.empty:
        csv_match = df_csv[
            (df_csv["period_type"].str.lower() == period_type.lower()) &
            (df_csv["period_start"] == period_start)
        ]

    # Build necessary lookups
    product_profile = model_service.fp_product_profile
    movement_lookup = {}
    price_lookup = {}
    product_lookup = {}

    # Query dynamic product movement classifications from ProductMovementService
    try:
        rf_predictions = product_movement_service.get_predictions(target_date, period_type)
        movement_lookup = dict(zip(rf_predictions["product_id"].astype(str), rf_predictions["predicted_movement_level"]))
    except Exception as e:
        logger.error(f"Failed to load dynamic RF predictions for bundles: {e}")
        movement_lookup = {}

    if product_profile is not None:
        for _, row in product_profile.iterrows():
            pid = str(row["product_id"])
            price_lookup[pid] = float(row.get("average_retail_price", 0.0))
            product_lookup[pid] = {
                "product_id": pid,
                "product_name": str(row.get("product_name", "")),
                "category": str(row.get("category", "General Grocery"))
            }
            if pid not in movement_lookup:
                lbl = row.get("movement_label", "Fast")
                if "moving" not in str(lbl).lower():
                    movement_lookup[pid] = f"{lbl} Moving"
                else:
                    movement_lookup[pid] = str(lbl)

    # Build static bundle recommendations lookup
    bundle_recs_lookup = {}
    if model_service.fp_recommendations is not None:
        for _, row in model_service.fp_recommendations.iterrows():
            bundle_recs_lookup[int(row["bundle_id"])] = row

    results_list = []

    if not csv_match.empty:
        for _, row in csv_match.iterrows():
            pids = [pid.strip() for pid in str(row["product_ids"]).split(",") if pid.strip()]
            products_list = []
            for pid in pids:
                p_info = product_lookup.get(pid)
                products_list.append({
                    "product_id": pid,
                    "product_name": p_info["product_name"] if p_info else f"Product {pid}",
                    "category": p_info["category"] if p_info else "General Grocery",
                    "movement_label": movement_lookup.get(pid, "Fast Moving"),
                    "retail_price": make_json_safe(price_lookup.get(pid, 0.0))
                })

            cats = list(set(p["category"] for p in products_list))
            mv_lbls = [p["movement_label"] for p in products_list]

            fast_c = sum(1 for p in products_list if p["movement_label"] == "Fast Moving")
            med_c = sum(1 for p in products_list if p["movement_label"] == "Medium Moving")
            slow_c = sum(1 for p in products_list if p["movement_label"] == "Slow Moving")

            # Validation checks:
            # - product_count must be between 4 and 6
            if not (4 <= len(products_list) <= 6):
                continue
            # - every product ID must be unique inside the bundle
            if len(set(pids)) != len(pids):
                continue
            # - fast_product_count must be at least 1
            # - slow_product_count must be at least 1
            if fast_c < 1 or slow_c < 1:
                continue

            b_rec = bundle_recs_lookup.get(int(row["bundle_id"]))
            pair_sup = float(b_rec["pair_support"]) if b_rec is not None and "pair_support" in b_rec else float(row.get("fp_growth_support", 0.0))

            results_list.append({
                "bundle_id": int(row["bundle_id"]),
                "bundle_rank": int(row["bundle_rank"]),
                "product_count": len(products_list),
                "products": products_list,
                "categories": cats,
                "movement_labels": mv_lbls,
                "fast_product_count": fast_c,
                "medium_product_count": med_c,
                "slow_product_count": slow_c,
                "support": make_json_safe(row.get("fp_growth_support", 0.0)),
                "pair_support": make_json_safe(pair_sup),
                "confidence": make_json_safe(row.get("avg_pair_confidence", 0.0)),
                "lift": make_json_safe(row.get("avg_pair_lift", 1.0)),
                "graph_density": make_json_safe(row.get("graph_density", 0.0)),
                "test_attachment_rate": make_json_safe(row.get("test_attachment_rate", 0.0)),
                "seasonal_demand_score": make_json_safe(row.get("seasonal_demand_score", 0.0)),
                "score": make_json_safe(row.get("period_bundle_score", 0.0)),
                "estimated_revenue": make_json_safe(row.get("estimated_bundle_retail_price", 0.0)),
                "estimated_profit": make_json_safe(row.get("estimated_bundle_profit", 0.0)),
                "insight": str(row.get("insight", "")),
                "source": str(row.get("source", "fp_growth_seasonal"))
            })
    else:
        if model_service.fp_model is None:
            raise HTTPException(status_code=503, detail="Dynamic bundle recommendation model not loaded.")

        candidates = model_service.fp_recommendations
        month_profile = model_service.fp_month_profile
        week_profile = model_service.fp_week_profile
        daily_quantity = model_service.fp_daily_quantity

        total_qty_in_window = 0
        if period_type.lower() == "day" and daily_quantity is not None:
            doy = target_dt.timetuple().tm_yday
            doy_window = []
            for i in range(-7, 8):
                d = doy + i
                if d < 1:
                    d += 365
                elif d > 365:
                    d -= 365
                doy_window.append(d)

            for d in doy_window:
                try:
                    total_qty_in_window += daily_quantity.loc[d].sum()
                except KeyError:
                    pass
            if total_qty_in_window == 0:
                total_qty_in_window = 1

        for _, row in candidates.iterrows():
            pids = [pid.strip() for pid in str(row["product_ids"]).split(",") if pid.strip()]
            products_list = []
            for pid in pids:
                p_info = product_lookup.get(pid)
                products_list.append({
                    "product_id": pid,
                    "product_name": p_info["product_name"] if p_info else f"Product {pid}",
                    "category": p_info["category"] if p_info else "General Grocery",
                    "movement_label": movement_lookup.get(pid, "Fast Moving"),
                    "retail_price": make_json_safe(price_lookup.get(pid, 0.0))
                })

            cats = list(set(p["category"] for p in products_list))
            mv_lbls = [p["movement_label"] for p in products_list]

            fast_c = sum(1 for p in products_list if p["movement_label"] == "Fast Moving")
            med_c = sum(1 for p in products_list if p["movement_label"] == "Medium Moving")
            slow_c = sum(1 for p in products_list if p["movement_label"] == "Slow Moving")

            # Validation checks:
            # - product_count must be between 4 and 6
            if not (4 <= len(products_list) <= 6):
                continue
            # - every product ID must be unique inside the bundle
            if len(set(pids)) != len(pids):
                continue
            # - fast_product_count must be at least 1
            # - slow_product_count must be at least 1
            if fast_c < 1 or slow_c < 1:
                continue

            sds_final = 0.0
            if period_type.lower() == "month" and month_profile is not None:
                m = target_dt.month
                vals = []
                for pid in pids:
                    try:
                        vals.append(month_profile.loc[(m, pid)])
                    except KeyError:
                        vals.append(0.0)
                sds_final = (sum(vals) / len(pids) if pids else 0.0) * 0.85
            elif period_type.lower() == "week" and week_profile is not None:
                iso_w = target_dt.isocalendar()[1]
                vals = []
                for pid in pids:
                    try:
                        vals.append(week_profile.loc[(iso_w, pid)])
                    except KeyError:
                        vals.append(0.0)
                sds_final = (sum(vals) / len(pids) if pids else 0.0) * 0.87
            elif period_type.lower() == "day" and daily_quantity is not None:
                shares = []
                for pid in pids:
                    pq = 0
                    for d in doy_window:
                        try:
                            pq += daily_quantity.loc[(d, pid)]
                        except KeyError:
                            pass
                    shares.append(pq / total_qty_in_window)
                sds_final = (sum(shares) / len(pids) if pids else 0.0) * 0.87

            base_score = float(row.get("base_bundle_score", 0.5))
            score = base_score + 15.0 * sds_final

            insight = f"{fast_c} fast + {med_c} medium + {slow_c} slow products; seasonally ranked for {period_label}."
            insight += " (Optimized Fast/Slow attachment)"

            results_list.append({
                "bundle_id": int(row["bundle_id"]),
                "bundle_rank": 0,
                "product_count": len(products_list),
                "products": products_list,
                "categories": cats,
                "movement_labels": mv_lbls,
                "fast_product_count": fast_c,
                "medium_product_count": med_c,
                "slow_product_count": slow_c,
                "support": make_json_safe(row.get("fp_growth_support", 0.0)),
                "pair_support": make_json_safe(row.get("pair_support", 0.0)),
                "confidence": make_json_safe(row.get("avg_pair_confidence", 0.0)),
                "lift": make_json_safe(row.get("avg_pair_lift", 1.0)),
                "graph_density": make_json_safe(row.get("graph_density", 0.0)),
                "test_attachment_rate": make_json_safe(row.get("test_attachment_rate", 0.0)),
                "seasonal_demand_score": make_json_safe(sds_final),
                "score": make_json_safe(score),
                "estimated_revenue": make_json_safe(row.get("estimated_bundle_retail_price", 0.0)),
                "estimated_profit": make_json_safe(row.get("estimated_bundle_profit", 0.0)),
                "insight": insight,
                "source": "fp_growth_seasonal"
            })

        results_list.sort(key=lambda x: x["score"], reverse=True)
        for idx, item in enumerate(results_list):
            item["bundle_rank"] = idx + 1

    if min_lift is not None:
        results_list = [x for x in results_list if x["lift"] >= min_lift]
    if min_confidence is not None:
        results_list = [x for x in results_list if x["confidence"] >= min_confidence]
    if category:
        cat_lower = category.lower()
        results_list = [x for x in results_list if any(cat_lower in p["category"].lower() for p in x["products"])]
    if movement:
        mov_lower = movement.lower()
        results_list = [x for x in results_list if any(mov_lower in p["movement_label"].lower() for p in x["products"])]
    if search:
        search_lower = search.lower()
        results_list = [x for x in results_list if any(
            search_lower in p["product_name"].lower() or 
            search_lower in p["product_id"].lower() 
            for p in x["products"]
        )]

    total_records = len(results_list)
    start_idx = (page - 1) * limit
    paginated_results = results_list[start_idx:start_idx + limit]

    avg_lift = 0.0
    avg_conf = 0.0
    avg_rev = 0.0
    avg_prof = 0.0
    
    if total_records > 0:
        avg_lift = sum(x["lift"] for x in results_list) / total_records
        avg_conf = sum(x["confidence"] for x in results_list) / total_records
        avg_rev = sum(x["estimated_revenue"] for x in results_list) / total_records
        avg_prof = sum(x["estimated_profit"] for x in results_list) / total_records

    period_summary = {
        "recommended_bundles": total_records,
        "average_lift": make_json_safe(round(avg_lift, 2), 0.0),
        "average_confidence": make_json_safe(round(avg_conf, 4), 0.0),
        "expected_revenue": make_json_safe(round(avg_rev, 2), 0.0),
        "expected_profit": make_json_safe(round(avg_prof, 2), 0.0),
        "average_revenue": make_json_safe(round(avg_rev, 2), 0.0),
        "average_profit": make_json_safe(round(avg_prof, 2), 0.0)
    }

    periods = []
    if df_csv is not None and not df_csv.empty:
        periods = (
            df_csv[df_csv["period_type"].str.lower() == period_type.lower()]["period_label"]
            .dropna()
            .astype(str)
            .drop_duplicates()
            .tolist()
        )
    if period_label not in periods:
        periods.append(period_label)
    periods.sort()

    return {
        "selected_date": target_date,
        "period_type": period_type,
        "period_start": period_start,
        "period_end": period_end,
        "period_label": period_label,
        "total": total_records,
        "page": page,
        "limit": limit,
        "periods": periods,
        "summary": period_summary,
        "data": paginated_results
    }

@router.get("/{bundle_id}")
async def get_bundle_by_id(bundle_id: int, _: User = Depends(get_current_user)):
    df = get_recommendations_df()
    match = df[df["bundle_id"] == bundle_id]
    if match.empty:
        raise HTTPException(status_code=404, detail=f"Bundle #{bundle_id} not found.")
    return format_bundle_row(match.iloc[0])
