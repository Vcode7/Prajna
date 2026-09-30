from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class DashboardCreateRequest(BaseModel):
    project_id: Optional[str] = None
    title: Optional[str] = "Executive Dashboard"
    description: Optional[str] = None
    tabs: Optional[List[Dict[str, Any]]] = None
    settings: Optional[Dict[str, Any]] = None

class DashboardUpdateRequest(BaseModel):
    project_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    tabs: Optional[List[Dict[str, Any]]] = None
    settings: Optional[Dict[str, Any]] = None

class AddVisualizationToDashboardRequest(BaseModel):
    visualization_id: Optional[str] = None
    tab_id: Optional[str] = None # if None, add to first tab
    visualization_config: Optional[Dict[str, Any]] = None
    col_span: Optional[int] = 6
    height: Optional[int] = 360

class DashboardForecastRequest(BaseModel):
    model_id: str
    dataset_id: Optional[str] = None
    x_variable: Optional[str] = None
    y_variable: Optional[str] = None
    horizon: Optional[int] = 3 # number of future periods (e.g. 3 months)
    historical_data: Optional[List[Dict[str, Any]]] = None

class AIDashboardGenerateRequest(BaseModel):
    project_id: str
    dashboard_title: Optional[str] = None
    model: Optional[str] = None  # override LLM model (e.g. specific Groq model)

class AskAICardRequest(BaseModel):
    dashboard_id: Optional[str] = None
    tab_id: Optional[str] = None
    card_id: str
    user_prompt: str
    project_id: Optional[str] = None
    current_card: Dict[str, Any]
    conversation_history: Optional[List[Dict[str, str]]] = None
    model: Optional[str] = None

