"""
Forecasting Service — Chart-Based Time-Series Forecasting ML Pipeline

Handles:
1. Auto-detection of date/time columns and target metrics from chart metadata.
2. LLM-driven forecasting approach selection (not hardcoded to LSTM).
3. Time-series data preparation with sliding-window/lag features.
4. Training multiple forecasting model types.
5. Evaluation with MAE, RMSE, MAPE.
6. Forecast generation and Actual vs Predicted visualization data.
"""

import os
import time
import json
import joblib
import logging
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

from sklearn.preprocessing import MinMaxScaler, StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression, Ridge, Lasso
from sklearn.tree import DecisionTreeRegressor
from sklearn.neighbors import KNeighborsRegressor
from sklearn.neural_network import MLPRegressor

from backend.llm.client import groq_client
from backend.config import settings

logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# Registry of forecasting techniques the LLM can choose from
FORECASTING_TECHNIQUES = {
    "linear_trend": {
        "name": "Linear Trend",
        "description": "Simple linear regression on time index. Best for data with clear linear upward/downward trends.",
        "min_rows": 10
    },
    "ridge_trend": {
        "name": "Ridge Regression (Lag Features)",
        "description": "Ridge regression with lag-based features. Good for moderately complex trends with some seasonality.",
        "min_rows": 20
    },
    "random_forest_forecast": {
        "name": "Random Forest Forecaster",
        "description": "Ensemble tree model with lag/window features. Handles non-linear patterns and seasonality well.",
        "min_rows": 30
    },
    "gradient_boosting_forecast": {
        "name": "Gradient Boosting Forecaster",
        "description": "Sequential boosting with lag features. Often best accuracy for complex time-series with mixed patterns.",
        "min_rows": 30
    },
    "knn_forecast": {
        "name": "KNN Forecaster",
        "description": "K-Nearest Neighbors with lag features. Good for repeating local patterns.",
        "min_rows": 20
    },
    "mlp_forecast": {
        "name": "Neural Network (MLP) Forecaster",
        "description": "Multi-layer perceptron with lag features. Captures complex non-linear temporal dynamics.",
        "min_rows": 50
    },
    "lstm_forecast": {
        "name": "Long Short-Term Memory (LSTM)",
        "description": "Recurrent neural network with sequential memory cells. Optimal for complex sequential dynamics with non-linear dependencies and sufficient observations.",
        "min_rows": 35
    },
    "moving_average": {
        "name": "Weighted Moving Average",
        "description": "Exponentially weighted moving average extrapolation. Simple, robust baseline for stable series.",
        "min_rows": 5
    }
}


try:
    import torch
    import torch.nn as nn

    class _LSTMNetwork(nn.Module):
        def __init__(self, in_d: int, h_d: int, n_l: int = 1):
            super().__init__()
            self.lstm = nn.LSTM(in_d, h_d, num_layers=n_l, batch_first=True)
            self.fc = nn.Linear(h_d, 1)

        def forward(self, x):
            out, _ = self.lstm(x)
            return self.fc(out[:, -1, :])
except Exception:
    _LSTMNetwork = None


class PyTorchLSTMForecaster:
    """PyTorch-based LSTM regressor with sklearn-compatible fit and predict."""
    def __init__(self, hidden_dim: int = 32, num_layers: int = 1, epochs: int = 60, lr: float = 0.01, random_state: int = 42):
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        self.epochs = epochs
        self.lr = lr
        self.random_state = random_state
        self.model = None

    def fit(self, X: np.ndarray, y: np.ndarray):
        try:
            import torch
            import torch.nn as nn
            torch.manual_seed(self.random_state)
            
            input_dim = X.shape[1]
            self.model = _LSTMNetwork(input_dim, self.hidden_dim, self.num_layers)
            criterion = nn.MSELoss()
            optimizer = torch.optim.Adam(self.model.parameters(), lr=self.lr)
            
            X_tensor = torch.tensor(X, dtype=torch.float32).unsqueeze(1)
            y_tensor = torch.tensor(y, dtype=torch.float32).unsqueeze(1)
            
            self.model.train()
            for _ in range(self.epochs):
                optimizer.zero_grad()
                preds = self.model(X_tensor)
                loss = criterion(preds, y_tensor)
                loss.backward()
                optimizer.step()
        except Exception as e:
            logger.warning(f"PyTorch LSTM training fallback: {e}")
            from sklearn.neural_network import MLPRegressor
            self.model = MLPRegressor(hidden_layer_sizes=(64, 32), max_iter=300, random_state=self.random_state)
            self.model.fit(X, y)
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        if self.model is None:
            return np.zeros(len(X))
        try:
            import torch
            if isinstance(self.model, torch.nn.Module):
                self.model.eval()
                with torch.no_grad():
                    X_tensor = torch.tensor(X, dtype=torch.float32).unsqueeze(1)
                    preds = self.model(X_tensor).squeeze(-1).cpu().numpy()
                    if preds.ndim == 0:
                        return np.array([float(preds)])
                    return preds.flatten()
            else:
                return self.model.predict(X)
        except Exception as e:
            logger.warning(f"PyTorch LSTM predict fallback: {e}")
            if hasattr(self.model, 'predict'):
                return self.model.predict(X)
            return np.zeros(len(X))



class ForecastingService:

    def detect_chart_time_series(
        self,
        df: pd.DataFrame,
        chart_meta: Dict[str, Any],
        col_meta: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyzes a chart's underlying data to detect:
        - The date/time column (x-axis candidate)
        - The target metric column (y-axis candidate)
        - Whether the data is suitable for time-series forecasting
        """
        x_var = chart_meta.get("x_variable")
        y_var = chart_meta.get("y_variable")

        # 1. Detect date/time column
        date_column = None
        date_candidates = []

        # First check x_variable from chart
        if x_var and x_var in df.columns:
            if self._is_datetime_column(df, x_var, col_meta):
                date_column = x_var
            else:
                date_candidates.append(x_var)

        # Then check all columns
        if not date_column:
            for col in df.columns:
                if self._is_datetime_column(df, col, col_meta):
                    date_column = col
                    break

        # Try parsing x_var as date even if not flagged
        if not date_column and x_var and x_var in df.columns:
            try:
                parsed = pd.to_datetime(df[x_var], errors='coerce')
                if parsed.notna().sum() > len(df) * 0.5:
                    date_column = x_var
            except Exception:
                pass

        # 2. Detect target metric column
        target_column = None
        if y_var and y_var in df.columns:
            if pd.api.types.is_numeric_dtype(df[y_var]):
                target_column = y_var

        if not target_column:
            # Find the best numeric column
            numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c]) and c != date_column]
            if numeric_cols:
                target_column = numeric_cols[0]

        # 3. Determine suitability
        is_suitable = date_column is not None and target_column is not None
        row_count = len(df)

        return {
            "is_suitable": is_suitable,
            "date_column": date_column,
            "target_column": target_column,
            "row_count": row_count,
            "reason": (
                f"Detected date column '{date_column}' and target metric '{target_column}' with {row_count} observations."
                if is_suitable else
                f"Could not detect {'date/time column' if not date_column else 'numeric target metric'} for forecasting."
            )
        }

    def _is_datetime_column(self, df: pd.DataFrame, col: str, col_meta: Dict[str, Any]) -> bool:
        """Check if a column is datetime type."""
        meta_type = col_meta.get(col, {}).get("data_type", "")
        if meta_type == "datetime":
            return True
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            return True
        # Check column name patterns
        date_keywords = ['date', 'time', 'timestamp', 'datetime', 'year', 'month', 'period', 'day']
        col_lower = col.lower()
        if any(kw in col_lower for kw in date_keywords):
            try:
                parsed = pd.to_datetime(df[col], errors='coerce')
                return parsed.notna().sum() > len(df) * 0.5
            except Exception:
                return False
        return False

    async def select_forecasting_approach(
        self,
        dataset_name: str,
        date_column: str,
        target_column: str,
        row_count: int,
        data_summary: Dict[str, Any],
        model: Optional[str] = None,
        user_instructions: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Uses LLM to select the most appropriate forecasting technique
        based on the data characteristics.
        """
        available_techniques = []
        for tech_id, tech in FORECASTING_TECHNIQUES.items():
            if row_count >= tech["min_rows"]:
                available_techniques.append(f"- {tech['name']} ({tech_id}): {tech['description']}")

        if not available_techniques:
            # Fallback to simplest
            return {
                "technique_id": "moving_average",
                "technique_name": "Weighted Moving Average",
                "reasoning": "Dataset too small for complex models. Using moving average baseline.",
                "hyperparameters": {"window": 3}
            }

        user_hint = f"\nUser instructions: {user_instructions}" if user_instructions else ""

        prompt = f"""You are a Senior Time-Series Forecasting Engineer. Analyze the following dataset and select the most appropriate forecasting technique.

DATASET:
- Name: {dataset_name}
- Date/Time Column: {date_column}
- Target Metric: {target_column}
- Total Observations: {row_count}
- Data Summary: {json.dumps(data_summary, default=str)}
{user_hint}

AVAILABLE FORECASTING TECHNIQUES:
{chr(10).join(available_techniques)}

INSTRUCTIONS:
1. Analyze the data characteristics (trend, seasonality, volatility, data volume).
2. Select the single BEST technique from the available list.
3. Specify appropriate hyperparameters.
4. Provide clear reasoning.

Return JSON ONLY matching this exact structure:
{{
  "technique_id": "the_technique_id_from_list",
  "technique_name": "Human readable name",
  "reasoning": "Why this technique is the best fit for this data...",
  "hyperparameters": {{"lag_window": 7, "n_estimators": 100}},
  "preprocessing_notes": "Any preprocessing recommendations"
}}"""

        messages = [
            {"role": "system", "content": "You are a professional time-series forecasting advisor. Return valid JSON only."},
            {"role": "user", "content": prompt}
        ]

        try:
            resp = await groq_client.get_chat_completion(
                messages=messages,
                model=model,
                temperature=0.2,
                max_tokens=settings.chat_max_tokens,
                json_mode=True,
                task_name="Forecasting Approach Selection"
            )
            result = json.loads(resp)
            # Validate technique_id
            if result.get("technique_id") not in FORECASTING_TECHNIQUES:
                # Find closest match
                for tid in FORECASTING_TECHNIQUES:
                    if tid in str(result).lower():
                        result["technique_id"] = tid
                        result["technique_name"] = FORECASTING_TECHNIQUES[tid]["name"]
                        break
                else:
                    result["technique_id"] = "gradient_boosting_forecast"
                    result["technique_name"] = "Gradient Boosting Forecaster"
            return result
        except Exception as e:
            logger.error(f"Failed to get LLM forecasting recommendation: {e}")
            # Intelligent fallback
            if row_count >= 50:
                return {
                    "technique_id": "gradient_boosting_forecast",
                    "technique_name": "Gradient Boosting Forecaster",
                    "reasoning": "Default: Gradient Boosting provides strong baseline for most time-series data.",
                    "hyperparameters": {"n_estimators": 100, "lag_window": 7, "learning_rate": 0.1}
                }
            elif row_count >= 20:
                return {
                    "technique_id": "random_forest_forecast",
                    "technique_name": "Random Forest Forecaster",
                    "reasoning": "Default: Random Forest handles medium-sized datasets with unknown patterns well.",
                    "hyperparameters": {"n_estimators": 100, "lag_window": 5}
                }
            else:
                return {
                    "technique_id": "linear_trend",
                    "technique_name": "Linear Trend",
                    "reasoning": "Small dataset — linear trend is the most reliable approach.",
                    "hyperparameters": {"lag_window": 3}
                }

    def prepare_time_series_data(
        self,
        df: pd.DataFrame,
        date_column: str,
        target_column: str,
        lag_window: int = 7,
        aggregation: Optional[str] = None
    ) -> Tuple[pd.DataFrame, MinMaxScaler, Dict[str, Any]]:
        """
        Prepares time-series data with sliding-window/lag-based features.
        Returns: (prepared_df, target_scaler, data_range_info)
        """
        work_df = df.copy()

        # Parse and sort by date
        work_df[date_column] = pd.to_datetime(work_df[date_column], errors='coerce')
        work_df = work_df.dropna(subset=[date_column, target_column])
        work_df = work_df.sort_values(date_column).reset_index(drop=True)

        # If aggregation needed (e.g. multiple records per date)
        if aggregation and aggregation != 'none':
            agg_func = {'sum': 'sum', 'avg': 'mean', 'mean': 'mean', 'max': 'max', 'min': 'min'}.get(aggregation, 'mean')
            work_df = work_df.groupby(date_column).agg({target_column: agg_func}).reset_index()
            work_df = work_df.sort_values(date_column).reset_index(drop=True)

        # Ensure target is numeric
        work_df[target_column] = pd.to_numeric(work_df[target_column], errors='coerce')
        work_df = work_df.dropna(subset=[target_column])

        if len(work_df) < 3:
            raise ValueError(f"Insufficient data points ({len(work_df)}) for time-series forecasting. Need at least 3.")

        # Scale target
        scaler = MinMaxScaler(feature_range=(0, 1))
        scaled_values = scaler.fit_transform(work_df[[target_column]].values)
        work_df['_scaled_target'] = scaled_values.flatten()

        # Create lag features
        lag_window = min(lag_window, max(1, len(work_df) // 3))
        for i in range(1, lag_window + 1):
            work_df[f'lag_{i}'] = work_df['_scaled_target'].shift(i)

        # Rolling statistics
        if lag_window >= 3:
            work_df['rolling_mean_3'] = work_df['_scaled_target'].rolling(window=min(3, lag_window)).mean().shift(1)
            work_df['rolling_std_3'] = work_df['_scaled_target'].rolling(window=min(3, lag_window)).std().shift(1)
        if lag_window >= 7:
            work_df['rolling_mean_7'] = work_df['_scaled_target'].rolling(window=min(7, lag_window)).mean().shift(1)

        # Time-based features from date
        work_df['_month'] = work_df[date_column].dt.month / 12.0
        work_df['_day_of_week'] = work_df[date_column].dt.dayofweek / 6.0
        work_df['_day_of_year'] = work_df[date_column].dt.dayofyear / 365.0
        work_df['_time_index'] = np.arange(len(work_df)) / float(max(1, len(work_df) - 1))

        # Drop rows with NaN from lagging
        work_df = work_df.dropna().reset_index(drop=True)

        # Data range info
        data_range = {
            "start": str(work_df[date_column].iloc[0]),
            "end": str(work_df[date_column].iloc[-1]),
            "count": len(work_df),
            "original_count": len(df),
            "lag_window": lag_window
        }

        return work_df, scaler, data_range

    def train_forecast_model(
        self,
        experiment_id: str,
        df: pd.DataFrame,
        date_column: str,
        target_column: str,
        technique_id: str,
        hyperparameters: Dict[str, Any],
        forecast_horizon: int = 12
    ) -> Dict[str, Any]:
        """
        Trains a forecasting model using sliding-window/lag-based features.
        """
        start_time = time.perf_counter()
        logger.info(f"Starting forecast training: {technique_id} for target '{target_column}'")

        lag_window = int(hyperparameters.get("lag_window", 7))

        # 1. Prepare time-series data
        prepared_df, scaler, data_range = self.prepare_time_series_data(
            df, date_column, target_column, lag_window=lag_window
        )

        if len(prepared_df) < 5:
            raise ValueError(f"Insufficient prepared data ({len(prepared_df)} rows) after lag creation.")

        # 2. Build feature matrix
        feature_cols = [c for c in prepared_df.columns if c.startswith(('lag_', 'rolling_', '_month', '_day_', '_time_'))]
        X = prepared_df[feature_cols].values
        y = prepared_df['_scaled_target'].values

        # 3. Chronological train/test split (no shuffling!)
        split_idx = max(3, int(len(X) * 0.8))
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]

        dates_test = prepared_df[date_column].iloc[split_idx:].values
        dates_all = prepared_df[date_column].values

        # 4. Build estimator
        estimator = self._get_forecast_estimator(technique_id, hyperparameters)

        # 5. Train
        estimator.fit(X_train, y_train)

        # 6. Evaluate on test set
        y_pred_scaled = estimator.predict(X_test)
        y_pred_actual = scaler.inverse_transform(y_pred_scaled.reshape(-1, 1)).flatten()
        y_test_actual = scaler.inverse_transform(y_test.reshape(-1, 1)).flatten()

        # Calculate metrics
        mae = float(mean_absolute_error(y_test_actual, y_pred_actual))
        mse = float(mean_squared_error(y_test_actual, y_pred_actual))
        rmse = float(np.sqrt(mse))
        r2 = float(r2_score(y_test_actual, y_pred_actual)) if len(y_test_actual) > 1 else 0.0

        # MAPE (avoid division by zero)
        non_zero_mask = np.abs(y_test_actual) > 1e-8
        if non_zero_mask.sum() > 0:
            mape = float(np.mean(np.abs((y_test_actual[non_zero_mask] - y_pred_actual[non_zero_mask]) / y_test_actual[non_zero_mask])) * 100)
        else:
            mape = None

        metrics = {
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "mse": round(mse, 4),
            "r2_score": round(r2, 4),
            "mape": round(mape, 2) if mape is not None else None,
            "train_samples": len(X_train),
            "test_samples": len(X_test),
            "lag_window": lag_window
        }

        # 7. Generate Actual vs Predicted for visualization
        y_all_pred_scaled = estimator.predict(X)
        y_all_pred = scaler.inverse_transform(y_all_pred_scaled.reshape(-1, 1)).flatten()
        y_all_actual = scaler.inverse_transform(y.reshape(-1, 1)).flatten()

        actual_vs_predicted = []
        for i in range(len(y_all_actual)):
            actual_vs_predicted.append({
                "date": str(dates_all[i])[:10] if hasattr(dates_all[i], 'isoformat') else str(dates_all[i])[:10],
                "actual": round(float(y_all_actual[i]), 2),
                "predicted": round(float(y_all_pred[i]), 2),
                "split": "train" if i < split_idx else "test"
            })

        # 8. Generate future forecasts
        future_predictions = self._generate_future_forecasts(
            estimator, prepared_df, feature_cols, scaler,
            date_column, target_column, forecast_horizon, lag_window
        )

        # 9. Save model bundle
        model_artifact_filename = f"{experiment_id}_forecast_{technique_id}.joblib"
        model_artifact_path = os.path.join(MODELS_DIR, model_artifact_filename)

        bundle = {
            "pipeline": estimator,
            "scaler": scaler,
            "feature_columns": feature_cols,
            "date_column": date_column,
            "target_column": target_column,
            "technique_id": technique_id,
            "lag_window": lag_window,
            "problem_type": "forecasting",
            "hyperparameters": hyperparameters,
            "metrics": metrics,
            "data_range": data_range,
            "trained_at": datetime.utcnow().isoformat()
        }
        joblib.dump(bundle, model_artifact_path)

        duration = round(time.perf_counter() - start_time, 2)

        forecast_data = {
            "actual_vs_predicted": actual_vs_predicted,
            "future_predictions": future_predictions,
            "color_actual": "#6366f1",
            "color_predicted": "#10b981",
            "color_future": "#f97316"
        }

        scaler_info = {
            "type": "MinMaxScaler",
            "feature_range": [0, 1],
            "data_min": float(scaler.data_min_[0]) if hasattr(scaler, 'data_min_') else None,
            "data_max": float(scaler.data_max_[0]) if hasattr(scaler, 'data_max_') else None,
            "scale": float(scaler.scale_[0]) if hasattr(scaler, 'scale_') else None
        }

        return {
            "status": "completed",
            "technique_id": technique_id,
            "technique_name": FORECASTING_TECHNIQUES.get(technique_id, {}).get("name", technique_id),
            "date_column": date_column,
            "target_column": target_column,
            "metrics": metrics,
            "forecast_data": forecast_data,
            "scaler_info": scaler_info,
            "training_data_range": data_range,
            "model_artifact_path": model_artifact_path,
            "training_time_seconds": duration,
            "forecast_horizon": forecast_horizon
        }

    def _get_forecast_estimator(self, technique_id: str, hyperparameters: Dict[str, Any]):
        """Instantiates the appropriate forecasting estimator."""
        params = {k: v for k, v in hyperparameters.items() if v is not None and k != 'lag_window'}

        if technique_id == "linear_trend":
            return LinearRegression()
        elif technique_id == "ridge_trend":
            return Ridge(alpha=float(params.get("alpha", 1.0)), random_state=42)
        elif technique_id == "random_forest_forecast":
            return RandomForestRegressor(
                n_estimators=int(params.get("n_estimators", 100)),
                max_depth=int(params.get("max_depth", 10)) if params.get("max_depth") else None,
                random_state=42
            )
        elif technique_id == "gradient_boosting_forecast":
            return GradientBoostingRegressor(
                n_estimators=int(params.get("n_estimators", 100)),
                learning_rate=float(params.get("learning_rate", 0.1)),
                max_depth=int(params.get("max_depth", 3)),
                random_state=42
            )
        elif technique_id == "knn_forecast":
            return KNeighborsRegressor(
                n_neighbors=int(params.get("n_neighbors", 5))
            )
        elif technique_id == "mlp_forecast":
            return MLPRegressor(
                hidden_layer_sizes=tuple(params.get("hidden_layer_sizes", [64, 32])),
                max_iter=int(params.get("max_iter", 500)),
                random_state=42
            )
        elif technique_id == "lstm_forecast":
            return PyTorchLSTMForecaster(
                hidden_dim=int(params.get("hidden_dim", 32)),
                num_layers=int(params.get("num_layers", 1)),
                epochs=int(params.get("epochs", 60)),
                lr=float(params.get("lr", 0.01)),
                random_state=42
            )
        elif technique_id == "moving_average":
            # Wrap moving average in a simple linear regression (acts as weighted average)
            return LinearRegression()
        else:
            # Default fallback
            return GradientBoostingRegressor(n_estimators=100, random_state=42)

    def _generate_future_forecasts(
        self,
        estimator,
        prepared_df: pd.DataFrame,
        feature_cols: List[str],
        scaler: MinMaxScaler,
        date_column: str,
        target_column: str,
        horizon: int,
        lag_window: int
    ) -> List[Dict[str, Any]]:
        """
        Iteratively generates future forecasts by feeding predictions back as features.
        """
        # Get the last row's features as starting point
        recent_values = list(prepared_df['_scaled_target'].values[-lag_window:])
        last_date = pd.Timestamp(prepared_df[date_column].iloc[-1])

        # Detect frequency
        if len(prepared_df) >= 2:
            date_diffs = prepared_df[date_column].diff().dropna()
            median_diff = date_diffs.median()
        else:
            median_diff = pd.Timedelta(days=30)

        predictions = []
        for step in range(horizon):
            # Build feature vector
            feature_dict = {}
            for i in range(1, lag_window + 1):
                idx = len(recent_values) - i
                feature_dict[f'lag_{i}'] = recent_values[idx] if idx >= 0 else 0.0

            # Rolling stats
            recent_window = recent_values[-min(3, lag_window):]
            if f'rolling_mean_3' in feature_cols:
                feature_dict['rolling_mean_3'] = np.mean(recent_window) if recent_window else 0.0
            if f'rolling_std_3' in feature_cols:
                feature_dict['rolling_std_3'] = np.std(recent_window) if len(recent_window) > 1 else 0.0
            recent_window_7 = recent_values[-min(7, lag_window):]
            if f'rolling_mean_7' in feature_cols:
                feature_dict['rolling_mean_7'] = np.mean(recent_window_7) if recent_window_7 else 0.0

            # Time features
            future_date = last_date + median_diff * (step + 1)
            feature_dict['_month'] = future_date.month / 12.0
            feature_dict['_day_of_week'] = future_date.dayofweek / 6.0
            feature_dict['_day_of_year'] = future_date.dayofyear / 365.0
            feature_dict['_time_index'] = 1.0 + (step + 1) * 0.01  # Extrapolation index

            # Build ordered feature array
            feature_vector = np.array([[feature_dict.get(f, 0.0) for f in feature_cols]])

            # Predict
            pred_scaled = estimator.predict(feature_vector)[0]
            pred_actual = scaler.inverse_transform([[pred_scaled]])[0][0]

            predictions.append({
                "date": future_date.strftime("%Y-%m-%d"),
                "predicted": round(float(pred_actual), 2),
                "step": step + 1
            })

            # Feed prediction back
            recent_values.append(float(pred_scaled))

        return predictions


forecasting_service = ForecastingService()
