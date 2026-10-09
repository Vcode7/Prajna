from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import json
import uuid
from backend.database.session import Base, engine

import math
import numpy as np

def generate_uuid():
    return str(uuid.uuid4())

def sanitize_for_json(obj):
    if isinstance(obj, bool):
        return obj
    elif isinstance(obj, (float, np.floating)):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return float(obj)
    elif isinstance(obj, (int, np.integer)):
        return int(obj)
    elif isinstance(obj, np.ndarray):
        return sanitize_for_json(obj.tolist())
    elif isinstance(obj, dict):
        return {str(k): sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple, set)):
        return [sanitize_for_json(v) for v in obj]
    return obj

class User(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=True)
    company = Column(String(255), nullable=True)
    role = Column(String(100), default="Enterprise Administrator")
    plan = Column(String(100), default="Enterprise Dedicated")
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "name": self.name or self.username,
            "company": self.company or "PRAJNA",
            "role": self.role or "Enterprise Administrator",
            "plan": self.plan or "Enterprise Dedicated",
            "initials": (self.name or self.username)[:2].upper(),
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class DatasetSession(Base):
    __tablename__ = "dataset_sessions"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), nullable=True, index=True, default=None)
    name = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)
    processed_file_path = Column(Text, nullable=True)
    file_size_bytes = Column(Integer, default=0)
    row_count = Column(Integer, default=0)
    column_count = Column(Integer, default=0)
    
    # JSON-encoded column metadata, data quality, and derived features
    column_metadata = Column(JSON, default=dict)
    data_quality = Column(JSON, default=dict)
    derived_features = Column(JSON, default=list)
    data_transformations = Column(JSON, default=list)
    saved_queries = Column(JSON, default=list)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    visualizations = relationship("SavedVisualization", back_populates="dataset", cascade="all, delete-orphan")
    experiments = relationship("MLExperiment", back_populates="dataset", cascade="all, delete-orphan")
    dashboards = relationship("SavedDashboard", back_populates="dataset", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "original_filename": self.original_filename,
            "file_path": self.file_path,
            "processed_file_path": self.processed_file_path,
            "file_size_bytes": self.file_size_bytes,
            "row_count": self.row_count,
            "column_count": self.column_count,
            "column_metadata": self.column_metadata or {},
            "data_quality": self.data_quality or {},
            "derived_features": self.derived_features or [],
            "data_transformations": self.data_transformations or [],
            "saved_queries": self.saved_queries or [],
            "available_sheets": (self.column_metadata or {}).get("_sheets", []),
            "active_sheet": (self.column_metadata or {}).get("_active_sheet", None),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class SavedVisualization(Base):
    __tablename__ = "saved_visualizations"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    dataset_id = Column(String(64), ForeignKey("dataset_sessions.id", ondelete="CASCADE"), nullable=False)
    category = Column(String(50), nullable=False, default="single_variable") # single_variable, bi_variable, multi_variable, custom
    chart_type = Column(String(50), nullable=False, default="Bar") # Bar, Horizontal Bar, Line, Area, Pie, Donut, Scatter, Stacked Bar, Stacked Area, Treemap, Metric
    x_variable = Column(String(100), nullable=True)
    y_variable = Column(String(100), nullable=True)
    group_variable = Column(String(100), nullable=True)
    size_variable = Column(String(100), nullable=True)
    aggregation = Column(String(50), default="none") # none, count, sum, avg, median, min, max
    filters = Column(JSON, default=list)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    configuration = Column(JSON, default=dict)
    insights = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    dataset = relationship("DatasetSession", back_populates="visualizations")
    experiments = relationship("MLExperiment", back_populates="source_visualization")

    def to_dict(self):
        return {
            "id": self.id,
            "dataset_id": self.dataset_id,
            "category": self.category,
            "chart_type": self.chart_type,
            "x_variable": self.x_variable,
            "y_variable": self.y_variable,
            "group_variable": self.group_variable,
            "size_variable": self.size_variable,
            "aggregation": self.aggregation,
            "filters": self.filters or [],
            "title": self.title,
            "description": self.description,
            "configuration": self.configuration or {},
            "insights": self.insights,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class MLExperiment(Base):
    __tablename__ = "ml_experiments"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    dataset_id = Column(String(64), ForeignKey("dataset_sessions.id", ondelete="CASCADE"), nullable=False)
    visualization_id = Column(String(64), ForeignKey("saved_visualizations.id", ondelete="SET NULL"), nullable=True)
    source_visualization_ids = Column(JSON, default=list)
    
    # Workflow type: 'general' (default) or 'chart_forecast'
    workflow_type = Column(String(50), default="general")
    # Chart-based forecasting fields
    chart_id = Column(String(64), nullable=True)  # The specific chart/visualization this forecast belongs to
    date_column = Column(String(100), nullable=True)  # Detected date/time column
    forecast_horizon = Column(Integer, nullable=True)  # Number of future periods predicted
    forecast_data = Column(JSON, default=dict)  # Forecast results: actual_vs_predicted, future_predictions
    scaler_info = Column(JSON, default=dict)  # Preprocessing/scaler metadata for reproducibility
    training_data_range = Column(JSON, default=dict)  # {"start": "...", "end": "...", "count": N}
    is_active_for_chart = Column(Boolean, default=False)  # Whether this is the active model for its chart

    model_name = Column(String(255), nullable=False)
    problem_type = Column(String(50), nullable=False) # classification, regression, clustering, time_series, forecasting
    target_column = Column(String(100), nullable=True)
    feature_columns = Column(JSON, default=list)
    ignored_columns = Column(JSON, default=list)
    algorithm = Column(String(100), nullable=False)
    hyperparameters = Column(JSON, default=dict)
    train_config = Column(JSON, default=dict) # test_size, random_state, scaling, encoding, cv
    
    metrics = Column(JSON, default=dict)
    feature_importances = Column(JSON, default=list)
    model_artifact_path = Column(Text, nullable=True)
    training_time_seconds = Column(Float, default=0.0)
    
    status = Column(String(50), default="queued") # queued, running, completed, failed, cancelled
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    dataset = relationship("DatasetSession", back_populates="experiments")
    source_visualization = relationship("SavedVisualization", back_populates="experiments")
    deployment = relationship("DeployedModel", back_populates="experiment", uselist=False, cascade="all, delete-orphan")

    def to_dict(self):
        result = {
            "id": self.id,
            "dataset_id": self.dataset_id,
            "visualization_id": self.visualization_id,
            "source_visualization_ids": self.source_visualization_ids or [],
            "workflow_type": self.workflow_type or "general",
            "chart_id": self.chart_id,
            "chart_title": self.source_visualization.title if self.source_visualization else None,
            "dataset_name": self.dataset.name if self.dataset else None,
            "date_column": self.date_column,
            "forecast_horizon": self.forecast_horizon,
            "forecast_data": self.forecast_data or {},
            "scaler_info": self.scaler_info or {},
            "training_data_range": self.training_data_range or {},
            "is_active_for_chart": bool(self.is_active_for_chart),
            "model_name": self.model_name,
            "problem_type": self.problem_type,
            "target_column": self.target_column,
            "feature_columns": self.feature_columns or [],
            "ignored_columns": self.ignored_columns or [],
            "algorithm": self.algorithm,
            "hyperparameters": self.hyperparameters or {},
            "train_config": self.train_config or {},
            "metrics": sanitize_for_json(self.metrics or {}),
            "feature_importances": sanitize_for_json(self.feature_importances or []),
            "model_artifact_path": self.model_artifact_path,
            "training_time_seconds": self.training_time_seconds,
            "status": self.status,
            "error_message": self.error_message,
            "is_deployed": self.deployment is not None,
            "deployment_id": self.deployment.id if self.deployment else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
        return result

class DeployedModel(Base):
    __tablename__ = "deployed_models"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    experiment_id = Column(String(64), ForeignKey("ml_experiments.id", ondelete="CASCADE"), nullable=False)
    
    deployment_name = Column(String(255), nullable=False)
    version = Column(String(50), default="1.0.0")
    description = Column(Text, nullable=True)
    tags = Column(JSON, default=list)
    status = Column(String(50), default="active") # active, archived
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    experiment = relationship("MLExperiment", back_populates="deployment")
    predictions = relationship("PredictionLog", back_populates="deployment", cascade="all, delete-orphan")

    def to_dict(self):
        exp_dict = self.experiment.to_dict() if self.experiment else {}
        return {
            "id": self.id,
            "experiment_id": self.experiment_id,
            "deployment_name": self.deployment_name,
            "version": self.version,
            "description": self.description,
            "tags": self.tags or [],
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "experiment": exp_dict
        }

class PredictionLog(Base):
    __tablename__ = "prediction_logs"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    deployment_id = Column(String(64), ForeignKey("deployed_models.id", ondelete="CASCADE"), nullable=False)
    
    input_sample_count = Column(Integer, default=1)
    input_data_summary = Column(JSON, default=dict)
    prediction_results = Column(JSON, default=list)
    prediction_metrics = Column(JSON, default=dict)
    insights = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    deployment = relationship("DeployedModel", back_populates="predictions")

    def to_dict(self):
        return {
            "id": self.id,
            "deployment_id": self.deployment_id,
            "input_sample_count": self.input_sample_count,
            "input_data_summary": self.input_data_summary or {},
            "prediction_results": self.prediction_results or [],
            "prediction_metrics": self.prediction_metrics or {},
            "insights": self.insights,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class SavedDashboard(Base):
    __tablename__ = "dashboards"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    user_id = Column(String(64), nullable=True, index=True, default=None)
    project_id = Column(String(64), ForeignKey("dataset_sessions.id", ondelete="CASCADE"), nullable=True)
    title = Column(String(255), nullable=False, default="Executive Dashboard")
    description = Column(Text, nullable=True)
    tabs = Column(JSON, default=list)  # [{ id, name, layout: [...] }]
    settings = Column(JSON, default=dict)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    dataset = relationship("DatasetSession", back_populates="dashboards")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "project_id": self.project_id,
            "title": self.title,
            "description": self.description,
            "tabs": self.tabs or [],
            "settings": self.settings or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

from sqlalchemy import text

def init_app_db():
    """Initializes all application tables, runs column migrations, and seeds the master user."""
    Base.metadata.create_all(bind=engine)
    
    # Safe SQLite column migration for new fields
    with engine.connect() as conn:
        for table, col, col_type in [
            ("dataset_sessions", "data_transformations", "JSON"),
            ("dataset_sessions", "saved_queries", "JSON"),
            ("dataset_sessions", "user_id", "VARCHAR(64)"),
            ("dashboards", "user_id", "VARCHAR(64)"),
            ("ml_experiments", "source_visualization_ids", "JSON"),
            ("ml_experiments", "workflow_type", "VARCHAR(50) DEFAULT 'general'"),
            ("ml_experiments", "chart_id", "VARCHAR(64)"),
            ("ml_experiments", "date_column", "VARCHAR(100)"),
            ("ml_experiments", "forecast_horizon", "INTEGER"),
            ("ml_experiments", "forecast_data", "JSON"),
            ("ml_experiments", "scaler_info", "JSON"),
            ("ml_experiments", "training_data_range", "JSON"),
            ("ml_experiments", "is_active_for_chart", "BOOLEAN DEFAULT 0"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass # Column already exists

    # Seed master account 'v' (email: v@g.com, username: v, password: 123456)
    from backend.database.session import SessionLocal
    db = SessionLocal()
    try:
        # Purge any dummy demo accounts (Elena Vance, Marcus Chen, Sarah Jenkins, etc.)
        db.query(User).filter(
            User.id.in_(["usr_cdo_01", "usr_ds_02", "usr_an_03"]) |
            User.email.in_([
                "elena.vance@enterprise-corp.com",
                "marcus.chen@prajna.ai",
                "sarah.j@supplychain-global.io"
            ])
        ).delete(synchronize_session=False)

        user_v = db.query(User).filter((User.username == "v") | (User.email == "v@g.com")).first()
        if not user_v:
            user_v = User(
                id="usr_v",
                username="v",
                email="v@g.com",
                password_hash="123456",
                name="v",
                company="PRAJNA Analytics",
                role="Enterprise Administrator",
                plan="Enterprise Dedicated"
            )
            db.add(user_v)
            db.commit()
            db.refresh(user_v)
        else:
            # Ensure credentials match requirements
            user_v.username = "v"
            user_v.email = "v@g.com"
            user_v.password_hash = "123456"
            user_v.name = user_v.name or "v"
            db.commit()

        # Migrate all existing pre-authorization sessions and dashboards to user_v
        db.query(DatasetSession).filter(
            (DatasetSession.user_id == None) | (DatasetSession.user_id == "")
        ).update({"user_id": user_v.id}, synchronize_session=False)

        db.query(SavedDashboard).filter(
            (SavedDashboard.user_id == None) | (SavedDashboard.user_id == "")
        ).update({"user_id": user_v.id}, synchronize_session=False)

        db.commit()
    except Exception as e:
        import logging
        logging.getLogger("models").error(f"Error seeding user v: {e}")
        db.rollback()
    finally:
        db.close()



