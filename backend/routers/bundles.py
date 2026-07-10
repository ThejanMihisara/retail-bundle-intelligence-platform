from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_db
from models.user import User
from services.model_service import model_service
from utils.dependencies import get_current_user
import pandas as pd
from typing import Optional, List

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

@router.get("/{bundle_id}")
async def get_bundle_by_id(bundle_id: int, _: User = Depends(get_current_user)):
    df = get_recommendations_df()
    match = df[df["bundle_id"] == bundle_id]
    if match.empty:
        raise HTTPException(status_code=404, detail=f"Bundle #{bundle_id} not found.")
    return format_bundle_row(match.iloc[0])
