from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, text
from datetime import datetime
from backend.database.session import Base, history_engine
import json

class QueryHistory(Base):
    __tablename__ = "query_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=True, index=True, default=None)
    conversation_id = Column(String(50), nullable=False, index=True)
    prompt = Column(Text, nullable=False)
    generated_sql = Column(Text, nullable=False)
    edited_sql = Column(Text, nullable=True)
    execution_time_ms = Column(Float, nullable=False)
    rows_count = Column(Integer, nullable=False)
    chart_type = Column(String(50), nullable=True)
    chart_config = Column(Text, nullable=True) # Stored as JSON string
    insights = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    database_name = Column(String(100), nullable=False)
    model_used = Column(String(100), nullable=False)
    is_favorite = Column(Boolean, default=False)
    is_pinned = Column(Boolean, default=False)
    session_name = Column(String(150), nullable=True)

    def to_dict(self) -> dict:
        """Converts the SQLAlchemy model to a serializable dictionary."""
        parsed_chart_config = None
        if self.chart_config:
            try:
                parsed_chart_config = json.loads(self.chart_config)
            except Exception:
                parsed_chart_config = self.chart_config

        return {
            "id": self.id,
            "user_id": self.user_id,
            "conversation_id": self.conversation_id,
            "prompt": self.prompt,
            "generated_sql": self.generated_sql,
            "edited_sql": self.edited_sql,
            "execution_time_ms": self.execution_time_ms,
            "rows_count": self.rows_count,
            "chart_type": self.chart_type,
            "chart_config": parsed_chart_config,
            "insights": self.insights,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "database_name": self.database_name,
            "model_used": self.model_used,
            "is_favorite": self.is_favorite,
            "is_pinned": self.is_pinned,
            "session_name": self.session_name
        }

def init_history_db():
    """Automatically creates the query history tables if they do not exist and migrates columns."""
    Base.metadata.create_all(bind=history_engine)
    with history_engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE query_history ADD COLUMN user_id VARCHAR(64)"))
            conn.commit()
        except Exception:
            pass # Column already exists
        try:
            conn.execute(text("UPDATE query_history SET user_id = 'usr_v' WHERE user_id IS NULL OR user_id = ''"))
            conn.commit()
        except Exception:
            pass
