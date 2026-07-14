import collections
import pytest
from datetime import datetime, date, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from models.transaction import SalesTransaction
from services.forecast_service import ForecastService


@pytest.fixture(name="db")
def db_fixture():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


def test_load_models_validation(monkeypatch):
    service = ForecastService()
    
    # Point paths to non-existent files to trigger FileNotFoundError
    service.tx_model_path = service.models_dir / "does_not_exist_tx.pkl"
    service.qty_model_path = service.models_dir / "does_not_exist_qty.pkl"
    
    # 1. Test missing file throws Error
    with pytest.raises(FileNotFoundError):
        service.load_models()
        
    # Mock file existence
    monkeypatch.setattr(service, "tx_model_path", service.models_dir / "transaction_forecast_model.pkl")
    monkeypatch.setattr(service, "qty_model_path", service.models_dir / "quantity_forecast_model.pkl")
    from pathlib import Path
    monkeypatch.setattr(Path, "exists", lambda self: True)
    
    # Mock joblib.load to return empty dictionary (invalid bundle structure)
    import joblib
    monkeypatch.setattr(joblib, "load", lambda path: {})
    
    with pytest.raises(ValueError):
        service.load_models()


def test_forecast_and_aggregation(db, monkeypatch):
    service = ForecastService()
    
    # Stub bundles
    service._tx_bundle = {
        "artifact_version": "1.0",
        "model_version": "1.1",
        "target": "transactions",
        "selected_model": "ensemble",
        "prophet_model": "prophet",
        "gradient_boosting_model": "gb",
        "gradient_boosting_columns": [],
        "ensemble_weight": {"prophet_weight": 0.5, "gradient_boosting_weight": 0.5},
        "history": None,
        "lags": [],
        "rolling_windows": []
    }
    service._qty_bundle = {
        "artifact_version": "1.0",
        "model_version": "1.2",
        "target": "quantity_sold",
        "selected_model": "prophet",
        "prophet_model": "prophet",
        "gradient_boosting_model": "gb",
        "gradient_boosting_columns": [],
        "ensemble_weight": None,
        "history": None,
        "lags": [],
        "rolling_windows": []
    }
    service.loaded = True
    
    # Mock predict_bundle
    import pandas as pd
    def dummy_predict_bundle(bundle, dates):
        return pd.DataFrame({
            "forecast_date": dates,
            "prediction": [10] * len(dates),
            "lower": [8] * len(dates),
            "upper": [12] * len(dates)
        })
        
    import services.forecast_service
    monkeypatch.setattr(services.forecast_service, "predict_bundle", dummy_predict_bundle)
    
    # Run forecast for 10 days
    results = service.run_future_forecast(db, view="daily", start_date="2026-01-01", end_date="2026-01-10")
    
    assert len(results) == 10
    assert results[0]["predicted_transactions"] == 10
    assert results[0]["predicted_quantity_sold"] == 10
    assert isinstance(results[0]["predicted_transactions"], int)
    
    # Test weekly aggregation (2026-01-01 is Thursday)
    # Week 1: 2026-01-01 to 2026-01-04 (4 days)
    # Week 2: 2026-01-05 to 2026-01-10 (6 days)
    weekly_results = service.aggregate_future_forecasts(results, view="weekly")
    assert len(weekly_results) == 2
    assert weekly_results[0]["period_label"] == "2026-01-01 to 2026-01-04"
    assert weekly_results[0]["predicted_transactions"] == 40
    assert weekly_results[1]["period_label"] == "2026-01-05 to 2026-01-10"
    assert weekly_results[1]["predicted_transactions"] == 60


def test_comparison_metrics_and_zero_mape(db, monkeypatch):
    service = ForecastService()
    
    # Mock run_future_forecast to return mock daily predictions
    def mock_run_future(db, view="daily", start_date=None, end_date=None, days=None):
        return [
            {
                "forecast_date": "2026-06-01",
                "predicted_transactions": 10,
                "transaction_lower": 8,
                "transaction_upper": 12,
                "predicted_quantity_sold": 100,
                "quantity_lower": 80,
                "quantity_upper": 120
            },
            {
                "forecast_date": "2026-06-02",
                "predicted_transactions": 20,
                "transaction_lower": 18,
                "transaction_upper": 22,
                "predicted_quantity_sold": 200,
                "quantity_lower": 180,
                "quantity_upper": 220
            },
            {
                "forecast_date": "2026-06-03",
                "predicted_transactions": 30,
                "transaction_lower": 28,
                "transaction_upper": 32,
                "predicted_quantity_sold": 300,
                "quantity_lower": 280,
                "quantity_upper": 320
            }
        ]
        
    monkeypatch.setattr(service, "run_future_forecast", mock_run_future)
    
    # Add actuals
    # Day 1: actual transactions count = 1, actual quantity = 80
    db.add(SalesTransaction(
        invoice_id="INV1",
        sale_date=datetime(2026, 6, 1, 10, 0),
        product_id="P1",
        product_name="Prod1",
        category="Cat",
        quantity_sold=80,
        cost_price=10.0,
        retail_price=15.0,
        total_revenue=15.0,
        profit=5.0
    ))
    # Day 2: actual quantity = 0
    db.add(SalesTransaction(
        invoice_id="INV2",
        sale_date=datetime(2026, 6, 2, 10, 0),
        product_id="P1",
        product_name="Prod1",
        category="Cat",
        quantity_sold=0,
        cost_price=10.0,
        retail_price=15.0,
        total_revenue=15.0,
        profit=5.0
    ))
    db.commit()
    
    # Run comparison on quantity_sold
    res = service.get_actual_vs_predicted(db, start_date=date(2026, 6, 1), end_date=date(2026, 6, 3), view="daily", target="quantity_sold")
    
    # Asserts
    assert len(res["data"]) == 3
    assert res["data"][0]["actual"] == 80
    assert res["data"][1]["actual"] == 0
    assert res["data"][2]["actual"] is None
    
    # Metrics calculations:
    # Matched rows: Day 1 (predicted=100, actual=80) and Day 2 (predicted=200, actual=0)
    # MAE = (abs(100 - 80) + abs(200 - 0)) / 2 = (20 + 200) / 2 = 110
    # MAPE = (abs(100-80)/80 * 100) = 25% (Day 2 with actual 0 is excluded from MAPE)
    # Accuracy = 100 - MAPE = 75%
    summary = res["summary"]
    assert summary["average_forecast_error"] == 110.0
    assert summary["mape"] == 25.0
    assert summary["forecast_accuracy"] == 75.0


def test_monthly_aggregation_and_coverage(db, monkeypatch):
    service = ForecastService()
    
    # September: 15 records (Partial forecast coverage)
    # January: 31 records (Full forecast coverage)
    # October: 31 records (Full forecast coverage, prediction-only)
    mock_results = []
    
    # January
    for day in range(1, 32):
        mock_results.append({
            "forecast_date": f"2026-01-{day:02d}",
            "predicted_transactions": 10,
            "transaction_lower": 8,
            "transaction_upper": 12,
            "predicted_quantity_sold": 100,
            "quantity_lower": 80,
            "quantity_upper": 120
        })
        
    # September (15 records)
    for day in range(1, 16):
        mock_results.append({
            "forecast_date": f"2026-09-{day:02d}",
            "predicted_transactions": 20,
            "transaction_lower": 15,
            "transaction_upper": 25,
            "predicted_quantity_sold": 200,
            "quantity_lower": 150,
            "quantity_upper": 250
        })
        
    # October
    for day in range(1, 32):
        mock_results.append({
            "forecast_date": f"2026-10-{day:02d}",
            "predicted_transactions": 30,
            "transaction_lower": 25,
            "transaction_upper": 35,
            "predicted_quantity_sold": 300,
            "quantity_lower": 250,
            "quantity_upper": 350
        })
        
    def mock_run_future(db, view="daily", start_date=None, end_date=None, days=None):
        res = []
        for r in mock_results:
            if start_date <= r["forecast_date"] <= end_date:
                res.append(r)
        return res
        
    monkeypatch.setattr(service, "run_future_forecast", mock_run_future)
        
    # January actuals
    for day in range(1, 32):
        db.add(SalesTransaction(
            invoice_id=f"INV_JAN_{day}",
            sale_date=datetime(2026, 1, day, 10, 0),
            product_id="P1",
            product_name="Prod1",
            category="Cat",
            quantity_sold=80,
            cost_price=10.0,
            retail_price=15.0,
            total_revenue=15.0,
            profit=5.0
        ))
        
    db.commit()
    
    res = service.get_actual_vs_predicted(
        db,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 10, 31),
        view="monthly",
        target="transactions"
    )
    
    data = res["data"]
    assert len(data) == 3
    
    # January: Full coverage (31 calendar days, 31 forecast days, actual present)
    jan = next(r for r in data if r["period_label"] == "January 2026")
    assert jan["forecast_days"] == 31
    assert jan["calendar_days"] == 31
    assert jan["is_partial_forecast_period"] is False
    assert jan["has_actual"] is True
    assert jan["is_partial_actual_period"] is False
    
    # September: Partial coverage (15 forecast days, 30 calendar days, actual null)
    sep = next(r for r in data if r["period_label"] == "September 2026")
    assert sep["forecast_days"] == 15
    assert sep["calendar_days"] == 30
    assert sep["is_partial_forecast_period"] is True
    assert sep["has_actual"] is False
    assert sep["actual"] is None
    
    # October: Full forecast coverage (31 forecast days, 31 calendar days, actual null/prediction-only)
    october = next(r for r in data if r["period_label"] == "October 2026")
    assert october["forecast_days"] == 31
    assert october["calendar_days"] == 31
    assert october["is_partial_forecast_period"] is False
    assert october["has_actual"] is False
    assert october["actual"] is None

