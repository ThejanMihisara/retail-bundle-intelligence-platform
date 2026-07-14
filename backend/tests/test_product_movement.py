import pytest
from fastapi.testclient import TestClient
from main import app
from datetime import date
from services.product_movement_service import product_movement_service
from services.product_movement_predictor import normalize_period_start
from utils.dependencies import get_current_user
from models.user import User, UserRole, UserStatus

# Mock current user dependency
dummy_user = User(
    id=1,
    full_name="Admin User",
    email="admin@example.com",
    hashed_password="mockhashedpassword",
    role=UserRole.admin,
    is_approved=True,
    status=UserStatus.active
)
app.dependency_overrides[get_current_user] = lambda: dummy_user

client = TestClient(app)


def test_normalization():
    # Day normalization
    d1 = normalize_period_start("2026-07-15", "day")
    assert d1.year == 2026 and d1.month == 7 and d1.day == 15
    
    # Week normalization (Monday)
    d2 = normalize_period_start("2026-07-15", "week")
    assert d2.dayofweek == 0
    assert d2.day == 13
    
    # Month normalization (1st of month)
    d3 = normalize_period_start("2026-07-15", "month")
    assert d3.day == 1
    assert d3.month == 7

def test_predict_day_api():
    response = client.get("/api/products/movement/predict?period_type=day&selected_date=2026-07-15")
    assert response.status_code == 200
    data = response.json()
    assert data["filters"]["period_type"] == "day"
    assert data["filters"]["selected_date"] == "2026-07-15"
    assert data["filters"]["period_start"] == "2026-07-15"
    assert data["filters"]["period_label"] == "15 July 2026"
    assert "data" in data
    assert len(data["data"]) > 0

def test_predict_week_api():
    response = client.get("/api/products/movement/predict?period_type=week&selected_date=2026-07-15")
    assert response.status_code == 200
    data = response.json()
    assert data["filters"]["period_type"] == "week"
    assert data["filters"]["period_start"] == "2026-07-13"
    assert data["filters"]["period_end"] == "2026-07-19"
    assert data["filters"]["period_label"] == "13 July 2026 to 19 July 2026"
    assert len(data["data"]) > 0

def test_predict_month_api():
    response = client.get("/api/products/movement/predict?period_type=month&selected_date=2026-07-15")
    assert response.status_code == 200
    data = response.json()
    assert data["filters"]["period_type"] == "month"
    assert data["filters"]["period_start"] == "2026-07-01"
    assert data["filters"]["period_end"] == "2026-07-31"
    assert data["filters"]["period_label"] == "July 2026"
    assert len(data["data"]) > 0

def test_future_year_prediction():
    response = client.get("/api/products/movement/predict?period_type=month&selected_date=2028-12-15")
    assert response.status_code == 200
    data = response.json()
    assert data["filters"]["selected_date"] == "2028-12-15"
    assert data["filters"]["period_label"] == "December 2028"
    assert len(data["data"]) > 0

def test_probabilities_sum_and_confidence():
    response = client.get("/api/products/movement/predict?period_type=month&selected_date=2026-07-15&limit=10")
    assert response.status_code == 200
    data = response.json()
    for item in data["data"]:
        if not item["is_known_product"]:
            continue
        prob_sum = item["probability_fast_moving"] + item["probability_medium_moving"] + item["probability_slow_moving"]
        assert pytest.approx(prob_sum, abs=1e-2) == 1.0
        
        max_prob = max(item["probability_fast_moving"], item["probability_medium_moving"], item["probability_slow_moving"])
        assert pytest.approx(item["movement_confidence"], abs=1e-5) == max_prob

def test_movement_filtering():
    response = client.get("/api/products/movement/predict?period_type=month&selected_date=2026-07-15&movement_level=Fast Moving")
    assert response.status_code == 200
    data = response.json()
    for item in data["data"]:
        assert item["movement_level"] == "Fast Moving"

def test_category_filtering():
    response = client.get("/api/products/movement/predict?period_type=month&selected_date=2026-07-15&category=Beverages")
    assert response.status_code == 200
    data = response.json()
    for item in data["data"]:
        assert item["category"] == "Beverages"

def test_search_filtering():
    response = client.get("/api/products/movement/predict?period_type=month&selected_date=2026-07-15&search=Sugar")
    assert response.status_code == 200
    data = response.json()
    for item in data["data"]:
        assert "sugar" in item["product_name"].lower() or "sugar" in item["category"].lower() or "sugar" in item["product_id"].lower()

def test_pagination():
    response = client.get("/api/products/movement/predict?period_type=month&selected_date=2026-07-15&page=1&limit=5")
    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 1
    assert data["limit"] == 5
    assert len(data["data"]) <= 5

def test_sorting():
    response = client.get("/api/products/movement/predict?period_type=month&selected_date=2026-07-15&sort_by=expected_revenue&sort_desc=True")
    assert response.status_code == 200
    data = response.json()
    revenues = [item["expected_revenue"] for item in data["data"]]
    assert revenues == sorted(revenues, reverse=True)

def test_summary_and_distribution():
    response = client.get("/api/products/movement/predict?period_type=month&selected_date=2026-07-15")
    assert response.status_code == 200
    data = response.json()
    summary = data["summary"]
    total = summary["total_products"]
    fast = summary["fast_moving_count"]
    medium = summary["medium_moving_count"]
    slow = summary["slow_moving_count"]
    assert total == fast + medium + slow
    
    dist_map = {d["movement_level"]: d["percentage"] for d in data["distribution"]}
    if total > 0:
        assert pytest.approx(dist_map["Fast Moving"], abs=1e-1) == (fast / total * 100)
        assert pytest.approx(dist_map["Medium Moving"], abs=1e-1) == (medium / total * 100)
        assert pytest.approx(dist_map["Slow Moving"], abs=1e-1) == (slow / total * 100)

def test_top_product_selection():
    response = client.get("/api/products/movement/predict?period_type=month&selected_date=2026-07-15")
    assert response.status_code == 200
    data = response.json()
    assert "top_fast_products" in data
    assert "top_slow_products" in data
    assert len(data["top_fast_products"]) <= 5
    assert len(data["top_slow_products"]) <= 5

def test_compatibility_fields():
    response = client.get("/api/products/movement/predict?period_type=month&selected_date=2026-07-15&limit=1")
    assert response.status_code == 200
    data = response.json()
    if data["data"]:
        item = data["data"][0]
        assert "quantity_sold" in item
        assert "revenue" in item
        assert "profit" in item
        assert "movement_level" in item
        assert "movement_confidence" in item
        assert "probabilities" in item
        assert "fast" in item["probabilities"]
        assert "medium" in item["probabilities"]
        assert "slow" in item["probabilities"]

def test_missing_model_file(monkeypatch):
    original_path = product_movement_service.model_path
    product_movement_service.model_path = product_movement_service.base_dir / "models" / "product_movement" / "non_existent.pkl"
    product_movement_service.load_model()
    
    response = client.get("/api/products/movement/predict?period_type=month&selected_date=2026-07-15")
    assert response.status_code == 503
    assert "Model file not found" in response.json()["detail"]
    
    product_movement_service.model_path = original_path
    product_movement_service.load_model()

def test_invalid_bundle(monkeypatch):
    monkeypatch.setattr("services.product_movement_service.load_product_movement_bundle", lambda path: {"model_version": "invalid"})
    product_movement_service.load_model()
    
    response = client.get("/api/products/movement/predict?period_type=month&selected_date=2026-07-15")
    assert response.status_code == 503
    assert "Model bundle invalid" in response.json()["detail"]
    
    monkeypatch.undo()
    product_movement_service.load_model()
