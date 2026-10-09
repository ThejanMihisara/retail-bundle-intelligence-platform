import os
import logging
from pathlib import Path
import pandas as pd
from fastapi import HTTPException
from services.product_movement_predictor import (
    load_product_movement_bundle,
    predict_product_movement,
)

logger = logging.getLogger(__name__)

class ProductMovementService:
    def __init__(self):
        self.bundle = None
        self.load_error = None
        self.model_mtime = None
        self._cache = {}
        self.use_preview = os.getenv("PRODUCT_MOVEMENT_USE_PREVIEW", "true").lower() in {
            "1",
            "true",
            "yes",
        }
        
        self.base_dir = Path(__file__).resolve().parent.parent
        self.preview_dir = self.base_dir / "models" / "product_movement"
        self.model_path = (
            self.preview_dir
            / "product_movement_random_forest_bundle.pkl"
        )
        self.preview_paths = {
            "day": self.preview_dir / "future_day_preview.csv",
            "week": self.preview_dir / "future_week_preview.csv",
            "month": self.preview_dir / "future_month_preview.csv",
        }

    def load_model(self):
        try:
            
            try:
                import sklearn
                import joblib
            except ImportError as ie:
                self.load_error = f"Required dependency is unavailable: {ie}"
                self.bundle = None
                logger.error(self.load_error)
                return

            if not self.model_path.exists():
                self.load_error = f"Model file not found at {self.model_path}"
                self.bundle = None
                logger.error(self.load_error)
                return
            
           
            self.model_mtime = self.model_path.stat().st_mtime
            
           
            try:
                bundle = load_product_movement_bundle(str(self.model_path))
            except Exception as e:
                self.load_error = f"Model file is corrupted or failed to load: {e}"
                self.bundle = None
                logger.error(self.load_error)
                return

            if "pipeline" not in bundle or bundle["pipeline"] is None:
                self.load_error = "Model bundle invalid: 'pipeline' is missing or None."
                self.bundle = None
                logger.error(self.load_error)
                return
            
           
            if "feature_columns" not in bundle or bundle["feature_columns"] is None:
                self.load_error = "Model bundle invalid: 'feature_columns' is missing or None."
                self.bundle = None
                logger.error(self.load_error)
                return

           
            if "profile_tables" not in bundle or bundle["profile_tables"] is None:
                self.load_error = "Model bundle invalid: 'profile_tables' is missing or None."
                self.bundle = None
                logger.error(self.load_error)
                return
            
            
            if "model_version" not in bundle or not bundle["model_version"]:
                self.load_error = "Model bundle invalid: 'model_version' is missing."
                self.bundle = None
                logger.error(self.load_error)
                return

           
            supported = bundle.get("supported_period_types", [])
            if not all(p in supported for p in ["day", "week", "month"]):
                self.load_error = f"Model bundle invalid: 'supported_period_types' must contain day, week, and month. Found: {supported}"
                self.bundle = None
                logger.error(self.load_error)
                return
            
            
            classes = list(bundle.get("classes", []))
            if not classes:
                pipeline = bundle["pipeline"]
                if hasattr(pipeline, "classes_"):
                    classes = list(pipeline.classes_)
                elif hasattr(pipeline, "named_steps") and "classifier" in pipeline.named_steps:
                    classifier = pipeline.named_steps["classifier"]
                    if hasattr(classifier, "classes_"):
                        classes = list(classifier.classes_)
            
            expected_classes = {"Fast Moving", "Medium Moving", "Slow Moving"}
            if not expected_classes.issubset(set(classes)):
                self.load_error = f"Model bundle invalid: 'classes' must contain Fast Moving, Medium Moving, and Slow Moving. Found: {classes}"
                self.bundle = None
                logger.error(self.load_error)
                return

            self.bundle = bundle
            self.load_error = None
            logger.info("Product Movement Random Forest model bundle loaded and validated successfully.")
        except Exception as e:
            self.load_error = f"Error during model loading/validation: {e}"
            self.bundle = None
            logger.error(self.load_error)

    def check_ready(self):
        if self.use_preview:
            missing = [
                str(path)
                for path in self.preview_paths.values()
                if not path.exists()
            ]
            if missing:
                raise HTTPException(
                    status_code=503,
                    detail=f"Product movement preview files are missing: {', '.join(missing)}",
                )
            return
     
        if self.bundle is None and self.load_error is None:
            self.load_model()
     
        if self.model_path.exists():
            current_mtime = self.model_path.stat().st_mtime
            if self.model_mtime is None or current_mtime != self.model_mtime:
                logger.info("Model file modification detected. Reloading and clearing cache...")
                self.load_model()
                self._cache.clear()
        else:
            if self.model_mtime is not None:
                logger.warning("Model file was removed. Clearing bundle.")
                self.bundle = None
                self.model_mtime = None
                self.load_error = f"Model file not found at {self.model_path}"
                self._cache.clear()

        if self.load_error:
            raise HTTPException(status_code=503, detail=self.load_error)
        if self.bundle is None:
            raise HTTPException(status_code=503, detail="Model bundle not loaded.")

    def _get_preview_predictions(self, selected_date_str: str, period_type: str):
        path = self.preview_paths.get(period_type)
        if path is None:
            raise HTTPException(status_code=400, detail="period_type must be day, week, or month")
        if not path.exists():
            raise HTTPException(status_code=503, detail=f"Preview file not found at {path}")

        cache_key = ("preview", selected_date_str, period_type)
        if cache_key in self._cache:
            return self._cache[cache_key]

        df = pd.read_csv(path)
        df["period_start"] = selected_date_str
        df["period_type"] = period_type

        defaults = {
            "average_unit_price": 0.0,
            "overall_profit_margin": 0.0,
            "overall_daily_quantity_rate": 0.0,
            "movement_confidence": 0.0,
            "movement_score": 0.0,
        }
        for column, value in defaults.items():
            if column not in df.columns:
                df[column] = value

        self._cache[cache_key] = df
        return df

    def get_predictions(self, selected_date_str: str, period_type: str):
        self.check_ready()
        if self.use_preview:
            return self._get_preview_predictions(selected_date_str, period_type)
        
        model_version = self.bundle["model_version"]
        cache_key = (selected_date_str, period_type, model_version)
        
        if cache_key in self._cache:
            logger.info(f"Serving product movement predictions from cache for {cache_key}")
            return self._cache[cache_key]

        try:
            logger.info(f"Generating live predictions for {selected_date_str} ({period_type}) using Random Forest model")
            df = predict_product_movement(self.bundle, selected_date_str, period_type)
            self._cache[cache_key] = df
            return df
        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")

product_movement_service = ProductMovementService()
