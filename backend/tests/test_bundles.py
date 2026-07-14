import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
from main import app
from utils.dependencies import get_current_user
from models.user import User, UserRole, UserStatus
from services.model_service import model_service

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

def test_day_recommendation_request():
    # Test request for Day mode (2026-07-14 exists in CSV)
    response = client.get("/api/bundles/period-analysis?period_type=day&target_date=2026-07-14")
    assert response.status_code == 200
    data = response.json()
    assert data["selected_date"] == "2026-07-14"
    assert data["period_type"] == "day"
    assert data["period_label"] == "14 July 2026"
    assert "data" in data
    assert len(data["data"]) > 0
    # Every bundle must contain 4-6 products
    for bundle in data["data"]:
        assert 4 <= len(bundle["products"]) <= 6
        # No duplicate products inside a bundle
        pids = [p["product_id"] for p in bundle["products"]]
        assert len(pids) == len(set(pids))

def test_week_recommendation_request():
    # Test request for Week mode
    response = client.get("/api/bundles/period-analysis?period_type=week&target_date=2026-07-15")
    assert response.status_code == 200
    data = response.json()
    assert data["period_type"] == "week"
    assert data["period_label"] == "13 Jul 2026 - 19 Jul 2026"
    assert len(data["data"]) > 0

def test_month_recommendation_request():
    # Test request for Month mode
    response = client.get("/api/bundles/period-analysis?period_type=month&target_date=2026-07-15")
    assert response.status_code == 200
    data = response.json()
    assert data["period_type"] == "month"
    assert data["period_label"] == "July 2026"
    assert len(data["data"]) > 0

def test_future_year_request():
    # Test dynamic future year calculation (2028 is not in CSV)
    response = client.get("/api/bundles/period-analysis?period_type=month&target_date=2028-12-15")
    assert response.status_code == 200
    data = response.json()
    assert data["selected_date"] == "2028-12-15"
    assert data["period_label"] == "December 2028"
    assert len(data["data"]) > 0
    # Confirming the dynamic ranking did not fail and returns valid scores
    for bundle in data["data"]:
        assert bundle["score"] > 0
        assert "products" in bundle
        assert 4 <= len(bundle["products"]) <= 6

def test_invalid_period_type():
    # Verify that an invalid period type returns an HTTP 422 error (FastAPI Validation)
    response = client.get("/api/bundles/period-analysis?period_type=invalid_period&target_date=2026-07-15")
    assert response.status_code == 422

def test_invalid_date():
    # Verify that an invalid date format returns an HTTP 400 error
    response = client.get("/api/bundles/period-analysis?period_type=day&target_date=2026-13-45")
    assert response.status_code == 400
    assert "Invalid date format" in response.json()["detail"]

def test_pagination():
    # Verify pagination page & limit
    response = client.get("/api/bundles/period-analysis?period_type=day&target_date=2026-07-14&page=1&limit=5")
    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 1
    assert data["limit"] == 5
    assert len(data["data"]) <= 5

def test_product_search():
    # Verify searching by product name or ID filters the results correctly
    response = client.get("/api/bundles/period-analysis?period_type=day&target_date=2026-07-14&search=Sugar")
    assert response.status_code == 200
    data = response.json()
    for bundle in data["data"]:
        # Verify that Sugar is contained in at least one product in the bundle
        names = [p["product_name"].lower() for p in bundle["products"]]
        assert any("sugar" in n for n in names)

def test_category_filtering():
    # Verify filtering by category works
    category = "Beverages"
    response = client.get(f"/api/bundles/period-analysis?period_type=day&target_date=2026-07-14&category={category}")
    assert response.status_code == 200
    data = response.json()
    for bundle in data["data"]:
        cats = [p["category"].lower() for p in bundle["products"]]
        assert any(category.lower() in c for c in cats)

def test_min_lift_filtering():
    # Verify min lift filter exclusions
    min_lift = 10.0
    response = client.get(f"/api/bundles/period-analysis?period_type=day&target_date=2026-07-14&min_lift={min_lift}")
    assert response.status_code == 200
    data = response.json()
    for bundle in data["data"]:
        assert bundle["lift"] >= min_lift

def test_missing_model_artifact(monkeypatch):
    # Verify that a missing model artifact triggers an HTTP 503 response
    monkeypatch.setattr(model_service, "fp_recommendations", None)
    response = client.get("/api/bundles/period-analysis?period_type=day&target_date=2026-07-14")
    assert response.status_code == 503
    assert "missing or corrupted" in response.json()["detail"]


def test_movement_filtering():
    # Verify filtering by product movement classification
    response = client.get("/api/bundles/period-analysis?period_type=day&target_date=2026-07-14&movement=Fast")
    assert response.status_code == 200
    data = response.json()
    for bundle in data["data"]:
        movements = [p["movement_label"].lower() for p in bundle["products"]]
        assert any("fast" in m for m in movements)


def test_fast_slow_validation():
    response = client.get("/api/bundles/period-analysis?period_type=day&target_date=2026-07-14")
    assert response.status_code == 200
    data = response.json()
    for bundle in data["data"]:
        # Verify fast_product_count >= 1 and slow_product_count >= 1
        assert bundle["fast_product_count"] >= 1
        assert bundle["slow_product_count"] >= 1


def test_product_count_validation():
    response = client.get("/api/bundles/period-analysis?period_type=day&target_date=2026-07-14")
    assert response.status_code == 200
    data = response.json()
    for bundle in data["data"]:
        assert 4 <= bundle["product_count"] <= 6
        assert 4 <= len(bundle["products"]) <= 6


def test_duplicate_product_prevention():
    response = client.get("/api/bundles/period-analysis?period_type=day&target_date=2026-07-14")
    assert response.status_code == 200
    data = response.json()
    for bundle in data["data"]:
        pids = [p["product_id"] for p in bundle["products"]]
        assert len(pids) == len(set(pids))


def test_nan_infinity_prevention():
    response = client.get("/api/bundles/period-analysis?period_type=day&target_date=2026-07-14")
    assert response.status_code == 200
    data_str = response.text
    # Search for NaN, Infinity or -Infinity in the raw json string
    assert "NaN" not in data_str
    assert "Infinity" not in data_str

