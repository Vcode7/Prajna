from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

class ProblemTypeDetectRequest(BaseModel):
    dataset_id: str
    target_column: Optional[str] = None

class MLRecommendRequest(BaseModel):
    dataset_id: str
    target_column: Optional[str] = None
    problem_type: Optional[str] = None
    feature_columns: Optional[List[str]] = None
    model: Optional[str] = None

class MLTrainRequest(BaseModel):
    dataset_id: str
    visualization_id: Optional[str] = None
    source_visualization_ids: Optional[List[str]] = Field(default_factory=list)
    model_name: str
    problem_type: str # classification, regression, clustering, time_series
    target_column: Optional[str] = None
    feature_columns: List[str]
    ignored_columns: List[str] = Field(default_factory=list)
    algorithm: str
    hyperparameters: Dict[str, Any] = Field(default_factory=dict)
    train_config: Dict[str, Any] = Field(default_factory=lambda: {
        "test_size": 0.2,
        "random_state": 42,
        "scaling": "standard",
        "encoding": "onehot",
        "imputation": "mean_mode"
    })

class TestingPredictRequest(BaseModel):
    model_id: str
    # Either raw data rows or upload via form-data
    data: Optional[List[Dict[str, Any]]] = None

class TestingInsightsRequest(BaseModel):
    model_id: str
    prediction_summary: Dict[str, Any]
    model: Optional[str] = None


class TargetCorrelationRequest(BaseModel):
    dataset_id: str
    target_column: Optional[str] = None


class TargetCorrelationResponse(BaseModel):
    target_column: Optional[str] = None
    target_type: Optional[str] = None
    correlations: List[Dict[str, Any]] = Field(default_factory=list)
    pairwise_matrix: Optional[Dict[str, Any]] = None
    eligible_columns: List[str] = Field(default_factory=list)


class MLAIDecideRequest(BaseModel):
    dataset_id: str
    target_mode: Optional[str] = "ai"  # "ai" or "manual"
    target_column: Optional[str] = None
    feature_mode: Optional[str] = "ai"  # "ai" or "manual"
    feature_columns: Optional[List[str]] = None
    category_mode: Optional[str] = "ai"  # "ai" or "manual"
    ml_category: Optional[str] = None  # regression, classification, clustering, dimensionality_reduction, anomaly_detection
    algorithm_mode: Optional[str] = "ai"  # "ai" or "manual"
    algorithm: Optional[str] = None
    user_instructions: Optional[str] = None
    model: Optional[str] = None


class MLAIDecideResponse(BaseModel):
    target_column: Optional[str] = None
    feature_columns: List[str] = Field(default_factory=list)
    ml_category: str
    algorithm: str
    hyperparameters: Optional[Dict[str, Any]] = None
    reasoning: Dict[str, Any] = Field(default_factory=dict)
    correlations: Optional[List[Dict[str, Any]]] = None
    pairwise_matrix: Optional[Dict[str, Any]] = None
    eligible_columns: List[str] = Field(default_factory=list)


# ── Chart-Based Forecasting ML Schemas ──────────────────────────

class ChartForecastTrainRequest(BaseModel):
    """Request to train a forecasting model from a specific chart."""
    dataset_id: str
    chart_id: str  # The visualization/chart ID to forecast
    model_name: Optional[str] = None
    forecast_horizon: Optional[int] = 12  # Number of future periods
    model: Optional[str] = None  # LLM model override for approach selection
    user_instructions: Optional[str] = None  # Optional user hints


class ChartModelActivateRequest(BaseModel):
    """Request to activate a specific model for a chart."""
    experiment_id: str
    chart_id: str

