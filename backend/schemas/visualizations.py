from pydantic import BaseModel, Field, model_validator
from typing import Dict, Any, List, Optional

class VisualizationFilter(BaseModel):
    column: str
    operator: str # eq, neq, gt, gte, lt, lte, in, contains, between
    value: Any

class VisualizationCreateRequest(BaseModel):
    dataset_id: str
    category: str = "custom" # single_variable, bi_variable, multi_variable, custom
    chart_type: str = "Bar"
    x_variable: Optional[str] = None
    y_variable: Optional[str] = None
    group_variable: Optional[str] = None
    size_variable: Optional[str] = None
    aggregation: str = "none"
    filters: List[Dict[str, Any]] = Field(default_factory=list)
    title: str = "New Visualization"
    description: Optional[str] = ""
    configuration: Dict[str, Any] = Field(default_factory=dict)

class VisualizationUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    chart_type: Optional[str] = None
    x_variable: Optional[str] = None
    y_variable: Optional[str] = None
    group_variable: Optional[str] = None
    size_variable: Optional[str] = None
    aggregation: Optional[str] = None
    filters: Optional[List[Dict[str, Any]]] = None
    configuration: Optional[Dict[str, Any]] = None

class VisualizationDataQueryRequest(BaseModel):
    dataset_id: str
    chart_type: str
    x_variable: Optional[str] = None
    y_variable: Optional[str] = None
    group_variable: Optional[str] = None
    size_variable: Optional[str] = None
    aggregation: str = "none"
    filters: List[Dict[str, Any]] = Field(default_factory=list)
    limit: Optional[int] = 1000

class ChatToSpecRequest(BaseModel):
    dataset_id: str
    user_prompt: Optional[str] = None
    message: Optional[str] = None
    model: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("user_prompt") and data.get("message"):
                data["user_prompt"] = data["message"]
            elif not data.get("message") and data.get("user_prompt"):
                data["message"] = data["user_prompt"]
        return data

class VisualizationInsightsRequest(BaseModel):
    visualization_id: Optional[str] = None
    dataset_id: Optional[str] = None
    title: str
    chart_type: str
    x_variable: Optional[str] = None
    y_variable: Optional[str] = None
    aggregated_data: List[Dict[str, Any]] = Field(default_factory=list)
    columns: List[str] = Field(default_factory=list)
    model: Optional[str] = None

class GenerateAIImportantVisualizationsRequest(BaseModel):
    dataset_id: str
    model: Optional[str] = None

class VisualizationAIChatRequest(BaseModel):
    dataset_id: str
    message: Optional[str] = None
    user_prompt: Optional[str] = None
    history: List[Dict[str, Any]] = Field(default_factory=list)
    conversation_history: Optional[List[Dict[str, Any]]] = None
    current_spec: Optional[Dict[str, Any]] = None
    current_chart_spec: Optional[Dict[str, Any]] = None
    model: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Resolve message / user_prompt
            if not data.get("message") and data.get("user_prompt"):
                data["message"] = data["user_prompt"]
            elif not data.get("user_prompt") and data.get("message"):
                data["user_prompt"] = data["message"]

            # Resolve history / conversation_history
            if "history" not in data and "conversation_history" in data:
                data["history"] = data["conversation_history"]
            elif "conversation_history" not in data and "history" in data:
                data["conversation_history"] = data["history"]

            # Resolve current_spec / current_chart_spec
            if not data.get("current_spec") and data.get("current_chart_spec"):
                data["current_spec"] = data["current_chart_spec"]
            elif not data.get("current_chart_spec") and data.get("current_spec"):
                data["current_chart_spec"] = data["current_spec"]

        return data

