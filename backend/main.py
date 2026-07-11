import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import SessionLocal, initialize_database
from routers import auth, dashboard, sales, products, bundles, forecast, ml_models
from services.auth_service import seed_admin_user
from services.model_service import model_service

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    db = SessionLocal()
    try:
        seed_admin_user(db)
    finally:
        db.close()
    model_service.load_models()
    yield


app = FastAPI(title="BundleMind API", version="1.0.0", lifespan=lifespan)

# Parse CORS origins from env — comma-separated list, fallback to all origins in dev
_cors_env = os.getenv("CORS_ORIGINS", "")
allowed_origins = [o.strip() for o in _cors_env.split(",") if o.strip()] or ["*"]

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
app.include_router(forecast.router)
app.include_router(ml_models.router)


@app.get("/")
async def root():
    return {"message": "BundleMind API is running"}
