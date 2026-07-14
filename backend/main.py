import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import SessionLocal, initialize_database
from routers import auth, dashboard, sales, products, bundles, ml_models, access_requests, users, forecasts
from services.auth_service import seed_admin_user
from services.model_service import model_service
from services.forecast_service import forecast_service

logging.basicConfig(level=logging.INFO)
logging.getLogger("prophet.plot").setLevel(logging.CRITICAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    db = SessionLocal()
    try:
        seed_admin_user(db)
    finally:
        db.close()
    model_service.load_models()
    try:
        forecast_service.load_models()
    except Exception as exc:
        logging.getLogger(__name__).error(f"Error loading forecast models on startup: {exc}")
    yield


app = FastAPI(title="BundleMind API", version="1.0.0", lifespan=lifespan)

# Parse CORS origins from env — comma-separated list, fallback to all origins in dev
_cors_env = os.getenv("CORS_ORIGINS", "")
allowed_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
dev_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
for origin in dev_origins:
    if origin not in allowed_origins:
        allowed_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(sales.router)
app.include_router(products.router)
app.include_router(bundles.router)
app.include_router(ml_models.router)
app.include_router(access_requests.router)
app.include_router(users.router)
app.include_router(forecasts.router)


@app.get("/")
async def root():
    return {"message": "BundleMind API is running"}
