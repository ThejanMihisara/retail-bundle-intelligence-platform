from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models.user import User
from models.transaction import SalesTransaction
from services.model_service import model_service
from utils.dependencies import get_current_user
import pandas as pd
from datetime import datetime
import io

router = APIRouter(prefix="/api/sales", tags=["sales"])

REQUIRED_COLUMNS = [
    "invoice_id", "sale_date", "product_id", "product_name", 
    "category", "quantity_sold", "cost_price", "retail_price", 
    "total_revenue", "profit"
]

@router.get("")
async def list_sales(
    page: int = 1,
    limit: int = 50,
    category: str = None,
    search: str = None,
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    model_service.load_models()
    db_count = db.query(func.count(SalesTransaction.id)).scalar()

    if db_count and db_count > 0:
        query = db.query(SalesTransaction)
        if category:
            query = query.filter(SalesTransaction.category == category)
        if search:
            query = query.filter(SalesTransaction.product_name.ilike(f"%{search}%"))
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                query = query.filter(SalesTransaction.sale_date >= start_dt)
            except ValueError:
                pass
        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                query = query.filter(SalesTransaction.sale_date <= end_dt)
            except ValueError:
                pass

        total_records = query.count()
        sales_records = query.order_by(SalesTransaction.sale_date.desc()).offset((page - 1) * limit).limit(limit).all()

        return {
            "total": total_records,
            "page": page,
            "limit": limit,
            "data": [
                {
                    "invoice_id": r.invoice_id,
                    "sale_date": r.sale_date.isoformat(),
                    "product_id": r.product_id,
                    "product_name": r.product_name,
                    "category": r.category,
                    "quantity_sold": r.quantity_sold,
                    "cost_price": r.cost_price,
                    "retail_price": r.retail_price,
                    "total_revenue": r.total_revenue,
                    "profit": r.profit
                }
                for r in sales_records
            ]
        }
    else:
        # Fallback to model predictions data
        df = model_service.rf_predictions
        if df is not None:
            data_list = []
            for _, row in df.iterrows():
                product_name = str(row["product_name"])
                cat = str(row["category"])
                
                # Check filter matching
                if category and cat.lower() != category.lower():
                    continue
                if search and search.lower() not in product_name.lower():
                    continue
                
                data_list.append({
                    "invoice_id": f"INV-{row['product_id']}",
                    "sale_date": "2026-06-22T00:00:00",
                    "product_id": str(row["product_id"]),
                    "product_name": product_name,
                    "category": cat,
                    "quantity_sold": int(row["total_quantity_sold"]),
                    "cost_price": float(row["cost_price"]),
                    "retail_price": float(row["retail_price"]),
                    "total_revenue": float(row["total_revenue"]),
                    "profit": float(row["total_profit"])
                })
            
            total_records = len(data_list)
            paginated_data = data_list[(page - 1) * limit : page * limit]
            return {
                "total": total_records,
                "page": page,
                "limit": limit,
                "data": paginated_data
            }
        return {"total": 0, "page": page, "limit": limit, "data": []}

@router.get("/summary")
async def get_sales_summary(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    model_service.load_models()
    db_count = db.query(func.count(SalesTransaction.id)).scalar()

    if db_count and db_count > 0:
        stats = db.query(
            func.count(SalesTransaction.id).label("transaction_count"),
            func.sum(SalesTransaction.total_revenue).label("revenue"),
            func.sum(SalesTransaction.profit).label("profit"),
            func.sum(SalesTransaction.quantity_sold).label("quantity")
        ).first()

        total_rev = float(stats.revenue or 0.0)
        total_prof = float(stats.profit or 0.0)
        margin = (total_prof / total_rev * 100) if total_rev > 0 else 0.0

        return {
            "total_records": db_count,
            "total_revenue": round(total_rev, 2),
            "total_profit": round(total_prof, 2),
            "profit_margin": round(margin, 2),
            "quantity_sold": int(stats.quantity or 0)
        }
    else:
        df = model_service.rf_predictions
        if df is not None:
            total_rev = float(df["total_revenue"].sum())
            total_prof = float(df["total_profit"].sum())
            total_qty = int(df["total_quantity_sold"].sum())
            margin = (total_prof / total_rev * 100) if total_rev > 0 else 0.0
            return {
                "total_records": len(df),
                "total_revenue": round(total_rev, 2),
                "total_profit": round(total_prof, 2),
                "profit_margin": round(margin, 2),
                "quantity_sold": total_qty
            }
        return {
            "total_records": 0,
            "total_revenue": 0.0,
            "total_profit": 0.0,
            "profit_margin": 0.0,
            "quantity_sold": 0
        }

@router.get("/monthly")
async def get_sales_monthly(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    model_service.load_models()
    db_count = db.query(func.count(SalesTransaction.id)).scalar()

    historical = []
    if db_count and db_count > 0:
        results = db.query(
            func.date_format(SalesTransaction.sale_date, "%Y-%m").label("month"),
            func.sum(SalesTransaction.total_revenue).label("revenue"),
            func.sum(SalesTransaction.profit).label("profit"),
            func.sum(SalesTransaction.quantity_sold).label("quantity")
        ).group_by("month").order_by("month").all()

        historical = [
            {
                "month": r.month,
                "revenue": float(r.revenue or 0.0),
                "profit": float(r.profit or 0.0),
                "quantity": float(r.quantity or 0.0)
            }
            for r in results
        ]
    else:
        df = model_service.rf_predictions
        if df is None or len(df) == 0:
            total_monthly_qty = 5000.0
            total_monthly_rev = 150000.0
            total_monthly_prof = 15000.0
        else:
            total_monthly_qty = df["avg_monthly_quantity"].sum()
            total_monthly_rev = df["total_revenue"].sum() / 24 # 24 active months
            total_monthly_prof = df["total_profit"].sum() / 24
        
        # Generate 24-month historical baseline (2024-01 to 2025-12)
        months_list = []
        for year in [2024, 2025]:
            for m in range(1, 13):
                months_list.append(f"{year}-{m:02d}")
                
        base_shares = [0.9, 0.95, 1.05, 1.0, 1.1, 1.15, 1.0, 0.95, 1.05, 1.1, 1.2, 1.25]
        shares = base_shares + [s * 1.08 for s in base_shares] # Add 8% growth for 2025
        
        historical = [
            {
                "month": months_list[i],
                "revenue": round(total_monthly_rev * shares[i], 2),
                "profit": round(total_monthly_prof * shares[i], 2),
                "quantity": round(total_monthly_qty * shares[i], 2)
            }
            for i in range(len(months_list))
        ]

    return historical

@router.get("/categories")
async def get_sales_categories(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    model_service.load_models()
    db_count = db.query(func.count(SalesTransaction.id)).scalar()

    if db_count and db_count > 0:
        categories = db.query(SalesTransaction.category).distinct().all()
        return [c[0] for c in categories if c[0]]
    else:
        df = model_service.rf_predictions
        if df is not None:
            return sorted(df["category"].dropna().unique().tolist())
        return []

@router.post("/upload-csv")
async def upload_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    filename = file.filename or ""
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed.")
    
    try:
        content = await file.read()
        df = pd.read_csv(io.StringIO(content.decode("utf-8")))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to read CSV file: {e}")

    # Column verification
    detected = [str(col).strip() for col in df.columns]
    lower_to_actual = {col.lower(): col for col in detected}
    
    missing = [col for col in REQUIRED_COLUMNS if col not in lower_to_actual]
    if missing:
        raise HTTPException(
            status_code=422,
            detail={
                "message": f"Validation failed. Missing required columns: {', '.join(missing)}",
                "missing": missing,
                "detected": detected
            }
        )

    # Get column mappings case-insensitively
    col_mapping = {col: lower_to_actual[col] for col in REQUIRED_COLUMNS}

    # Fetch existing unique transaction keys to avoid duplicate inserts
    # Key format: (invoice_id, product_id, sale_date)
    existing_records = db.query(
        SalesTransaction.invoice_id,
        SalesTransaction.product_id,
        SalesTransaction.sale_date
    ).all()
    
    # Store standard date strings as keys for fast matching
    existing_keys = {
        (r.invoice_id, r.product_id, r.sale_date.strftime("%Y-%m-%d %H:%M:%S"))
        for r in existing_records
    }

    inserted_count = 0
    duplicate_count = 0
    errors = []

    # Process and save rows
    db_batch = []
    for idx, row in df.iterrows():
        try:
            inv_id = str(row[col_mapping["invoice_id"]]).strip()
            prod_id = str(row[col_mapping["product_id"]]).strip()
            raw_date = row[col_mapping["sale_date"]]
            
            # Parse date safely
            try:
                parsed_date = pd.to_datetime(raw_date)
                date_str = parsed_date.strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                errors.append(f"Row {idx+1}: Invalid date format '{raw_date}'")
                continue

            # Check duplicates
            key = (inv_id, prod_id, date_str)
            if key in existing_keys:
                duplicate_count += 1
                continue

            qty = int(row[col_mapping["quantity_sold"]])
            cost = float(row[col_mapping["cost_price"]])
            retail = float(row[col_mapping["retail_price"]])
            revenue = float(row[col_mapping["total_revenue"]])
            profit = float(row[col_mapping["profit"]])

            transaction = SalesTransaction(
                invoice_id=inv_id,
                sale_date=parsed_date,
                product_id=prod_id,
                product_name=str(row[col_mapping["product_name"]]).strip(),
                category=str(row[col_mapping["category"]]).strip(),
                quantity_sold=qty,
                cost_price=cost,
                retail_price=retail,
                total_revenue=revenue,
                profit=profit
            )
            
            db_batch.append(transaction)
            existing_keys.add(key) # Add to prevent internal file duplicates
            inserted_count += 1

            if len(db_batch) >= 1000:
                db.bulk_save_objects(db_batch)
                db.commit()
                db_batch = []

        except Exception as e:
            errors.append(f"Row {idx+1}: Data error - {e}")

    if db_batch:
        db.bulk_save_objects(db_batch)
        db.commit()

    return {
        "status": "success" if not errors else "partial_success",
        "inserted_count": inserted_count,
        "duplicate_count": duplicate_count,
        "total_rows_processed": len(df),
        "validation_errors": errors[:50] # return top 50 errors
    }


@router.delete("/clear")
async def clear_sales(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    try:
        db.query(SalesTransaction).delete()
        db.commit()
        return {"status": "success", "message": "All sales transactions deleted successfully from database"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear sales transactions: {e}"
        )
