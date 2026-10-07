from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

class DatasetCreateRequest(BaseModel):
    name: Optional[str] = None

class DatasetUpdateRequest(BaseModel):
    name: Optional[str] = None

class DatasetResponse(BaseModel):
    id: str
    name: str
    original_filename: str
    file_path: str
    processed_file_path: Optional[str] = None
    file_size_bytes: int
    row_count: int
    column_count: int
    column_metadata: Dict[str, Any]
    data_quality: Dict[str, Any]
    data_transformations: Optional[List[Dict[str, Any]]] = []
    saved_queries: Optional[List[str]] = []
    available_sheets: Optional[List[str]] = []
    active_sheet: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class SwitchSheetRequest(BaseModel):
    sheet_name: str = Field(..., description="Target sheet name to switch to")

class DatasetPreviewResponse(BaseModel):
    columns: List[str]
    rows: List[Dict[str, Any]]
    total_rows: int
    total_columns: int
    column_types: Dict[str, str]
    sql_types: Optional[Dict[str, str]] = {}
    mixed_columns: Optional[List[str]] = []

class ProjectCreateRequest(BaseModel):
    name: str = Field(..., description="Name of the project session")

class ProjectTransformRequest(BaseModel):
    transformation_type: str = Field(..., description="add_column | rename_column | drop_column | fill_missing | drop_na_rows | drop_duplicates | filter_rows | cast_type | replace_values | reset_raw")
    params: Dict[str, Any] = Field(default_factory=dict)

class ProjectQueryRequest(BaseModel):
    query: str = Field(..., description="SQL query string to execute against 'dataset'")
    limit: Optional[int] = 100

class ProjectChatRequest(BaseModel):
    message: str = Field(..., description="User message to data assistant")
    model: Optional[str] = None

