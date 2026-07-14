import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import joblib
import pandas as pd

logger = logging.getLogger(__name__)

class ModelService:
    def __init__(self):
        self.base_dir = Path(__file__).resolve().parent.parent
        env_models_dir = os.getenv("ML_MODELS_DIR")
        if env_models_dir and Path(env_models_dir).exists():
            self.models_dir = Path(env_models_dir)
        else:
            self.models_dir = self.base_dir / "models"
        
        self.rf_model_dir = self.models_dir / "product_movement"
        self.fp_model_dir = self.models_dir / "bundle_recommendation"
        
        self.rf_model = None
        self.rf_model_feature_columns = None
        self.rf_model_artifact = None
        self.rf_predictions = None
        self.rf_period_analysis = None
        self.rf_feature_importance = None
        self.rf_training_summary = None
        self.rf_classification_report = ""
        
        self.fp_model = None
        self.fp_recommendations = None
        self.fp_rules = None
        self.fp_product_lookup = None
        self.fp_pair_statistics = None
        self.fp_period_recommendations = None
        self.fp_training_summary = None
        self.fp_product_profile = None
        self.fp_month_profile = None
        self.fp_week_profile = None
        self.fp_daily_quantity = None
        self.fp_global_product_quantity = None

        self.loaded = False
        # Cache for live RF inference results from uploaded DB data
        self.live_rf_predictions = None
        self.live_rf_signature = None

    def clear_live_caches(self):
        self.live_rf_predictions = None
        self.live_rf_signature = None

    def _load_rf_model_artifact(self, path: Path):
        artifact = joblib.load(path, mmap_mode="r")
        self.rf_model_artifact = artifact
        self.rf_model_feature_columns = None

        if isinstance(artifact, dict):
            self.rf_model_feature_columns = artifact.get("feature_columns")
            for key in ("model", "pipeline", "estimator", "classifier"):
                candidate = artifact.get(key)
                if hasattr(candidate, "predict"):
                    return candidate
            logger.error("RF artifact dictionary did not contain a predictor.")
            return None

        return artifact

    def load_models(self):
        if self.loaded:
            return
        
        # Random Forest model, predictions, and period analysis are now managed dynamically by ProductMovementService.
        # We do not load them here to prevent duplicate memory allocation.
        self.rf_model = None
        self.rf_predictions = None
        self.rf_period_analysis = None


        try:
            rf_feat_path = self.rf_model_dir / "random_forest_feature_importance.csv"
            if rf_feat_path.exists():
                self.rf_feature_importance = pd.read_csv(rf_feat_path)
        except Exception as e:
            logger.error(f"Error loading RF feature importance: {e}")

        try:
            rf_sum_path = self.rf_model_dir / "random_forest_training_summary.json"
            if rf_sum_path.exists():
                with open(rf_sum_path, "r") as f:
                    self.rf_training_summary = json.load(f)
        except Exception as e:
            logger.error(f"Error loading RF training summary: {e}")

        try:
            rf_rep_path = self.rf_model_dir / "random_forest_classification_report.txt"
            if rf_rep_path.exists():
                with open(rf_rep_path, "r") as f:
                    self.rf_classification_report = f.read()
        except Exception as e:
            logger.error(f"Error loading RF classification report: {e}")

        # Load FP-Growth files
        try:
            fp_model_path = self.fp_model_dir / "bundle_recommendation_model.joblib"
            if fp_model_path.exists():
                self.fp_model = joblib.load(fp_model_path)
                if isinstance(self.fp_model, dict):
                    self.fp_recommendations = self.fp_model.get("bundle_recommendations")
                    self.fp_rules = self.fp_model.get("association_rules")
                    self.fp_product_profile = self.fp_model.get("product_profile")
                    self.fp_month_profile = self.fp_model.get("month_profile")
                    self.fp_week_profile = self.fp_model.get("week_profile")
                    self.fp_daily_quantity = self.fp_model.get("daily_quantity")
                    self.fp_global_product_quantity = self.fp_model.get("global_product_quantity")
                    self.fp_training_summary = self.fp_model.get("metadata")
                    logger.info("Loaded FP model from joblib file.")
        except Exception as e:
            logger.error(f"Error loading FP model from joblib: {e}")

        # Fallbacks for CSV files
        try:
            fp_rec_path = self.fp_model_dir / "fp_growth_bundle_recommendations.csv"
            if fp_rec_path.exists() and self.fp_recommendations is None:
                self.fp_recommendations = pd.read_csv(fp_rec_path)
        except Exception as e:
            logger.error(f"Error loading FP recommendations CSV: {e}")

        try:
            fp_rules_path = self.fp_model_dir / "fp_growth_association_rules.csv"
            if fp_rules_path.exists() and self.fp_rules is None:
                self.fp_rules = pd.read_csv(fp_rules_path)
        except Exception as e:
            logger.error(f"Error loading FP rules CSV: {e}")

        try:
            fp_period_path = self.fp_model_dir / "fp_growth_period_recommendations.csv"
            if fp_period_path.exists():
                self.fp_period_recommendations = pd.read_csv(fp_period_path)
        except Exception as e:
            logger.error(f"Error loading FP period recommendations CSV: {e}")

        try:
            fp_sum_path = self.fp_model_dir / "bundle_model_summary.json"
            if fp_sum_path.exists() and self.fp_training_summary is None:
                with open(fp_sum_path, "r") as f:
                    self.fp_training_summary = json.load(f)
        except Exception as e:
            logger.error(f"Error loading FP training summary JSON: {e}")

        # Keep compatibility with existing endpoints looking for product_lookup
        if self.fp_product_profile is not None:
            self.fp_product_lookup = self.fp_product_profile

        self.loaded = True
        logger.info("All model artifacts loaded successfully.")

    def get_model_status(self) -> Dict[str, Any]:
        # Lazy import to avoid circular dependency
        from services.forecast_service import forecast_service
        try:
            forecast_service.check_ready()
        except Exception:
            pass

        return {
            "loaded": self.loaded,
            "random_forest": {
                "model_loaded": self.rf_model is not None,
                "predictions_loaded": self.rf_predictions is not None,
                "period_analysis_loaded": self.rf_period_analysis is not None,
                "feature_importance_loaded": self.rf_feature_importance is not None,
                "training_summary_loaded": self.rf_training_summary is not None,
                "classification_report_loaded": bool(self.rf_classification_report)
            },
            "fp_growth": {
                "model_loaded": self.fp_model is not None,
                "recommendations_loaded": self.fp_recommendations is not None,
                "rules_loaded": self.fp_rules is not None,
                "product_lookup_loaded": self.fp_product_lookup is not None,
                "pair_statistics_loaded": self.fp_pair_statistics is not None,
                "period_recommendations_loaded": self.fp_period_recommendations is not None,
                "training_summary_loaded": self.fp_training_summary is not None
            },
            "demand_forecasting": {
                "model_loaded": forecast_service.loaded,
                "type": "Hybrid Ensemble Model",
                "method": "Prophet + HistGradientBoosting",
                "data_source": "Live MySQL transactions",
                "retraining_required": "No — computes on uploaded data",
                "granularity": "Daily / Weekly / Monthly"
            }
        }

model_service = ModelService()
