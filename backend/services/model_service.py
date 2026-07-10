import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import joblib
import pandas as pd

logger = logging.getLogger(__name__)

class ModelService:
    def __init__(self):
        self.base_dir = Path(__file__).resolve().parent.parent
        self.models_dir = self.base_dir / "models"
        
        self.rf_model_dir = self.models_dir / "product_movement"
        self.fp_model_dir = self.models_dir / "bundle_recommendation"
        
        self.rf_model = None
        self.rf_predictions = None
        self.rf_feature_importance = None
        self.rf_training_summary = None
        self.rf_classification_report = ""
        
        self.fp_model = None
        self.fp_recommendations = None
        self.fp_rules = None
        self.fp_product_lookup = None
        self.fp_pair_statistics = None
        self.fp_training_summary = None

        self.loaded = False

    def load_models(self):
        if self.loaded:
            return
        
        # Load Random Forest files
        try:
            rf_model_path = self.rf_model_dir / "fast_medium_slow_random_forest_model.pkl"
            if rf_model_path.exists():
                self.rf_model = joblib.load(rf_model_path)
        except Exception as e:
            logger.error(f"Error loading RF model: {e}")
            
        try:
            rf_pred_path = self.rf_model_dir / "product_movement_predictions.csv"
            if rf_pred_path.exists():
                self.rf_predictions = pd.read_csv(rf_pred_path)
        except Exception as e:
            logger.error(f"Error loading RF predictions: {e}")

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
            fp_model_path = self.fp_model_dir / "bundle_recommendation_model.pkl"
            if fp_model_path.exists():
                self.fp_model = joblib.load(fp_model_path)
        except Exception as e:
            logger.error(f"Error loading FP model: {e}")

        try:
            fp_rec_path = self.fp_model_dir / "bundle_recommendations.csv"
            if fp_rec_path.exists():
                self.fp_recommendations = pd.read_csv(fp_rec_path)
        except Exception as e:
            logger.error(f"Error loading FP recommendations: {e}")

        try:
            fp_rules_path = self.fp_model_dir / "association_rules.csv"
            if fp_rules_path.exists():
                self.fp_rules = pd.read_csv(fp_rules_path)
        except Exception as e:
            logger.error(f"Error loading FP rules: {e}")

        try:
            fp_lookup_path = self.fp_model_dir / "product_lookup.csv"
            if fp_lookup_path.exists():
                self.fp_product_lookup = pd.read_csv(fp_lookup_path)
        except Exception as e:
            logger.error(f"Error loading FP product lookup: {e}")

        try:
            fp_pair_path = self.fp_model_dir / "pair_statistics.csv"
            if fp_pair_path.exists():
                self.fp_pair_statistics = pd.read_csv(fp_pair_path)
        except Exception as e:
            logger.error(f"Error loading FP pair stats: {e}")

        try:
            fp_sum_path = self.fp_model_dir / "fp_growth_training_summary.json"
            if fp_sum_path.exists():
                with open(fp_sum_path, "r") as f:
                    self.fp_training_summary = json.load(f)
        except Exception as e:
            logger.error(f"Error loading FP training summary: {e}")

        self.loaded = True
        logger.info("All model artifacts loaded successfully.")

    def get_model_status(self) -> Dict[str, Any]:
        return {
            "loaded": self.loaded,
            "random_forest": {
                "model_loaded": self.rf_model is not None,
                "predictions_loaded": self.rf_predictions is not None,
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
                "training_summary_loaded": self.fp_training_summary is not None
            }
        }

model_service = ModelService()
