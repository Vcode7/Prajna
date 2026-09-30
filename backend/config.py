import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    # API Configurations (Primary + 4 Fallback Keys)
    groq_api_key: str = Field(default="", validation_alias="GROQ_API_KEY")
    groq_api_key_fallback1: str = Field(default="", validation_alias="GROQ_API_KEY_FALLBACK1")
    groq_api_key_fallback2: str = Field(default="", validation_alias="GROQ_API_KEY_FALLBACK2")
    groq_api_key_fallback3: str = Field(default="", validation_alias="GROQ_API_KEY_FALLBACK3")
    groq_api_key_fallback4: str = Field(default="", validation_alias="GROQ_API_KEY_FALLBACK4")

    def get_all_groq_api_keys(self) -> list[str]:
        """
        Returns all configured Groq API keys in priority order:
        [primary, fallback1, fallback2, fallback3, fallback4], filtering out empty strings.
        """
        keys = []
        if self.groq_api_key and self.groq_api_key.strip():
            keys.append(self.groq_api_key.strip())
        for fb in [
            self.groq_api_key_fallback1,
            self.groq_api_key_fallback2,
            self.groq_api_key_fallback3,
            self.groq_api_key_fallback4,
        ]:
            if fb and fb.strip():
                keys.append(fb.strip())
        return keys
    
    # Model Configurations
    default_model: str = Field(default="qwen/qwen3.8-27b", validation_alias="DEFAULT_MODEL")
    temperature: float = Field(default=0.0, validation_alias="LLM_TEMPERATURE")
    max_tokens: int = Field(default=4096, validation_alias="LLM_MAX_TOKENS")
    
    # Ollama Fallback Configurations
    ollama_base_url: str = Field(default="http://localhost:11434", validation_alias="OLLAMA_BASE_URL")
    ollama_model: str = Field(default="qwen3:4b-instruct", validation_alias="OLLAMA_MODEL")
    ollama_timeout: Optional[float] = Field(default=None, validation_alias="OLLAMA_TIMEOUT")
    
    # Database Configurations
    database_url: str = Field(default="sqlite:///e:/projects/sql-llm/backend/data/enterprise_erp.db", validation_alias="DATABASE_URL")
    history_database_url: str = Field(default="sqlite:///e:/projects/sql-llm/backend/data/history.db", validation_alias="HISTORY_DATABASE_URL")
    
    # Performance & Security
    schema_cache_ttl: int = Field(default=300, validation_alias="SCHEMA_CACHE_TTL")
    sql_execution_timeout: float = Field(default=30.0, validation_alias="SQL_EXECUTION_TIMEOUT")
    max_rows_limit: int = Field(default=1000, validation_alias="MAX_ROWS_LIMIT")
    use_ai_charts: bool = Field(default=False, validation_alias="USE_AI_CHARTS")
    
    # Task-Specific Max Token Limits
    query_planner_max_tokens: int = Field(default=500, validation_alias="QUERY_PLANNER_MAX_TOKENS")
    sql_generation_max_tokens: int = Field(default=800, validation_alias="SQL_GENERATION_MAX_TOKENS")
    sql_repair_max_tokens: int = Field(default=800, validation_alias="SQL_REPAIR_MAX_TOKENS")
    zero_row_repair_max_tokens: int = Field(default=600, validation_alias="ZERO_ROW_REPAIR_MAX_TOKENS")
    executive_summary_max_tokens: int = Field(default=300, validation_alias="EXECUTIVE_SUMMARY_MAX_TOKENS")
    widget_insight_max_tokens: int = Field(default=500, validation_alias="WIDGET_INSIGHT_MAX_TOKENS")
    chart_generation_max_tokens: int = Field(default=300, validation_alias="CHART_GENERATION_MAX_TOKENS")
    chat_max_tokens: int = Field(default=1500, validation_alias="CHAT_MAX_TOKENS")
    
    # CORS
    allowed_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*"
    ]

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(__file__), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Ensure the database directory exists
db_dir = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(db_dir, exist_ok=True)
