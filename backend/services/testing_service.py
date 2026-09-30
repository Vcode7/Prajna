import os
import json
import joblib
import logging
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, confusion_matrix,
    mean_absolute_error, mean_squared_error, r2_score
)
from backend.llm.client import groq_client
from backend.config import settings

logger = logging.getLogger(__name__)

class TestingService:
    def load_model_bundle(self, artifact_path: str) -> Dict[str, Any]:
        """Loads serialized joblib model package with pipeline and metadata."""
        if not os.path.exists(artifact_path):
            raise FileNotFoundError(f"Trained model artifact not found at {artifact_path}")
        return joblib.load(artifact_path)

    def evaluate_and_predict(
        self,
        artifact_path: str,
        test_df: pd.DataFrame
    ) -> Dict[str, Any]:
        """
        Validates input features, applies preprocessing pipeline, generates predictions,
        and evaluates ground-truth metrics if target column is present.
        """
        bundle = self.load_model_bundle(artifact_path)
        pipeline = bundle["pipeline"]
        problem_type = bundle["problem_type"]
        target_column = bundle.get("target_column")
        feature_columns = bundle["feature_columns"]
        target_encoder = bundle.get("target_encoder")

        # 1. Validate required feature columns
        missing_features = [f for f in feature_columns if f not in test_df.columns]
        if missing_features:
            raise ValueError(f"Test data is missing required feature columns: {', '.join(missing_features)}")

        X_test = test_df[feature_columns]

        # 2. Check if actual ground-truth target column is provided
        has_ground_truth = False
        y_true = None
        evaluation_metrics = {}

        if target_column and target_column in test_df.columns:
            target_series = test_df[target_column].dropna()
            if not target_series.empty:
                has_ground_truth = True
                if problem_type == "classification" and target_encoder:
                    try:
                        y_true = target_encoder.transform(test_df[target_column].astype(str))
                    except Exception:
                        y_true = test_df[target_column].values
                else:
                    y_true = pd.to_numeric(test_df[target_column], errors='coerce').values

        # 3. Generate Predictions
        y_pred_raw = pipeline.predict(X_test)
        
        probabilities = None
        if problem_type == "classification" and hasattr(pipeline, "predict_proba"):
            try:
                probabilities = pipeline.predict_proba(X_test).tolist()
            except Exception:
                pass

        # Decode predicted class labels if classification
        if problem_type == "classification" and target_encoder:
            try:
                y_pred_decoded = target_encoder.inverse_transform(y_pred_raw).tolist()
            except Exception:
                y_pred_decoded = [str(p) for p in y_pred_raw]
        else:
            y_pred_decoded = [float(p) if isinstance(p, (np.floating, float)) else p for p in y_pred_raw]

        # 4. Calculate Ground-Truth Evaluation Metrics if Available
        if has_ground_truth and y_true is not None:
            if problem_type == "classification":
                acc = float(accuracy_score(y_true, y_pred_raw))
                prec = float(precision_score(y_true, y_pred_raw, average="weighted", zero_division=0))
                rec = float(recall_score(y_true, y_pred_raw, average="weighted", zero_division=0))
                f1 = float(f1_score(y_true, y_pred_raw, average="weighted", zero_division=0))
                cm = confusion_matrix(y_true, y_pred_raw).tolist()
                evaluation_metrics = {
                    "mode": "evaluation_mode",
                    "accuracy": round(acc, 4),
                    "precision": round(prec, 4),
                    "recall": round(rec, 4),
                    "f1_score": round(f1, 4),
                    "confusion_matrix": cm,
                    "evaluated_samples": len(X_test)
                }
            elif problem_type == "regression":
                valid_idx = ~np.isnan(y_true)
                if np.sum(valid_idx) > 0:
                    mae = float(mean_absolute_error(y_true[valid_idx], y_pred_raw[valid_idx]))
                    mse = float(mean_squared_error(y_true[valid_idx], y_pred_raw[valid_idx]))
                    rmse = float(np.sqrt(mse))
                    r2 = float(r2_score(y_true[valid_idx], y_pred_raw[valid_idx]))
                    evaluation_metrics = {
                        "mode": "evaluation_mode",
                        "mae": round(mae, 4),
                        "mse": round(mse, 4),
                        "rmse": round(rmse, 4),
                        "r2_score": round(r2, 4),
                        "evaluated_samples": int(np.sum(valid_idx))
                    }
        else:
            evaluation_metrics = {
                "mode": "prediction_only_mode",
                "message": "Prediction-only mode (ground-truth target column was not provided).",
                "predicted_samples": len(X_test)
            }

        # 5. Build Combined Input + Prediction Table Rows
        prediction_rows = []
        for idx in range(len(test_df)):
            row_dict = test_df.iloc[idx].to_dict()
            pred_val = y_pred_decoded[idx] if idx < len(y_pred_decoded) else None
            
            # Format nicely
            row_dict["__ml_prediction"] = pred_val
            if probabilities and idx < len(probabilities):
                max_prob = max(probabilities[idx])
                row_dict["__ml_confidence"] = round(max_prob * 100, 1)

            prediction_rows.append(row_dict)

        # 6. Generate Prediction Visualizations
        pred_charts = self._build_prediction_charts(problem_type, y_pred_decoded, probabilities, bundle.get("classes"))

        return {
            "problem_type": problem_type,
            "target_column": target_column,
            "has_ground_truth": has_ground_truth,
            "evaluation_metrics": evaluation_metrics,
            "total_records": len(test_df),
            "rows": prediction_rows[:500], # Cap for frontend view
            "columns": list(test_df.columns) + ["__ml_prediction"] + (["__ml_confidence"] if probabilities else []),
            "charts": pred_charts
        }

    def _build_prediction_charts(
        self,
        problem_type: str,
        predictions: List[Any],
        probabilities: Optional[List[List[float]]],
        classes: Optional[List[str]]
    ) -> List[Dict[str, Any]]:
        """Constructs automated charts visualizing prediction distributions."""
        charts = []

        if problem_type == "classification":
            # Class distribution bar / donut
            counts = pd.Series(predictions).value_counts().to_dict()
            chart_rows = [{"category": str(k), "count": int(v)} for k, v in counts.items()]
            charts.append({
                "title": "Predicted Class Distribution",
                "chart_type": "Donut",
                "x_axis": "category",
                "y_axis": "count",
                "columns": ["category", "count"],
                "rows": chart_rows
            })

            # Confidence probability histogram
            if probabilities:
                top_probs = [round(max(p) * 100, 1) for p in probabilities]
                prob_bins = pd.cut(top_probs, bins=[0, 50, 70, 85, 95, 100], labels=["<50%", "50-70%", "70-85%", "85-95%", "95-100%"]).value_counts().to_dict()
                charts.append({
                    "title": "Model Prediction Confidence Distribution",
                    "chart_type": "Bar",
                    "x_axis": "confidence_bucket",
                    "y_axis": "count",
                    "columns": ["confidence_bucket", "count"],
                    "rows": [{"confidence_bucket": str(k), "count": int(v)} for k, v in prob_bins.items()]
                })

        elif problem_type == "regression":
            # Continuous prediction distribution
            pred_series = pd.Series(predictions)
            bins = pd.qcut(pred_series, q=min(5, len(pred_series)), duplicates='drop').value_counts().to_dict()
            charts.append({
                "title": "Predicted Value Distribution",
                "chart_type": "Bar",
                "x_axis": "range_bucket",
                "y_axis": "count",
                "columns": ["range_bucket", "count"],
                "rows": [{"range_bucket": str(k), "count": int(v)} for k, v in bins.items()]
            })

        return charts

    async def generate_prediction_insights(
        self,
        model_name: str,
        problem_type: str,
        target_column: Optional[str],
        prediction_summary: Dict[str, Any],
        model: Optional[str] = None
    ) -> str:
        """
        On-demand LLM interpretation of test/prediction results.
        """
        prompt = f"""You are a Lead Data Science Consultant. Interpret the machine learning prediction outcomes for the deployed model '{model_name}'.

MODEL CONTEXT:
- Model Name: {model_name}
- Problem Type: {problem_type.upper()}
- Target Column: {target_column or 'Clustering'}
- Evaluation Summary:
{json.dumps(prediction_summary, indent=2)}

INSTRUCTIONS:
1. Provide a professional, structured Markdown report.
2. Include headings: `### Overall Prediction Summary`, `### Key Segment Patterns`, `### High-Impact / Outlier Observations`, `### Recommended Business Actions`.
3. Use bullet points and **bold** values for important findings.
4. Keep insights grounded, objective, and clearly labeled as AI-Generated Insights.
"""
        messages = [
            {"role": "system", "content": "You are a helpful business intelligence & data science advisor."},
            {"role": "user", "content": prompt}
        ]

        try:
            resp = await groq_client.get_chat_completion(
                messages=messages,
                model=model,
                temperature=0.3,
                max_tokens=settings.widget_insight_max_tokens,
                json_mode=False,
                task_name="Prediction Insights"
            )
            return resp
        except Exception as e:
            logger.error(f"Failed to generate prediction insights: {e}")
            return f"Unable to generate prediction insights: {str(e)}"

testing_service = TestingService()
