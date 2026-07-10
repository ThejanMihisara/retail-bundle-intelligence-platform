from fastapi import APIRouter, Depends, HTTPException, Query
from database import get_db
from models.user import User
from services.model_service import model_service
from utils.dependencies import get_current_user
import pandas as pd
from typing import Optional, List

router = APIRouter(prefix="/api/products/movement", tags=["product-movement"])

def get_predictions_df():
    model_service.load_models()
    df = model_service.rf_predictions
    if df is None:
        raise HTTPException(status_code=503, detail="Product movement prediction data not available.")
    return df

@router.get("")
async def get_all_movement(
    page: int = 1,
    limit: int = 50,
    level: Optional[str] = None, # 'Fast Moving', 'Medium Moving', 'Slow Moving'
    search: Optional[str] = None,
    category: Optional[str] = None,
    sort_by: str = "total_revenue", # 'total_revenue', 'total_quantity_sold', 'total_profit', 'product_name'
    sort_desc: bool = True,
    _: User = Depends(get_current_user)
):
    df = get_predictions_df()
    
    # Filter
    filtered_df = df.copy()
    
    if level:
        # Match flex-tabs (Fast/Medium/Slow vs Fast Moving/Medium Moving/Slow Moving)
        if "moving" not in level.lower():
            level_str = f"{level.strip().title()} Moving"
        else:
            level_str = level.strip().title()
        filtered_df = filtered_df[filtered_df["predicted_movement_level"].str.lower() == level_str.lower()]
        
    if search:
        search_lower = search.lower()
        # Search by name or product_id
        filtered_df = filtered_df[
            filtered_df["product_name"].str.lower().str.contains(search_lower) | 
            filtered_df["product_id"].astype(str).str.contains(search_lower)
        ]
        
    if category:
        filtered_df = filtered_df[filtered_df["category"].str.lower() == category.lower()]
        
    # Sort
    if sort_by in filtered_df.columns:
        filtered_df = filtered_df.sort_values(sort_by, ascending=not sort_desc)
    elif sort_by == "product_name":
        filtered_df = filtered_df.sort_values("product_name", ascending=not sort_desc)
        
    total_records = len(filtered_df)
    
    # Paginate
    start_idx = (page - 1) * limit
    end_idx = page * limit
    paginated_df = filtered_df.iloc[start_idx:end_idx]
    
    # Convert to list of dicts
    records = []
    for _, row in paginated_df.iterrows():
        records.append({
            "product_id": str(row["product_id"]),
            "product_name": row["product_name"],
            "category": row["category"],
            "quantity_sold": int(row["total_quantity_sold"]),
            "revenue": float(row["total_revenue"]),
            "profit": float(row["total_profit"]),
            "movement_level": row["predicted_movement_level"], # 'Fast Moving', etc.
            "probabilities": {
                "fast": float(row.get("probability_fast_moving", 0.0)),
                "medium": float(row.get("probability_medium_moving", 0.0)),
                "slow": float(row.get("probability_slow_moving", 0.0))
            }
        })
        
    return {
        "total": total_records,
        "page": page,
        "limit": limit,
        "data": records
    }

@router.get("/fast")
async def get_fast_movement(page: int = 1, limit: int = 50, search: Optional[str] = None, _: User = Depends(get_current_user)):
    return await get_all_movement(page=page, limit=limit, level="Fast Moving", search=search)

@router.get("/medium")
async def get_medium_movement(page: int = 1, limit: int = 50, search: Optional[str] = None, _: User = Depends(get_current_user)):
    return await get_all_movement(page=page, limit=limit, level="Medium Moving", search=search)

@router.get("/slow")
async def get_slow_movement(page: int = 1, limit: int = 50, search: Optional[str] = None, _: User = Depends(get_current_user)):
    return await get_all_movement(page=page, limit=limit, level="Slow Moving", search=search)

@router.get("/summary")
async def get_movement_summary(_: User = Depends(get_current_user)):
    df = get_predictions_df()
    
    level_counts = df["predicted_movement_level"].value_counts()
    fast_count = int(level_counts.get("Fast Moving", 0))
    medium_count = int(level_counts.get("Medium Moving", 0))
    slow_count = int(level_counts.get("Slow Moving", 0))
    
    total_qty = float(df["total_quantity_sold"].sum())
    total_rev = float(df["total_revenue"].sum())
    total_prof = float(df["total_profit"].sum())
    
    return {
        "total_products": len(df),
        "fast_moving_count": fast_count,
        "medium_moving_count": medium_count,
        "slow_moving_count": slow_count,
        "avg_revenue": round(total_rev / len(df), 2) if len(df) > 0 else 0.0,
        "avg_profit": round(total_prof / len(df), 2) if len(df) > 0 else 0.0,
        "total_revenue": round(total_rev, 2),
        "total_profit": round(total_prof, 2),
        "total_quantity_sold": int(total_qty)
    }

@router.get("/search")
async def search_movement(query: str, limit: int = 10, _: User = Depends(get_current_user)):
    df = get_predictions_df()
    query_lower = query.lower()
    
    match = df[
        df["product_name"].str.lower().str.contains(query_lower) | 
        df["product_id"].astype(str).str.contains(query_lower)
    ].head(limit)
    
    records = []
    for _, row in match.iterrows():
        records.append({
            "product_id": str(row["product_id"]),
            "product_name": row["product_name"],
            "category": row["category"],
            "quantity_sold": int(row["total_quantity_sold"]),
            "revenue": float(row["total_revenue"]),
            "profit": float(row["total_profit"]),
            "movement_level": row["predicted_movement_level"]
        })
    return records
