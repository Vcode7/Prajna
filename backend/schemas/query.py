from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class GenerateSQLRequest(BaseModel):
    prompt: str = Field(..., description="The natural language user query")
    conversation_id: str = Field(..., description="UUID or ID of the chat conversation session")
    model: Optional[str] = Field(None, description="Optional LLM model override")
    use_ai_charts: Optional[bool] = Field(None, description="Override AI chart generation setting for this request")

class ExecuteSQLRequest(BaseModel):
    sql: str = Field(..., description="The SQL query to execute")
    prompt: str = Field(..., description="The original natural language query")
    conversation_id: str = Field(..., description="UUID or ID of the chat session")

class RepairSQLRequest(BaseModel):
    sql: str = Field(..., description="The failing SQL query")
    error: str = Field(..., description="The database error message")

class ChartRequest(BaseModel):
    prompt: str = Field(..., description="The user query context")
    columns: List[str] = Field(..., description="List of returned column names")
    rows: List[Dict[str, Any]] = Field(..., description="List of returned row dictionaries")
    model: Optional[str] = Field(None, description="Optional LLM model override")

class InsightsRequest(BaseModel):
    prompt: str = Field(..., description="The user query context")
    sql: str = Field(..., description="The executed SQL query")
    columns: List[str] = Field(..., description="List of returned column names")
    rows: List[Dict[str, Any]] = Field(..., description="List of returned row dictionaries")
    model: Optional[str] = Field(None, description="Optional LLM model override")

class WidgetInsightsRequest(BaseModel):
    widget_id: str = Field(..., description="The widget identifier")
    user_query: str = Field(..., description="The original natural language query")
    sql: str = Field(..., description="The executed SQL for this widget")
    columns: List[str] = Field(..., description="Column names from the result set")
    rows: List[Dict[str, Any]] = Field(..., description="Result rows (frontend sends a sample)")
    row_count: int = Field(..., description="Total number of rows returned by the query")
    model: Optional[str] = Field(None, description="Optional LLM model override")

class HistorySaveRequest(BaseModel):
    conversation_id: str
    prompt: str
    generated_sql: str
    edited_sql: Optional[str] = None
    execution_time_ms: float
    rows_count: int
    chart_type: Optional[str] = None
    chart_config: Optional[Dict[str, Any]] = None
    insights: Optional[str] = None
    database_name: str
    model_used: str

class HistoryUpdateRequest(BaseModel):
    is_favorite: Optional[bool] = None
    is_pinned: Optional[bool] = None
    session_name: Optional[str] = None

class DashboardRequest(BaseModel):
    prompt: str = Field(..., description="The dashboard generation request, e.g., 'Create sales dashboard'")
    model: Optional[str] = Field(None, description="Optional LLM model override")
