from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

class DeployModelRequest(BaseModel):
    experiment_id: str
    deployment_name: str
    version: str = "1.0.0"
    description: Optional[str] = ""
    tags: List[str] = Field(default_factory=list)

class DeploymentUpdateRequest(BaseModel):
    deployment_name: Optional[str] = None
    version: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None

class InferenceRequest(BaseModel):
    deployment_id: Optional[str] = None
    model_id: Optional[str] = None
    records: List[Dict[str, Any]]
    column_mapping: Optional[Dict[str, str]] = None

class InferenceInsightsRequest(BaseModel):
    deployment_id: Optional[str] = None
    model_name: Optional[str] = None
    input_summary: Optional[Dict[str, Any]] = None
    predictions_summary: Dict[str, Any] = Field(default_factory=dict)
    model: Optional[str] = None
