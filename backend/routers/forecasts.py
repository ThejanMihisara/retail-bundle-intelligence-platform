from datetime import datetime, date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from schemas.forecast import FutureForecastRecord, ComparisonResponse
from services.forecast_service import forecast_service
from utils.dependencies import get_current_user

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


@router.get("/future", response_model=List[FutureForecastRecord])
async def get_future_forecast(
    view: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    days: Optional[int] = Query(None, ge=1, le=365),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        return forecast_service.run_future_forecast(
            db=db,
            view=view,
            start_date=start_date,
            end_date=end_date,
            days=days,
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/actual-vs-predicted", response_model=ComparisonResponse)
async def get_actual_vs_predicted(
    start_date: str,
    end_date: str,
    view: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    target: str = Query("transactions", pattern="^(transactions|quantity_sold)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")

    if start > end:
        raise HTTPException(status_code=400, detail="Start date must be before or equal to end date.")

    try:
        return forecast_service.get_actual_vs_predicted(
            db=db,
            start_date=start,
            end_date=end,
            view=view,
            target=target,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/comparison-defaults")
async def get_comparison_defaults(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    try:
        from models.transaction import SalesTransaction
        from sqlalchemy import func
        from datetime import date, timedelta
        
        # 1. Oldest actual sale date
        min_date = db.query(func.min(SalesTransaction.sale_date)).scalar()
        if min_date is not None:
            if isinstance(min_date, datetime):
                oldest_date_str = min_date.date().strftime("%Y-%m-%d")
            else:
                oldest_date_str = min_date.strftime("%Y-%m-%d")
        else:
            oldest_date_str = "2024-01-01"
            
        # 2. Tomorrow's date
        tomorrow = date.today() + timedelta(days=1)
        tomorrow_str = tomorrow.strftime("%Y-%m-%d")
        
        return {
            "oldest_actual_date": oldest_date_str,
            "tomorrow_date": tomorrow_str
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
