from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from backend.config import settings
import logging

logger = logging.getLogger(__name__)

# Create Engine
# Use check_same_thread=False for SQLite to enable multithreading in FastAPI
engine_args = {}
if settings.database_url.startswith("sqlite"):
    engine_args["connect_args"] = {"check_same_thread": False}

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    **engine_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Dependency to get the database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Separate Engine for SQL History if it's in a different database
history_engine_args = {}
if settings.history_database_url.startswith("sqlite"):
    history_engine_args["connect_args"] = {"check_same_thread": False}

history_engine = create_engine(
    settings.history_database_url,
    pool_pre_ping=True,
    **history_engine_args
)
HistorySessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=history_engine)

def get_history_db():
    """Dependency to get the history database session."""
    db = HistorySessionLocal()
    try:
        yield db
    finally:
        db.close()
