import csv
import io
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models.transaction import SalesTransaction
from models.user import User
from services.model_service import model_service
from utils.dependencies import get_current_user
from routers.dashboard import clear_dashboard_cache

router = APIRouter(prefix="/api/sales", tags=["sales"])
SALES_CACHE: dict[tuple, object] = {}


def _clear_sales_cache() -> None:
    SALES_CACHE.clear()


def _apply_sales_filters(query, search: Optional[str] = None, category: Optional[str] = None, start_date: Optional[str] = None, end_date: Optional[str] = None):
    if search:
        query = query.filter(
            SalesTransaction.product_name.ilike(f"%{search}%")
            | SalesTransaction.product_id.ilike(f"%{search}%")
            | SalesTransaction.invoice_id.ilike(f"%{search}%")
        )
    if category:
        query = query.filter(SalesTransaction.category.ilike(category))
    if start_date:
        try:
            query = query.filter(SalesTransaction.sale_date >= datetime.fromisoformat(start_date))
        except ValueError:
            pass
    if end_date:
        try:
            query = query.filter(SalesTransaction.sale_date <= datetime.fromisoformat(end_date))
        except ValueError:
            pass
    return query


# ---------------------------------------------------------------------------
# GET /api/sales  — paginated transaction list
# ---------------------------------------------------------------------------
@router.get("")
async def get_sales(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=50000),
    search: Optional[str] = None,
    category: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    include_total: bool = Query(True),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = _apply_sales_filters(db.query(SalesTransaction), search, category, start_date, end_date)

    total = query.count() if include_total else 0
    records = (
        query.with_entities(
            SalesTransaction.id,
            SalesTransaction.invoice_id,
            SalesTransaction.sale_date,
            SalesTransaction.product_id,
            SalesTransaction.product_name,
            SalesTransaction.category,
            SalesTransaction.quantity_sold,
            SalesTransaction.cost_price,
            SalesTransaction.retail_price,
            SalesTransaction.total_revenue,
            SalesTransaction.profit,
        )
        .order_by(SalesTransaction.sale_date.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "data": [
            {
                "id": r.id,
                "invoice_id": r.invoice_id,
                "sale_date": r.sale_date.isoformat() if r.sale_date else None,
                "product_id": r.product_id,
                "product_name": r.product_name,
                "category": r.category,
                "quantity_sold": r.quantity_sold,
                "cost_price": r.cost_price,
                "retail_price": r.retail_price,
                "total_revenue": r.total_revenue,
                "profit": r.profit,
            }
            for r in records
        ],
    }


# ---------------------------------------------------------------------------
# GET /api/sales/summary  — aggregate KPIs
# ---------------------------------------------------------------------------
@router.get("/summary")
async def get_sales_summary(
    category: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cache_key = ("summary", category or "", start_date or "", end_date or "")
    if cache_key in SALES_CACHE:
        return SALES_CACHE[cache_key]

    query = _apply_sales_filters(db.query(SalesTransaction), category=category, start_date=start_date, end_date=end_date)

    stats = query.with_entities(
        func.count(SalesTransaction.id).label("total_records"),
        func.count(func.distinct(SalesTransaction.invoice_id)).label("total_invoices"),
        func.count(func.distinct(SalesTransaction.product_id)).label("total_products"),
        func.sum(SalesTransaction.quantity_sold).label("total_quantity"),
        func.sum(SalesTransaction.total_revenue).label("total_revenue"),
        func.sum(SalesTransaction.profit).label("total_profit"),
    ).first()

    total_revenue = round(float(stats.total_revenue or 0.0), 2)
    total_profit  = round(float(stats.total_profit  or 0.0), 2)
    profit_margin = round((total_profit / total_revenue * 100), 2) if total_revenue > 0 else 0.0

    result = {
        "total_records":  int(stats.total_records  or 0),
        "total_invoices": int(stats.total_invoices or 0),
        "total_products": int(stats.total_products or 0),
        "total_quantity": int(stats.total_quantity or 0),
        "quantity_sold":  int(stats.total_quantity or 0),   # alias for frontend compatibility
        "total_revenue":  total_revenue,
        "total_profit":   total_profit,
        "profit_margin":  profit_margin,
    }
    SALES_CACHE[cache_key] = result
    return result


# ---------------------------------------------------------------------------
# GET /api/sales/monthly  — revenue/profit/quantity grouped by month
# ---------------------------------------------------------------------------
@router.get("/monthly")
async def get_sales_monthly(
    category: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cache_key = ("monthly", category or "", start_date or "", end_date or "")
    if cache_key in SALES_CACHE:
        return SALES_CACHE[cache_key]

    query = _apply_sales_filters(db.query(SalesTransaction), category=category, start_date=start_date, end_date=end_date)

    results = (
        query.with_entities(
            func.date_format(SalesTransaction.sale_date, "%Y-%m").label("month"),
            func.sum(SalesTransaction.total_revenue).label("revenue"),
            func.sum(SalesTransaction.profit).label("profit"),
            func.sum(SalesTransaction.quantity_sold).label("quantity"),
        )
        .group_by("month")
        .order_by("month")
        .all()
    )

    result = [
        {
            "month": r.month,
            "revenue": round(float(r.revenue or 0.0), 2),
            "profit": round(float(r.profit or 0.0), 2),
            "quantity": int(r.quantity or 0),
        }
        for r in results
    ]
    SALES_CACHE[cache_key] = result
    return result


# ---------------------------------------------------------------------------
# GET /api/sales/categories  — distinct category list
# ---------------------------------------------------------------------------
@router.get("/categories")
async def get_sales_categories(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cache_key = ("categories",)
    if cache_key in SALES_CACHE:
        return SALES_CACHE[cache_key]

    rows = (
        db.query(SalesTransaction.category)
        .distinct()
        .order_by(SalesTransaction.category)
        .all()
    )
    result = [r.category for r in rows]
    SALES_CACHE[cache_key] = result
    return result


# ---------------------------------------------------------------------------
# POST /api/sales/upload-csv  — bulk import from CSV file
# ---------------------------------------------------------------------------
EXPECTED_COLUMNS = {
    "invoice_id", "sale_date", "product_id", "product_name",
    "category", "quantity_sold", "cost_price", "retail_price",
    "total_revenue", "profit",
}

DATE_FORMATS = ("%d/%m/%Y", "%m/%d/%Y")
BULK_INSERT_BATCH_SIZE = 20000


def parse_sale_date(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        pass

    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    raise ValueError(f"Unrecognised date format: {value!r}")


@router.post("/upload-csv")
async def upload_csv(
    file: UploadFile = File(...),
    dedupe_existing: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted.")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    headers = set(reader.fieldnames or [])
    missing = EXPECTED_COLUMNS - headers
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"CSV is missing required columns: {', '.join(sorted(missing))}",
        )

    pending_rows = []
    errors = []
    seen_in_csv = set()
    duplicates = 0
    parse_date = parse_sale_date

    max_batch = db.query(func.max(SalesTransaction.upload_batch)).scalar() or 0
    new_batch = max_batch + 1

    for i, row in enumerate(reader, start=2):
        try:
            invoice_id = row["invoice_id"].strip()
            product_id = row["product_id"].strip()
            sale_date = parse_date(row["sale_date"].strip())
            key = (invoice_id, product_id, sale_date)

            if key in seen_in_csv:
                duplicates += 1
                continue
            seen_in_csv.add(key)

            pending_rows.append({
                "invoice_id": invoice_id,
                "sale_date": sale_date,
                "product_id": product_id,
                "product_name": row["product_name"].strip(),
                "category": row["category"].strip(),
                "quantity_sold": int(float(row["quantity_sold"])),
                "cost_price": float(row["cost_price"]),
                "retail_price": float(row["retail_price"]),
                "total_revenue": float(row["total_revenue"]),
                "profit": float(row["profit"]),
                "upload_batch": new_batch,
            })
        except Exception as exc:
            errors.append(f"Row {i}: {exc}")

    if not pending_rows and not errors and duplicates == 0:
        return {
            "status": "success",
            "inserted_count": 0,
            "total_rows_processed": 0,
            "duplicate_count": 0,
            "validation_errors": [],
            "message": "CSV file was empty.",
        }

    existing_keys = set()
    if dedupe_existing and pending_rows:
        # This check can be expensive on large databases, so it is opt-in.
        min_date = min(row["sale_date"] for row in pending_rows)
        max_date = max(row["sale_date"] for row in pending_rows)
        existing = db.query(
            SalesTransaction.invoice_id,
            SalesTransaction.product_id,
            SalesTransaction.sale_date,
        ).filter(
            SalesTransaction.sale_date >= min_date,
            SalesTransaction.sale_date <= max_date,
        ).all()
        existing_keys = {(r[0], r[1], r[2]) for r in existing}

    inserted = 0
    insert_buffer = []
    for row in pending_rows:
        key = (row["invoice_id"], row["product_id"], row["sale_date"])
        if key in existing_keys:
            duplicates += 1
            continue

        insert_buffer.append(row)
        if len(insert_buffer) >= BULK_INSERT_BATCH_SIZE:
            db.bulk_insert_mappings(SalesTransaction, insert_buffer)
            inserted += len(insert_buffer)
            insert_buffer.clear()

    if insert_buffer:
        db.bulk_insert_mappings(SalesTransaction, insert_buffer)
        inserted += len(insert_buffer)

    db.commit()
    model_service.clear_live_caches()
    _clear_sales_cache()
    clear_dashboard_cache()

    latest_sale_date = None
    if inserted > 0:
        latest_sale_date_obj = db.query(func.max(SalesTransaction.sale_date)).scalar()
        if latest_sale_date_obj:
            if isinstance(latest_sale_date_obj, datetime):
                latest_sale_date = latest_sale_date_obj.date().isoformat()
            else:
                latest_sale_date = latest_sale_date_obj.isoformat()

    total_rows = inserted + duplicates + len(errors)
    status = "success" if not errors else ("partial_success" if inserted > 0 else "error")

    return {
        "status": status,
        "inserted_count": inserted,
        "total_rows_processed": total_rows,
        "duplicate_count": duplicates,
        "validation_errors": errors[:20],
        "message": f"Successfully inserted {inserted} record(s). Skipped {duplicates} duplicate(s).",
        "latest_sale_date": latest_sale_date,
    }


# ---------------------------------------------------------------------------
# DELETE /api/sales/clear  — wipe all transactions
# ---------------------------------------------------------------------------
@router.delete("/clear")
async def clear_sales(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    max_batch = db.query(func.max(SalesTransaction.upload_batch)).scalar()

    if max_batch is not None:
        deleted = db.query(SalesTransaction).filter(SalesTransaction.upload_batch == max_batch).delete()
    else:
        deleted = db.query(SalesTransaction).delete()

    db.commit()
    model_service.clear_live_caches()
    _clear_sales_cache()
    clear_dashboard_cache()

    message = f"Cleared {deleted} sales transaction(s) from the latest uploaded dataset." if max_batch is not None else f"Cleared {deleted} sales transaction(s)."
    return {"deleted": deleted, "message": message}
