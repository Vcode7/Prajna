import os
import io
import re
import json
import uuid
import logging
from datetime import datetime
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Header, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from backend.database.session import get_db
from backend.models.models import (
    DatasetSession, SavedVisualization, MLExperiment, DeployedModel, PredictionLog, SavedDashboard, User
)
from backend.schemas.dashboards import (
    DashboardCreateRequest, DashboardUpdateRequest,
    AddVisualizationToDashboardRequest, DashboardForecastRequest,
    AIDashboardGenerateRequest, AskAICardRequest
)
from backend.services.dashboard_service import dashboard_service
from backend.schemas.datasets import DatasetResponse, DatasetPreviewResponse, SwitchSheetRequest
from backend.schemas.visualizations import (
    VisualizationCreateRequest, VisualizationUpdateRequest,
    VisualizationDataQueryRequest, ChatToSpecRequest, VisualizationInsightsRequest,
    GenerateAIImportantVisualizationsRequest, VisualizationAIChatRequest
)
from backend.schemas.ml import (
    ProblemTypeDetectRequest, MLRecommendRequest, MLTrainRequest,
    TestingPredictRequest, TestingInsightsRequest,
    TargetCorrelationRequest, TargetCorrelationResponse,
    MLAIDecideRequest, MLAIDecideResponse,
    ChartForecastTrainRequest, ChartModelActivateRequest
)
from backend.schemas.deployments import (
    DeployModelRequest, DeploymentUpdateRequest, InferenceRequest, InferenceInsightsRequest
)
from backend.services.dataset_service import dataset_service, UPLOAD_DIR
from backend.services.visualization_service import visualization_service
from backend.services.ml_service import ml_service, TECHNIQUE_REGISTRY
from backend.services.training_engine import training_engine
from backend.services.testing_service import testing_service
from backend.services.deployment_service import deployment_service
from backend.services.forecasting_service import forecasting_service
from backend.services.project_service import project_service

logger = logging.getLogger(__name__)

router = APIRouter()

# ============================================================================
# 0. AUTHENTICATION & MULTI-TENANT ISOLATION ENDPOINTS
# ============================================================================

class LoginRequest(BaseModel):
    username_or_email: str
    password: str

class RegisterRequest(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    email: str
    password: str
    company: Optional[str] = None
    role: Optional[str] = None

@router.post("/auth/login")
def login_endpoint(req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticates user with username or email and password."""
    ident = req.username_or_email.strip().lower()
    user = db.query(User).filter(
        (func.lower(User.username) == ident) | (func.lower(User.email) == ident)
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid username/email or password.")

    if user.password_hash != req.password:
        raise HTTPException(status_code=401, detail="Invalid username/email or password.")

    token = f"prajna_token_{user.id}_{int(datetime.utcnow().timestamp())}"
    return {
        "user": user.to_dict(),
        "token": token
    }

@router.post("/auth/register")
def register_endpoint(req: RegisterRequest, db: Session = Depends(get_db)):
    """Registers a new distinct user account with isolated dataset and dashboard storage."""
    email = req.email.strip().lower()
    raw_user = req.username or email.split("@")[0]
    username = raw_user.strip().lower()

    if len(req.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters.")

    existing = db.query(User).filter(
        (func.lower(User.email) == email) | (func.lower(User.username) == username)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email or username already exists.")

    new_id = f"usr_{uuid.uuid4().hex[:12]}"
    new_user = User(
        id=new_id,
        username=username,
        email=email,
        password_hash=req.password,
        name=req.name or username.capitalize(),
        company=req.company or "Enterprise Corp",
        role=req.role or "Enterprise Analyst",
        plan="Enterprise Pilot"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = f"prajna_token_{new_user.id}_{int(datetime.utcnow().timestamp())}"
    return {
        "user": new_user.to_dict(),
        "token": token
    }

@router.get("/auth/me")
def get_me_endpoint(db: Session = Depends(get_db), x_user_id: Optional[str] = Header(None)):
    """Returns profile for currently authenticated user."""
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Authentication required.")
    user = db.query(User).filter(User.id == x_user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user.to_dict()

# ============================================================================
# 1. DATASETS ENDPOINTS
# ============================================================================

@router.post("/datasets/upload", response_model=DatasetResponse)
async def upload_dataset(
    files: List[UploadFile] = File(default=[]),
    file: Optional[UploadFile] = File(None),
    name: Optional[str] = Form(None),
    project_id: Optional[str] = Form(None),
    sheet_name: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None)
):
    """
    Uploads single or multiple CSV/Excel datasets. When multiple files are uploaded,
    each file is loaded as an individual sheet within a unified multi-sheet workbook,
    enabling seamless cross-sheet switching and multi-table queries.
    """
    try:
        upload_list: List[UploadFile] = []
        if files:
            for f in files:
                if f and f.filename and f.filename.strip():
                    upload_list.append(f)
        if file and file.filename and file.filename.strip():
            if not any(f.filename == file.filename for f in upload_list):
                upload_list.append(file)

        if not upload_list:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        # ── Case A: Multiple Files (Package each file as a distinct sheet) ──
        if len(upload_list) > 1:
            all_sheets: Dict[str, pd.DataFrame] = {}
            existing_sheet_names: set = set()
            total_bytes = 0
            all_filenames = []

            for uf in upload_list:
                content = await uf.read()
                if len(content) == 0:
                    continue
                total_bytes += len(content)
                all_filenames.append(uf.filename)
                file_base = os.path.splitext(uf.filename)[0].replace("_", " ").title()

                if dataset_service.is_excel_file(content, uf.filename):
                    excel_sheets = dataset_service.get_sheet_names(content, uf.filename)
                    for s in excel_sheets:
                        try:
                            sdf = dataset_service.read_excel_sheet(content, sheet_name=s)
                            if sdf is not None and not sdf.empty and len(sdf.columns) > 0:
                                sdf, _ = dataset_service.identify_and_convert_mixed_columns(sdf)
                                s_name = s if len(excel_sheets) > 1 and s != "Sheet1" else file_base
                                unique_s_name = dataset_service.sanitize_sheet_name(s_name, existing_sheet_names)
                                existing_sheet_names.add(unique_s_name.lower())
                                all_sheets[unique_s_name] = sdf
                        except Exception as ex:
                            logger.warning(f"Could not read sheet '{s}' from '{uf.filename}': {ex}")
                else:
                    try:
                        cdf = dataset_service.read_csv_robust(content)
                        if cdf is not None and not cdf.empty and len(cdf.columns) > 0:
                            cdf, _ = dataset_service.identify_and_convert_mixed_columns(cdf)
                            unique_s_name = dataset_service.sanitize_sheet_name(file_base, existing_sheet_names)
                            existing_sheet_names.add(unique_s_name.lower())
                            all_sheets[unique_s_name] = cdf
                    except Exception as ex:
                        logger.warning(f"Could not read CSV '{uf.filename}': {ex}")

            if not all_sheets:
                raise HTTPException(status_code=400, detail="None of the uploaded files contained valid tabular data.")

            sheet_names = list(all_sheets.keys())
            active_sheet = sheet_name if (sheet_name and sheet_name in sheet_names) else sheet_names[0]
            df = all_sheets[active_sheet]
            df, _ = dataset_service.identify_and_convert_mixed_columns(df)

            col_meta, data_quality = dataset_service.profile_dataset(df)
            df_processed, derived_features = dataset_service.generate_derived_features(df, col_meta)
            col_meta_processed, _ = dataset_service.profile_dataset(df_processed)
            col_meta_processed["_sheets"] = sheet_names
            col_meta_processed["_active_sheet"] = active_sheet

            workbook_bytes = dataset_service.create_multisheet_workbook_bytes(all_sheets)
            clean_first = os.path.splitext(upload_list[0].filename)[0].replace("_", " ").title()
            dataset_name = name or f"{clean_first} + {len(all_sheets) - 1} Sheets"
            safe_prefix = re.sub(r'[^a-zA-Z0-9_-]', '_', dataset_name)

            session_rec = None
            if project_id:
                session_rec = db.query(DatasetSession).filter(DatasetSession.id == project_id).first()

            if session_rec:
                if name:
                    session_rec.name = name
                session_rec.original_filename = ", ".join(all_filenames)
                session_rec.file_size_bytes = total_bytes
                session_rec.row_count = len(df_processed)
                session_rec.column_count = len(df_processed.columns)
                session_rec.column_metadata = col_meta_processed
                session_rec.data_quality = data_quality
                session_rec.derived_features = derived_features
                db.query(SavedVisualization).filter(SavedVisualization.dataset_id == session_rec.id).delete()
            else:
                session_rec = DatasetSession(
                    user_id=x_user_id or "usr_v",
                    name=dataset_name,
                    original_filename=", ".join(all_filenames),
                    file_path="",
                    file_size_bytes=total_bytes,
                    row_count=len(df_processed),
                    column_count=len(df_processed.columns),
                    column_metadata=col_meta_processed,
                    data_quality=data_quality,
                    derived_features=derived_features
                )
                db.add(session_rec)
                db.flush()

            raw_path, proc_path = dataset_service.save_multisheet_dataset_files(
                session_rec.id, workbook_bytes, df_processed, safe_prefix
            )
            session_rec.file_path = raw_path
            session_rec.processed_file_path = proc_path

            db.commit()
            db.refresh(session_rec)

            try:
                project_service.get_or_create_project_sqlite_db(session_rec, force_refresh=True)
            except Exception as build_err:
                logger.warning(f"Could not pre-build project SQLite DB at multi-file upload: {build_err}")

            return session_rec.to_dict()

        # ── Case B: Single File ──
        single_file = upload_list[0]
        content = await single_file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        dataset_name = name or os.path.splitext(single_file.filename)[0].replace("_", " ").title()

        # Multi-sheet Excel & CSV detection
        is_excel = dataset_service.is_excel_file(content, single_file.filename)
        sheet_names = dataset_service.get_sheet_names(content, single_file.filename) if is_excel else []
        active_sheet = sheet_name if (sheet_name and sheet_name in sheet_names) else (sheet_names[0] if sheet_names else None)

        df = dataset_service.read_file_robust(content, single_file.filename, sheet_name=active_sheet)
        if df.empty or len(df.columns) == 0:
            raise HTTPException(status_code=400, detail="File contains no valid columns or rows.")

        df, _ = dataset_service.identify_and_convert_mixed_columns(df)
        col_meta, data_quality = dataset_service.profile_dataset(df)
        df_processed, derived_features = dataset_service.generate_derived_features(df, col_meta)

        col_meta_processed, _ = dataset_service.profile_dataset(df_processed)
        if sheet_names:
            col_meta_processed["_sheets"] = sheet_names
            col_meta_processed["_active_sheet"] = active_sheet

        session_rec = None
        if project_id:
            session_rec = db.query(DatasetSession).filter(DatasetSession.id == project_id).first()

        if session_rec:
            if name:
                session_rec.name = name
            session_rec.original_filename = single_file.filename
            session_rec.file_size_bytes = len(content)
            session_rec.row_count = len(df_processed)
            session_rec.column_count = len(df_processed.columns)
            session_rec.column_metadata = col_meta_processed
            session_rec.data_quality = data_quality
            session_rec.derived_features = derived_features
            db.query(SavedVisualization).filter(SavedVisualization.dataset_id == session_rec.id).delete()
        else:
            session_rec = DatasetSession(
                user_id=x_user_id or "usr_v",
                name=dataset_name,
                original_filename=single_file.filename,
                file_path="",
                file_size_bytes=len(content),
                row_count=len(df_processed),
                column_count=len(df_processed.columns),
                column_metadata=col_meta_processed,
                data_quality=data_quality,
                derived_features=derived_features
            )
            db.add(session_rec)
            db.flush()

        raw_path, proc_path = dataset_service.save_dataset_files(
            session_rec.id, content, df_processed, single_file.filename
        )
        session_rec.file_path = raw_path
        session_rec.processed_file_path = proc_path

        db.commit()
        db.refresh(session_rec)

        try:
            project_service.get_or_create_project_sqlite_db(session_rec, force_refresh=True)
        except Exception as build_err:
            logger.warning(f"Could not pre-build project SQLite DB at upload: {build_err}")

        return session_rec.to_dict()

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading dataset: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to process CSV dataset: {str(e)}")

@router.get("/datasets", response_model=List[DatasetResponse])
def list_datasets(db: Session = Depends(get_db), x_user_id: Optional[str] = Header(None)):
    """Lists available dataset sessions filtered by authenticated user."""
    if not x_user_id:
        return []
    query = db.query(DatasetSession)
    if x_user_id == "usr_v":
        query = query.filter((DatasetSession.user_id == "usr_v") | (DatasetSession.user_id == None))
    else:
        query = query.filter(DatasetSession.user_id == x_user_id)
    datasets = query.order_by(DatasetSession.created_at.desc()).all()
    return [d.to_dict() for d in datasets]

@router.get("/datasets/{id}", response_model=DatasetResponse)
def get_dataset(id: str, db: Session = Depends(get_db)):
    """Fetches details for a specific dataset session."""
    dataset = db.query(DatasetSession).filter(DatasetSession.id == id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset.to_dict()

@router.get("/datasets/{id}/preview", response_model=DatasetPreviewResponse)
def get_dataset_preview(id: str, limit: int = 100, db: Session = Depends(get_db)):
    """Returns sample rows and columns for AG Grid."""
    dataset = db.query(DatasetSession).filter(DatasetSession.id == id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_to_read = dataset.processed_file_path or dataset.file_path
    if not file_to_read or not os.path.exists(file_to_read):
        return {
            "columns": [],
            "rows": [],
            "total_rows": 0,
            "total_columns": 0,
            "column_types": {},
            "sql_types": {},
            "mixed_columns": []
        }

    preview = dataset_service.get_preview_data(file_to_read, limit=limit)
    preview["total_rows"] = dataset.row_count

    # Enrich with stored column metadata if available
    col_meta = dataset.column_metadata or {}
    if "sql_types" not in preview:
        preview["sql_types"] = {}
    for col, m in col_meta.items():
        if isinstance(m, dict) and not str(col).startswith("_"):
            if m.get("data_type"):
                preview["column_types"][col] = m["data_type"]
            if m.get("sql_type"):
                preview["sql_types"][col] = m["sql_type"]
    preview["mixed_columns"] = (dataset.data_quality or {}).get("converted_mixed_columns", preview.get("mixed_columns", []))
    return preview

@router.get("/datasets/{id}/schema")
def get_dataset_schema_endpoint(id: str, db: Session = Depends(get_db)):
    """Returns dataset column metadata and SQL data types."""
    try:
        return project_service.get_project_schema(id, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/datasets/{id}")
def delete_dataset(id: str, db: Session = Depends(get_db)):
    """Deletes dataset session, associated files, visualizations, and experiments."""
    dataset = db.query(DatasetSession).filter(DatasetSession.id == id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Remove files
    if dataset.file_path and os.path.exists(dataset.file_path):
        try: os.remove(dataset.file_path)
        except Exception: pass
    if dataset.processed_file_path and os.path.exists(dataset.processed_file_path):
        try: os.remove(dataset.processed_file_path)
        except Exception: pass

    # Clean up persistent project SQLite database
    try:
        project_service.delete_project_sqlite_db(dataset.id)
    except Exception as del_err:
        logger.warning(f"Error cleaning up project SQLite DB: {del_err}")

    db.delete(dataset)
    db.commit()
    return {"message": f"Dataset '{dataset.name}' deleted successfully"}

@router.get("/datasets/{id}/export")
def export_dataset(id: str, db: Session = Depends(get_db)):
    """Downloads processed dataset as CSV."""
    dataset = db.query(DatasetSession).filter(DatasetSession.id == id).first()
    if not dataset or not dataset.processed_file_path or not os.path.exists(dataset.processed_file_path):
        raise HTTPException(status_code=404, detail="Processed dataset file not found")

    return FileResponse(
        dataset.processed_file_path,
        media_type="text/csv",
        filename=f"processed_{dataset.original_filename}"
    )

@router.get("/datasets/{id}/column-unique-values/{column}")
def get_column_unique_values(id: str, column: str, db: Session = Depends(get_db)):
    """Returns all distinct non-null values for a given column from the full dataset SQLite database."""
    dataset = db.query(DatasetSession).filter(DatasetSession.id == id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    try:
        result = project_service.query_project_data(
            id,
            f'SELECT DISTINCT "{column}" FROM dataset WHERE "{column}" IS NOT NULL AND "{column}" != "" ORDER BY "{column}"',
            db,
            limit=999999
        )
        values = [str(row[column]) for row in result.get("rows", []) if row.get(column) is not None]
        return {"column": column, "values": values, "count": len(values)}
    except Exception as e:
        logger.warning(f"column-unique-values fallback for column '{column}': {e}")
        # Fallback: read from CSV directly
        try:
            file_path = dataset.processed_file_path or dataset.file_path
            df = pd.read_csv(file_path, usecols=[column], dtype=str, low_memory=False)
            vals = sorted(df[column].dropna().unique().tolist())
            return {"column": column, "values": vals, "count": len(vals)}
        except Exception as e2:
            raise HTTPException(status_code=500, detail=f"Could not retrieve unique values: {e2}")

@router.post("/datasets/{id}/fix-formatting")
def fix_dataset_formatting(id: str, db: Session = Depends(get_db)):
    """
    Scans all text/string columns for invisible control characters (tabs, CR, LF, NUL, etc.)
    and removes ONLY those characters. Normal spaces and all printable content are preserved.
    Returns a summary of how many cells were cleaned and which columns were affected.
    """
    try:
        result = project_service.fix_formatting_data(project_id=id, db=db)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error fixing formatting for dataset {id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fix formatting: {str(e)}")


@router.get("/datasets/{id}/sheets")
def get_dataset_sheets(id: str, db: Session = Depends(get_db)):
    """Returns available sheet names for a multi-sheet dataset."""
    session = db.query(DatasetSession).filter(DatasetSession.id == id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Dataset session not found")
    sheets = (session.column_metadata or {}).get("_sheets", [])
    active = (session.column_metadata or {}).get("_active_sheet")
    return {"available_sheets": sheets, "active_sheet": active}

@router.post("/datasets/{id}/switch-sheet")
def switch_dataset_sheet(id: str, req: SwitchSheetRequest, db: Session = Depends(get_db)):
    """Switches the active sheet in a multi-sheet dataset and recomputes profile and recommended visualizations."""
    import re
    session = db.query(DatasetSession).filter(DatasetSession.id == id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Dataset session not found")
    if not session.file_path or not os.path.exists(session.file_path):
        raise HTTPException(status_code=400, detail="Original dataset file not found")

    sheet_names = dataset_service.get_sheet_names(session.file_path, session.original_filename)
    if req.sheet_name not in sheet_names:
        raise HTTPException(status_code=400, detail=f"Sheet '{req.sheet_name}' not found. Available: {sheet_names}")

    with open(session.file_path, 'rb') as f:
        raw_content = f.read()

    df = dataset_service.read_excel_sheet(raw_content, sheet_name=req.sheet_name)
    if df.empty or len(df.columns) == 0:
        raise HTTPException(status_code=400, detail=f"Sheet '{req.sheet_name}' is empty")

    df, _ = dataset_service.identify_and_convert_mixed_columns(df)
    col_meta, data_quality = dataset_service.profile_dataset(df)
    df_processed, derived_features = dataset_service.generate_derived_features(df, col_meta)
    col_meta_proc, _ = dataset_service.profile_dataset(df_processed)
    col_meta_proc["_sheets"] = sheet_names
    col_meta_proc["_active_sheet"] = req.sheet_name

    safe_sheet = re.sub(r'[^a-zA-Z0-9_-]', '_', req.sheet_name)
    proc_filename = f"{session.id}_processed_{safe_sheet}.csv"
    proc_path = os.path.join(UPLOAD_DIR, proc_filename)
    df_processed.to_csv(proc_path, index=False, encoding='utf-8')

    session.processed_file_path = proc_path
    session.row_count = len(df_processed)
    session.column_count = len(df_processed.columns)
    session.column_metadata = col_meta_proc
    session.data_quality = data_quality
    session.derived_features = derived_features

    db.commit()
    db.refresh(session)

    # Refresh persistent project SQLite database with new active sheet
    try:
        project_service.refresh_project_sqlite_db(session)
    except Exception as ref_err:
        logger.warning(f"Could not refresh persistent SQLite DB on sheet switch: {ref_err}")

    return session.to_dict()

# ============================================================================
# 2. VISUALIZATIONS ENDPOINTS
# ============================================================================

@router.get("/visualizations")
def list_visualizations(dataset_id: str, category: Optional[str] = None, db: Session = Depends(get_db)):
    """Lists saved and recommended visualizations for a dataset, syncing any dashboard cards for this dataset."""
    try:
        dashboards = db.query(SavedDashboard).filter(SavedDashboard.project_id == dataset_id).all()
        synced_any = False
        for dash in dashboards:
            if dash.tabs:
                if dashboard_service.sync_dashboard_cards_to_visualizations(db, dataset_id, dash.tabs, dash.title, dash.id):
                    flag_modified(dash, "tabs")
                    synced_any = True
        if synced_any:
            db.commit()
    except Exception as e:
        logger.warning(f"Error syncing dashboard cards on list_visualizations: {e}")

    q = db.query(SavedVisualization).filter(SavedVisualization.dataset_id == dataset_id)
    if category:
        q = q.filter(SavedVisualization.category == category)
    items = q.order_by(SavedVisualization.created_at.asc()).all()
    return [v.to_dict() for v in items]

@router.post("/visualizations")
def create_visualization(req: VisualizationCreateRequest, db: Session = Depends(get_db)):
    """Creates a new visualization."""
    vis = SavedVisualization(
        dataset_id=req.dataset_id,
        category=req.category,
        chart_type=req.chart_type,
        x_variable=req.x_variable,
        y_variable=req.y_variable,
        group_variable=req.group_variable,
        size_variable=req.size_variable,
        aggregation=req.aggregation,
        filters=req.filters,
        title=req.title,
        description=req.description,
        configuration=req.configuration
    )
    db.add(vis)
    db.commit()
    db.refresh(vis)
    return vis.to_dict()

@router.get("/visualizations/{id}")
def get_visualization(id: str, db: Session = Depends(get_db)):
    """Fetches details for a single visualization."""
    vis = db.query(SavedVisualization).filter(SavedVisualization.id == id).first()
    if not vis:
        raise HTTPException(status_code=404, detail="Visualization not found")
    return vis.to_dict()

@router.put("/visualizations/{id}")
def update_visualization(id: str, req: VisualizationUpdateRequest, db: Session = Depends(get_db)):
    """Updates an existing visualization."""
    vis = db.query(SavedVisualization).filter(SavedVisualization.id == id).first()
    if not vis:
        raise HTTPException(status_code=404, detail="Visualization not found")

    for key, val in req.dict(exclude_unset=True).items():
        if hasattr(vis, key) and val is not None:
            setattr(vis, key, val)

    db.commit()
    db.refresh(vis)
    return vis.to_dict()

@router.delete("/visualizations/{id}")
def delete_visualization(id: str, db: Session = Depends(get_db)):
    """Deletes a visualization."""
    vis = db.query(SavedVisualization).filter(SavedVisualization.id == id).first()
    if not vis:
        raise HTTPException(status_code=404, detail="Visualization not found")
    db.delete(vis)
    db.commit()
    return {"message": "Visualization deleted successfully"}

@router.post("/visualizations/query-data")
def query_visualization_data(req: VisualizationDataQueryRequest, db: Session = Depends(get_db)):
    """
    Dynamically slices, filters, aggregates, and transforms dataset data for ECharts.
    """
    dataset = db.query(DatasetSession).filter(DatasetSession.id == req.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Check if a custom SQL query was provided in filters
    if req.filters:
        for f in req.filters:
            if isinstance(f, dict) and f.get("sql_query"):
                try:
                    res = project_service.query_project_data(dataset.id, f["sql_query"], db, limit=req.limit or 100)
                    return {
                        "columns": res["columns"],
                        "rows": res["rows"],
                        "row_count": res["row_count"],
                        "chart_type": req.chart_type
                    }
                except Exception as e:
                    logger.warning(f"SQL execution in query_visualization_data failed: {e}")

    file_to_read = dataset.processed_file_path or dataset.file_path
    if not os.path.exists(file_to_read):
        raise HTTPException(status_code=404, detail="Dataset file missing")

    # If x_variable or y_variable is specified but not found in the active sheet,
    # check other processed sheets for multi-sheet workbooks
    if req.x_variable or req.y_variable:
        try:
            curr_cols = pd.read_csv(file_to_read, nrows=0).columns.tolist()
            req_cols = [c for c in [req.x_variable, req.y_variable] if c and c.lower() != "count"]
            if req_cols and not all(c in curr_cols for c in req_cols):
                import re
                sheets = (dataset.column_metadata or {}).get("_sheets", [])
                for s in sheets:
                    safe_s = re.sub(r'[^a-zA-Z0-9_-]', '_', s)
                    candidate = os.path.join(UPLOAD_DIR, f"{dataset.id}_processed_{safe_s}.csv")
                    if os.path.exists(candidate) and candidate != file_to_read:
                        cand_cols = pd.read_csv(candidate, nrows=0).columns.tolist()
                        if all(c in cand_cols for c in req_cols):
                            file_to_read = candidate
                            break
        except Exception as e:
            logger.debug(f"Sheet fallback resolution in query_visualization_data: {e}")

    chart_data = visualization_service.compute_visualization_data(
        file_path=file_to_read,
        chart_type=req.chart_type,
        x_variable=req.x_variable,
        y_variable=req.y_variable,
        group_variable=req.group_variable,
        size_variable=req.size_variable,
        aggregation=req.aggregation,
        filters=req.filters,
        limit=req.limit or 1000
    )
    return chart_data

@router.post("/visualizations/chat-to-spec")
async def chat_to_spec(req: ChatToSpecRequest, db: Session = Depends(get_db)):
    """
    LLM converts natural language query into a structured visualization specification with executed SQL for user confirmation.
    """
    dataset = db.query(DatasetSession).filter(DatasetSession.id == req.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    spec = await visualization_service.chat_to_visualization_spec(
        user_prompt=req.user_prompt,
        col_meta=dataset.column_metadata or {},
        model=req.model,
        dataset_id=dataset.id,
        db=db
    )
    return spec

@router.post("/visualizations/insights")
async def generate_visualization_insights(req: VisualizationInsightsRequest, db: Session = Depends(get_db)):
    """
    On-demand AI analytical interpretation of summarized chart data.
    """
    insights = await visualization_service.generate_visualization_insights(
        title=req.title,
        chart_type=req.chart_type,
        x_variable=req.x_variable or "",
        y_variable=req.y_variable or "",
        aggregated_data=req.aggregated_data,
        columns=req.columns,
        model=req.model
    )

    # If linked to a saved visualization, persist insights
    if req.visualization_id:
        vis = db.query(SavedVisualization).filter(SavedVisualization.id == req.visualization_id).first()
        if vis:
            vis.insights = insights
            db.commit()

    return {"insights": insights}

@router.post("/visualizations/generate-ai-important")
async def generate_ai_important_visualizations_endpoint(
    req: GenerateAIImportantVisualizationsRequest,
    db: Session = Depends(get_db)
):
    """
    Analyzes entire dataset across all sheets/tables and generates important visualizations using AI.
    """
    try:
        recs = await visualization_service.generate_ai_important_visualizations(
            dataset_id=req.dataset_id,
            db=db,
            model=req.model
        )
        return {
            "visualizations": recs,
            "count": len(recs),
            "message": f"Successfully generated {len(recs)} AI-curated visualizations across all sheets."
        }
    except ValueError as ve:
        if "not found" in str(ve).lower():
            raise HTTPException(status_code=404, detail=str(ve))
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error generating AI visualizations: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/visualizations/generate-ai-important-stream")
async def generate_ai_important_visualizations_stream_endpoint(
    req: GenerateAIImportantVisualizationsRequest,
    db: Session = Depends(get_db)
):
    """
    Progressively streams two-stage AI visualization generation via Server-Sent Events (SSE).
    Stage 1: 3 parallel planners (single, bi, multi-variable).
    Stage 2: Progressive independent chart generation, SQL validation, execution, and immediate SSE streaming.
    """
    session = db.query(DatasetSession).filter(DatasetSession.id == req.dataset_id).first()
    if not session:
        raise HTTPException(status_code=404, detail=f"Dataset project {req.dataset_id} not found")

    return StreamingResponse(
        visualization_service.stream_visualization_generation(
            dataset_id=req.dataset_id,
            db=db,
            model=req.model
        ),
        media_type="text/event-stream"
    )

@router.post("/visualizations/ai-chat")
async def visualization_ai_chat_endpoint(
    req: VisualizationAIChatRequest,
    db: Session = Depends(get_db)
):
    """
    Conversational Data + Visualization Assistant across all sheets/tables in dataset.
    """
    try:
        user_msg = req.message or req.user_prompt or ""
        hist = req.history if req.history else (req.conversation_history or [])
        curr_spec = req.current_spec or req.current_chart_spec
        res = await visualization_service.chat_with_data_and_visualization(
            dataset_id=req.dataset_id,
            user_message=user_msg,
            user_prompt=user_msg,
            history=hist,
            current_spec=curr_spec,
            db=db,
            model=req.model
        )
        return res
    except Exception as e:
        logger.error(f"Error in visualization AI chat: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# 3. ML TRAINING ENDPOINTS
# ============================================================================

@router.post("/ml/detect-problem")
def detect_ml_problem(req: ProblemTypeDetectRequest, db: Session = Depends(get_db)):
    """Auto-detects problem type (classification, regression, clustering) based on target."""
    dataset = db.query(DatasetSession).filter(DatasetSession.id == req.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_to_read = dataset.processed_file_path or dataset.file_path
    if not file_to_read or not os.path.exists(file_to_read):
        raise HTTPException(status_code=404, detail="Dataset file missing on server")
    if file_to_read.endswith('.xlsx') or file_to_read.endswith('.xls'):
        df = pd.read_excel(file_to_read, nrows=500)
    else:
        df = pd.read_csv(file_to_read, nrows=500, encoding='utf-8', on_bad_lines='skip')
    
    detection = ml_service.detect_problem_type(df, req.target_column, dataset.column_metadata or {})
    return detection

@router.get("/ml/techniques")
def list_ml_techniques(problem_type: str = "classification"):
    """Returns supported ML algorithms library for the problem type."""
    return ml_service.get_techniques_for_problem(problem_type)

@router.post("/ml/target-correlation", response_model=TargetCorrelationResponse)
def get_target_correlation_endpoint(req: TargetCorrelationRequest, db: Session = Depends(get_db)):
    """
    Computes pairwise correlation matrix and target-to-field correlations sorted by absolute strength.
    """
    dataset = db.query(DatasetSession).filter(DatasetSession.id == req.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_to_read = dataset.processed_file_path or dataset.file_path
    if not file_to_read or not os.path.exists(file_to_read):
        raise HTTPException(status_code=404, detail="Dataset file missing on server")

    try:
        if file_to_read.endswith(".xlsx") or file_to_read.endswith(".xls"):
            df = pd.read_excel(file_to_read)
        else:
            df = pd.read_csv(file_to_read, encoding='utf-8', on_bad_lines='skip')
    except Exception as e:
        logger.error(f"Error reading dataset file for correlation: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to read dataset: {str(e)}")

    res = ml_service.compute_correlation_matrix(
        df=df,
        target_column=req.target_column,
        col_meta=dataset.column_metadata or {}
    )
    return res

@router.post("/ml/ai-decide", response_model=MLAIDecideResponse)
def ai_decide_ml_build_endpoint(req: MLAIDecideRequest, db: Session = Depends(get_db)):
    """
    Automated 'Build using AI' workflow:
    Identifies target, calculates correlations, automatically selects most relevant features,
    detects problem type, and picks optimal ML algorithm.
    """
    dataset = db.query(DatasetSession).filter(DatasetSession.id == req.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_to_read = dataset.processed_file_path or dataset.file_path
    if not file_to_read or not os.path.exists(file_to_read):
        raise HTTPException(status_code=404, detail="Dataset file missing on server")

    try:
        if file_to_read.endswith(".xlsx") or file_to_read.endswith(".xls"):
            df = pd.read_excel(file_to_read)
        else:
            df = pd.read_csv(file_to_read, encoding='utf-8', on_bad_lines='skip')
    except Exception as e:
        logger.error(f"Error reading dataset file for AI decision: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to read dataset: {str(e)}")

    try:
        res = ml_service.ai_decide_ml_build(
            df=df,
            dataset_name=dataset.name,
            col_meta=dataset.column_metadata or {},
            target_column=req.target_column,
            target_mode=req.target_mode or "ai",
            feature_mode=req.feature_mode or "ai",
            feature_columns=req.feature_columns,
            user_instructions=req.user_instructions,
            model=req.model
        )
        return res
    except Exception as e:
        logger.error(f"AI Decide workflow failed: {e}")
        raise HTTPException(status_code=400, detail=f"AI Build decision failed: {str(e)}")

@router.post("/ml/recommend")
async def recommend_ml_method(req: MLRecommendRequest, db: Session = Depends(get_db)):
    """
    Calls LLM on-demand to recommend and rank the best ML techniques with reasoning.
    """
    dataset = db.query(DatasetSession).filter(DatasetSession.id == req.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    feature_cols = req.feature_columns or list((dataset.column_metadata or {}).keys())
    if req.target_column and req.target_column in feature_cols:
        feature_cols.remove(req.target_column)

    rec = await ml_service.recommend_best_training_method(
        dataset_name=dataset.name,
        row_count=dataset.row_count,
        col_count=dataset.column_count,
        problem_type=req.problem_type or "classification",
        target_column=req.target_column,
        feature_columns=feature_cols,
        col_meta=dataset.column_metadata or {},
        model=req.model
    )
    return rec

@router.post("/ml/train")
def train_model_endpoint(req: MLTrainRequest, db: Session = Depends(get_db)):
    """
    Executes training pipeline, validates data, fits estimator, computes metrics, and serializes artifact.
    """
    dataset = db.query(DatasetSession).filter(DatasetSession.id == req.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_to_read = dataset.processed_file_path or dataset.file_path
    if not os.path.exists(file_to_read):
        raise HTTPException(status_code=404, detail="Dataset file missing")

    # Create Experiment Record
    experiment = MLExperiment(
        dataset_id=req.dataset_id,
        visualization_id=req.visualization_id,
        source_visualization_ids=req.source_visualization_ids or ([req.visualization_id] if req.visualization_id else []),
        model_name=req.model_name,
        problem_type=req.problem_type,
        target_column=req.target_column,
        feature_columns=req.feature_columns,
        ignored_columns=req.ignored_columns,
        algorithm=req.algorithm,
        hyperparameters=req.hyperparameters,
        train_config=req.train_config,
        status="running"
    )
    db.add(experiment)
    db.commit()
    db.refresh(experiment)

    try:
        results = training_engine.train_model(
            experiment_id=experiment.id,
            file_path=file_to_read,
            model_name=req.model_name,
            problem_type=req.problem_type,
            target_column=req.target_column,
            feature_columns=req.feature_columns,
            algorithm=req.algorithm,
            hyperparameters=req.hyperparameters,
            train_config=req.train_config,
            date_column=req.date_column,
            forecast_horizon=req.forecast_horizon
        )

        experiment.status = "completed"
        experiment.metrics = results["metrics"]
        experiment.feature_importances = results.get("feature_importances", [])
        experiment.model_artifact_path = results.get("model_artifact_path", "")
        experiment.training_time_seconds = results.get("training_time_seconds", 0.0)
        if "forecast_data" in results:
            experiment.forecast_data = results["forecast_data"]
            experiment.training_data_range = results.get("training_data_range")
            experiment.forecast_horizon = results.get("forecast_horizon") or req.forecast_horizon
            experiment.date_column = results.get("date_column") or req.date_column
        db.commit()
        db.refresh(experiment)
        return experiment.to_dict()

    except Exception as e:
        logger.error(f"Model training failed: {e}")
        experiment.status = "failed"
        experiment.error_message = str(e)
        db.commit()
        db.refresh(experiment)
        raise HTTPException(status_code=400, detail=f"Model training failed: {str(e)}")

# ============================================================================
# 3.1. PROJECT-CENTRIC TREE & DATA WORKSPACE ENDPOINTS
# ============================================================================

from backend.services.project_service import project_service
from backend.schemas.datasets import (
    ProjectCreateRequest, ProjectTransformRequest,
    ProjectQueryRequest, ProjectChatRequest
)

@router.get("/projects/tree")
def get_project_tree_endpoint(db: Session = Depends(get_db), x_user_id: Optional[str] = Header(None)):
    """Returns complete hierarchical tree of projects, database status, visualizations, and models."""
    return project_service.get_project_tree(db, user_id=x_user_id)

@router.post("/projects")
def create_project_endpoint(req: ProjectCreateRequest, db: Session = Depends(get_db), x_user_id: Optional[str] = Header(None)):
    """Creates a new empty project session."""
    session = project_service.create_empty_project(name=req.name, db=db, user_id=x_user_id)
    return session.to_dict()

@router.put("/projects/{id}")
def update_project_endpoint(id: str, req: ProjectCreateRequest, db: Session = Depends(get_db)):
    """Updates / renames a project session."""
    project = db.query(DatasetSession).filter(DatasetSession.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.name = req.name
    db.commit()
    db.refresh(project)
    return project.to_dict()

@router.post("/projects/{id}/transform")
def transform_project_data_endpoint(id: str, req: ProjectTransformRequest, db: Session = Depends(get_db)):
    """Applies a data transformation to the project dataset."""
    try:
        res = project_service.transform_project_data(
            project_id=id,
            transformation_type=req.transformation_type,
            params=req.params,
            db=db
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/projects/{id}/query")
def query_project_data_endpoint(id: str, req: ProjectQueryRequest, db: Session = Depends(get_db)):
    """Executes SQL or DataFrame query on project dataset."""
    try:
        res = project_service.query_project_data(
            project_id=id,
            query_str=req.query,
            db=db,
            limit=req.limit or 100
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/projects/{id}/schema")
def get_project_schema_endpoint(id: str, db: Session = Depends(get_db)):
    """Returns project SQLite tables and column types."""
    try:
        return project_service.get_project_schema(id, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/projects/{id}/chat")
async def project_data_chat_endpoint(id: str, req: ProjectChatRequest, db: Session = Depends(get_db)):
    """Project-specific AI data chat for transformations, formula advice, and analysis."""
    try:
        res = await project_service.project_data_chat(
            project_id=id,
            user_message=req.message,
            db=db,
            model=req.model
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/ml/experiments")
def list_experiments(
    dataset_id: Optional[str] = None,
    chart_id: Optional[str] = None,
    workflow_type: Optional[str] = None,
    db: Session = Depends(get_db),
    x_user_id: Optional[str] = Header(None)
):
    """Lists trained model experiments. Scopes to user datasets unless explicitly queried by dataset_id."""
    q = db.query(MLExperiment)
    if dataset_id:
        q = q.filter(MLExperiment.dataset_id == dataset_id)
    elif x_user_id:
        if x_user_id == "usr_v":
            q = q.join(DatasetSession).filter((DatasetSession.user_id == "usr_v") | (DatasetSession.user_id == None))
        else:
            q = q.join(DatasetSession).filter(DatasetSession.user_id == x_user_id)
    else:
        return []

    if chart_id:
        q = q.filter(MLExperiment.chart_id == chart_id)
    if workflow_type:
        q = q.filter(MLExperiment.workflow_type == workflow_type)
    experiments = q.order_by(MLExperiment.created_at.desc()).all()
    return [e.to_dict() for e in experiments]

@router.get("/ml/experiments/{id}")
def get_experiment(id: str, db: Session = Depends(get_db)):
    """Fetches details for a specific trained model."""
    experiment = db.query(MLExperiment).filter(MLExperiment.id == id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Model experiment not found")
    return experiment.to_dict()

@router.delete("/ml/experiments/{id}")
def delete_experiment(id: str, db: Session = Depends(get_db)):
    """Deletes an ML experiment and artifact."""
    experiment = db.query(MLExperiment).filter(MLExperiment.id == id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")

    if experiment.model_artifact_path and os.path.exists(experiment.model_artifact_path):
        try: os.remove(experiment.model_artifact_path)
        except Exception: pass

    db.delete(experiment)
    db.commit()
    return {"message": "Experiment deleted successfully"}

# ============================================================================
# 3.5. CHART-BASED FORECASTING ML ENDPOINTS
# ============================================================================

@router.post("/ml/chart-forecast/train")
async def train_chart_forecast(req: ChartForecastTrainRequest, db: Session = Depends(get_db)):
    """
    Chart-Based Forecasting Workflow:
    1. Loads the chart (from SavedVisualization or auto-resolves from SavedDashboard cards)
    2. Auto-detects date/time column and target metric
    3. LLM selects the best forecasting approach
    4. Trains the model with sliding-window/lag features
    5. Generates forecast and Actual vs Predicted visualization
    6. Saves model with chart binding
    """
    # 1. Validate chart exists (supports direct visualization ID and dashboard card ID)
    chart = db.query(SavedVisualization).filter(SavedVisualization.id == req.chart_id).first()
    if not chart:
        # Search dashboard cards across all dashboards
        dashboards = db.query(SavedDashboard).all()
        for dash in dashboards:
            for tab in (dash.tabs or []):
                for card in tab.get("layout", []):
                    if card.get("id") == req.chart_id or card.get("visualization_id") == req.chart_id:
                        vis_id = card.get("visualization_id")
                        if vis_id:
                            chart = db.query(SavedVisualization).filter(SavedVisualization.id == vis_id).first()
                        if not chart:
                            # Sync the dashboard cards
                            project_id = dash.project_id or req.dataset_id
                            dashboard_service.sync_dashboard_cards_to_visualizations(db, project_id, dash.tabs, dash.title, dash.id)
                            flag_modified(dash, "tabs")
                            db.commit()
                            vis_id = card.get("visualization_id")
                            if vis_id:
                                chart = db.query(SavedVisualization).filter(SavedVisualization.id == vis_id).first()
                        if chart:
                            break
                if chart:
                    break
            if chart:
                break

    if not chart:
        raise HTTPException(status_code=404, detail="Chart/visualization not found")

    dataset = db.query(DatasetSession).filter(DatasetSession.id == req.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # 2. Load chart data: execute SQL query if chart is query-backed, otherwise read dataset file
    df = None
    chart_cfg = chart.configuration or {}
    chart_sql = chart_cfg.get("sql") or chart_cfg.get("sql_query")
    if not chart_sql and chart.filters:
        for f in chart.filters:
            if isinstance(f, dict) and f.get("sql_query"):
                chart_sql = f["sql_query"]
                break

    if chart_sql:
        try:
            res = project_service.query_project_data(dataset.id, chart_sql, db, limit=5000)
            if res.get("rows"):
                df = pd.DataFrame(res["rows"], columns=res["columns"])
                logger.info(f"Loaded {len(df)} rows for forecasting using chart SQL query: {chart_sql[:80]}...")
        except Exception as q_err:
            logger.warning(f"Failed to query chart SQL for forecasting ({q_err}), falling back to dataset file")

    if df is None or len(df) == 0:
        file_to_read = dataset.processed_file_path or dataset.file_path
        if not file_to_read or not os.path.exists(file_to_read):
            raise HTTPException(status_code=404, detail="Dataset file missing")

        try:
            if file_to_read.endswith(('.xlsx', '.xls')):
                try:
                    df = pd.read_excel(file_to_read, engine='openpyxl')
                except Exception:
                    df = pd.read_excel(file_to_read)
            else:
                df = pd.read_csv(file_to_read, encoding='utf-8', on_bad_lines='skip')
        except Exception as e:
            if dataset.file_path and os.path.exists(dataset.file_path) and dataset.file_path != file_to_read:
                try:
                    if dataset.file_path.endswith(('.xlsx', '.xls')):
                        df = pd.read_excel(dataset.file_path, engine='openpyxl')
                    else:
                        df = pd.read_csv(dataset.file_path, encoding='utf-8', on_bad_lines='skip')
                except Exception as e2:
                    raise HTTPException(status_code=400, detail=f"Failed to read dataset: {str(e2)}")
            else:
                raise HTTPException(status_code=400, detail=f"Failed to read dataset: {str(e)}")

    # 3. Detect time-series columns from chart
    chart_meta = chart.to_dict()
    col_meta = dataset.column_metadata or {}
    detection = forecasting_service.detect_chart_time_series(df, chart_meta, col_meta)

    if not detection["is_suitable"]:
        raise HTTPException(
            status_code=400,
            detail=f"Chart is not suitable for time-series forecasting: {detection['reason']}"
        )

    date_column = detection["date_column"]
    target_column = detection["target_column"]
    forecast_horizon = req.forecast_horizon or 12

    # 4. Compute data summary for LLM
    target_series = pd.to_numeric(
        df[target_column].astype(str).str.replace(r'[\$,₹,]', '', regex=True),
        errors='coerce'
    ).dropna()
    data_summary = {
        "target_mean": round(float(target_series.mean()), 2) if not target_series.empty else 0.0,
        "target_std": round(float(target_series.std()), 2) if not target_series.empty else 0.0,
        "target_min": round(float(target_series.min()), 2) if not target_series.empty else 0.0,
        "target_max": round(float(target_series.max()), 2) if not target_series.empty else 0.0,
        "row_count": len(df),
        "date_range": f"{df[date_column].iloc[0] if len(df) else ''} to {df[date_column].iloc[-1] if len(df) else ''}",
        "chart_type": chart.chart_type,
        "aggregation": chart.aggregation
    }

    # 5. LLM selects forecasting approach
    approach = await forecasting_service.select_forecasting_approach(
        dataset_name=dataset.name,
        date_column=date_column,
        target_column=target_column,
        row_count=len(df),
        data_summary=data_summary,
        model=req.model,
        user_instructions=req.user_instructions
    )

    technique_id = approach.get("technique_id", "gradient_boosting_forecast")
    technique_name = approach.get("technique_name", technique_id)
    hyper = approach.get("hyperparameters", {})

    # 6. Create experiment record linked to both chart and visualization
    model_name = req.model_name or f"{chart.title} - {technique_name} Forecast"
    experiment = MLExperiment(
        dataset_id=req.dataset_id,
        visualization_id=chart.id,
        source_visualization_ids=[chart.id, req.chart_id] if req.chart_id != chart.id else [chart.id],
        workflow_type="chart_forecast",
        chart_id=req.chart_id,
        model_name=model_name,
        problem_type="forecasting",
        target_column=target_column,
        date_column=date_column,
        feature_columns=[],
        algorithm=technique_name,
        hyperparameters=hyper,
        train_config={"technique_id": technique_id, "forecast_horizon": forecast_horizon},
        forecast_horizon=forecast_horizon,
        status="running"
    )
    db.add(experiment)
    db.commit()
    db.refresh(experiment)

    try:
        # 7. Train forecasting model
        results = forecasting_service.train_forecast_model(
            experiment_id=experiment.id,
            df=df,
            date_column=date_column,
            target_column=target_column,
            technique_id=technique_id,
            hyperparameters=hyper,
            forecast_horizon=forecast_horizon
        )

        # 8. Deactivate previous active models for this chart
        db.query(MLExperiment).filter(
            (MLExperiment.chart_id == req.chart_id) | (MLExperiment.visualization_id == chart.id) | (MLExperiment.chart_id == chart.id),
            MLExperiment.is_active_for_chart == True,
            MLExperiment.id != experiment.id
        ).update({"is_active_for_chart": False})

        # 9. Update experiment record
        experiment.status = "completed"
        experiment.metrics = results["metrics"]
        experiment.forecast_data = results["forecast_data"]
        experiment.scaler_info = results["scaler_info"]
        experiment.training_data_range = results["training_data_range"]
        experiment.model_artifact_path = results["model_artifact_path"]
        experiment.training_time_seconds = results["training_time_seconds"]
        experiment.is_active_for_chart = True
        experiment.feature_columns = results.get("feature_columns", [])

        db.commit()
        db.refresh(experiment)

        result_dict = experiment.to_dict()
        result_dict["approach_reasoning"] = approach.get("reasoning", "")
        result_dict["detection"] = detection
        return result_dict

    except Exception as e:
        logger.error(f"Chart forecast training failed: {e}", exc_info=True)
        experiment.status = "failed"
        experiment.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=400, detail=f"Forecast training failed: {str(e)}")


@router.get("/ml/chart-forecast/history/{chart_id}")
def get_chart_forecast_history(chart_id: str, db: Session = Depends(get_db)):
    """
    Returns the model history for a specific chart.
    Supports either chart card ID or visualization ID.
    """
    experiments = db.query(MLExperiment).filter(
        (MLExperiment.chart_id == chart_id) | (MLExperiment.visualization_id == chart_id),
        MLExperiment.workflow_type == "chart_forecast"
    ).order_by(MLExperiment.created_at.desc()).all()

    return {
        "chart_id": chart_id,
        "total_models": len(experiments),
        "models": [e.to_dict() for e in experiments],
        "active_model_id": next(
            (e.id for e in experiments if e.is_active_for_chart),
            None
        )
    }


@router.post("/ml/chart-forecast/activate")
def activate_chart_forecast_model(req: ChartModelActivateRequest, db: Session = Depends(get_db)):
    """
    Activates a specific forecast model for a chart,
    deactivating all other models for that chart.
    """
    experiment = db.query(MLExperiment).filter(
        MLExperiment.id == req.experiment_id,
        (MLExperiment.chart_id == req.chart_id) | (MLExperiment.visualization_id == req.chart_id)
    ).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Forecast model not found for this chart")

    # Deactivate all others for this chart / visualization
    db.query(MLExperiment).filter(
        (MLExperiment.chart_id == req.chart_id) | (MLExperiment.visualization_id == experiment.visualization_id) | (MLExperiment.chart_id == experiment.chart_id),
        MLExperiment.is_active_for_chart == True
    ).update({"is_active_for_chart": False})

    # Activate selected
    experiment.is_active_for_chart = True
    db.commit()
    db.refresh(experiment)

    return {
        "message": f"Model '{experiment.model_name}' activated for chart",
        "experiment": experiment.to_dict()
    }


@router.get("/ml/chart-forecast/active/{chart_id}")
def get_active_chart_forecast(chart_id: str, db: Session = Depends(get_db)):
    """
    Returns the currently active forecast model for a chart, if any.
    """
    experiment = db.query(MLExperiment).filter(
        (MLExperiment.chart_id == chart_id) | (MLExperiment.visualization_id == chart_id),
        MLExperiment.is_active_for_chart == True,
        MLExperiment.workflow_type == "chart_forecast",
        MLExperiment.status == "completed"
    ).first()

    if not experiment:
        return {"active_model": None, "chart_id": chart_id}

    return {
        "active_model": experiment.to_dict(),
        "chart_id": chart_id
    }

# ============================================================================
# 4. TESTING & INFERENCE ENDPOINTS
# ============================================================================

@router.post("/testing/{model_id}/predict")
async def test_model_predict(
    model_id: str,
    file: Optional[UploadFile] = File(None),
    raw_data: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Evaluates test dataset against trained model: applies pipeline, returns predictions,
    and calculates evaluation metrics if ground truth target is present.
    """
    experiment = db.query(MLExperiment).filter(MLExperiment.id == model_id).first()
    if not experiment or not experiment.model_artifact_path or not os.path.exists(experiment.model_artifact_path):
        raise HTTPException(status_code=404, detail="Trained model artifact not found")

    try:
        if file:
            content = await file.read()
            test_df = dataset_service.read_csv_robust(content)
        elif raw_data:
            records = json.loads(raw_data)
            test_df = pd.DataFrame(records)
        else:
            raise HTTPException(status_code=400, detail="No test CSV file or data records provided.")

        results = testing_service.evaluate_and_predict(
            artifact_path=experiment.model_artifact_path,
            test_df=test_df
        )
        return results

    except Exception as e:
        logger.error(f"Testing prediction error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/testing/insights")
async def generate_testing_insights(req: TestingInsightsRequest, db: Session = Depends(get_db)):
    """On-demand AI insights on model evaluation and predictions."""
    experiment = db.query(MLExperiment).filter(MLExperiment.id == req.model_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Model not found")

    insights = await testing_service.generate_prediction_insights(
        model_name=experiment.model_name,
        problem_type=experiment.problem_type,
        target_column=experiment.target_column,
        prediction_summary=req.prediction_summary,
        model=req.model
    )
    return {"insights": insights}

# ============================================================================
# 5. DEPLOYMENTS ENDPOINTS
# ============================================================================

@router.post("/deployments")
def deploy_model(req: DeployModelRequest, db: Session = Depends(get_db)):
    """Deploys a trained model experiment for live inference."""
    experiment = db.query(MLExperiment).filter(MLExperiment.id == req.experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Trained model experiment not found")

    # Check if existing deployment exists
    existing = db.query(DeployedModel).filter(DeployedModel.experiment_id == req.experiment_id).first()
    if existing:
        existing.deployment_name = req.deployment_name
        existing.version = req.version
        existing.description = req.description
        existing.tags = req.tags
        existing.status = "active"
        db.commit()
        db.refresh(existing)
        return existing.to_dict()

    deployment = DeployedModel(
        experiment_id=req.experiment_id,
        deployment_name=req.deployment_name,
        version=req.version,
        description=req.description,
        tags=req.tags,
        status="active"
    )
    db.add(deployment)
    db.commit()
    db.refresh(deployment)
    return deployment.to_dict()

@router.get("/deployments")
def list_deployments(db: Session = Depends(get_db), x_user_id: Optional[str] = Header(None)):
    """Lists all deployed models scoped to the authenticated user."""
    if not x_user_id:
        return []
    q = db.query(DeployedModel).join(MLExperiment).join(DatasetSession)
    if x_user_id == "usr_v":
        q = q.filter((DatasetSession.user_id == "usr_v") | (DatasetSession.user_id == None))
    else:
        q = q.filter(DatasetSession.user_id == x_user_id)
    deps = q.order_by(DeployedModel.created_at.desc()).all()
    return [d.to_dict() for d in deps]

@router.get("/deployments/{id}")
def get_deployment(id: str, db: Session = Depends(get_db)):
    """Fetches details for a deployed model."""
    dep = db.query(DeployedModel).filter(DeployedModel.id == id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return dep.to_dict()

@router.put("/deployments/{id}")
def update_deployment(id: str, req: DeploymentUpdateRequest, db: Session = Depends(get_db)):
    """Updates deployment metadata."""
    dep = db.query(DeployedModel).filter(DeployedModel.id == id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")

    for key, val in req.model_dump(exclude_unset=True).items():
        if hasattr(dep, key) and val is not None:
            setattr(dep, key, val)

    db.commit()
    db.refresh(dep)
    return dep.to_dict()

@router.delete("/deployments/{id}")
def delete_deployment(id: str, db: Session = Depends(get_db)):
    """Deletes a deployed model."""
    dep = db.query(DeployedModel).filter(DeployedModel.id == id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    db.delete(dep)
    db.commit()
    return {"message": f"Deployment '{dep.deployment_name}' deleted"}

@router.get("/deployments/{id}/download")
def download_model_bundle(id: str, db: Session = Depends(get_db)):
    """Downloads the trained model .joblib package."""
    dep = db.query(DeployedModel).filter(DeployedModel.id == id).first()
    if not dep or not dep.experiment or not dep.experiment.model_artifact_path:
        raise HTTPException(status_code=404, detail="Model bundle not found")

    path = dep.experiment.model_artifact_path
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Model file missing on server")

    filename = os.path.basename(path)
    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename=filename
    )

@router.post("/deployments/{id}/predict")
def run_deployed_inference(id: str, req: InferenceRequest, db: Session = Depends(get_db)):
    """
    Runs live inference against deployed model with column validation and mapping.
    """
    dep = db.query(DeployedModel).filter(DeployedModel.id == id).first()
    if not dep or not dep.experiment or not dep.experiment.model_artifact_path:
        raise HTTPException(status_code=404, detail="Deployed model not found")

    try:
        results = deployment_service.run_inference(
            artifact_path=dep.experiment.model_artifact_path,
            records=req.records,
            column_mapping=req.column_mapping
        )

        # Log prediction
        log_rec = PredictionLog(
            deployment_id=dep.id,
            input_sample_count=len(req.records),
            input_data_summary={"columns": list(req.records[0].keys()) if req.records else []},
            prediction_results=results.get("rows", [])[:50],
            prediction_metrics=results.get("evaluation_metrics", {})
        )
        db.add(log_rec)
        db.commit()

        return results

    except Exception as e:
        logger.error(f"Inference error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/deployments/{id}/insights")
async def generate_deployment_insights(id: str, req: InferenceInsightsRequest, db: Session = Depends(get_db)):
    """Generates on-demand AI prediction insights for deployed model."""
    dep = db.query(DeployedModel).filter(DeployedModel.id == id).first()
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")

    insights = await testing_service.generate_prediction_insights(
        model_name=dep.deployment_name,
        problem_type=dep.experiment.problem_type if dep.experiment else "classification",
        target_column=dep.experiment.target_column if dep.experiment else None,
        prediction_summary=req.predictions_summary,
        model=req.model
    )
    return {"insights": insights}

# ============================================================================
# 6. DASHBOARD SUMMARY STATS
# ============================================================================

@router.get("/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db), x_user_id: Optional[str] = Header(None)):
    """Returns platform summary metrics and recent history scoped strictly to authenticated user."""
    if not x_user_id:
        return {
            "stats": {
                "total_datasets": 0,
                "total_visualizations": 0,
                "total_trained_models": 0,
                "total_deployed_models": 0
            },
            "recent_sessions": [],
            "recent_models": [],
            "recent_deployments": []
        }

    ds_q = db.query(DatasetSession)
    if x_user_id == "usr_v":
        ds_q = ds_q.filter((DatasetSession.user_id == "usr_v") | (DatasetSession.user_id == None))
    else:
        ds_q = ds_q.filter(DatasetSession.user_id == x_user_id)

    datasets_count = ds_q.count()
    user_sessions = ds_q.all()
    user_dataset_ids = [s.id for s in user_sessions]

    vis_count = db.query(SavedVisualization).filter(
        SavedVisualization.dataset_id.in_(user_dataset_ids)
    ).count() if user_dataset_ids else 0

    trained_q = db.query(MLExperiment).filter(
        MLExperiment.status == "completed",
        MLExperiment.dataset_id.in_(user_dataset_ids)
    ) if user_dataset_ids else db.query(MLExperiment).filter(False)
    trained_count = trained_q.count()

    deployed_q = db.query(DeployedModel).join(MLExperiment).filter(
        DeployedModel.status == "active",
        MLExperiment.dataset_id.in_(user_dataset_ids)
    ) if user_dataset_ids else db.query(DeployedModel).filter(False)
    deployed_count = deployed_q.count()

    recent_sessions = ds_q.order_by(DatasetSession.created_at.desc()).limit(5).all()
    recent_models = trained_q.order_by(MLExperiment.created_at.desc()).limit(5).all()
    recent_deployments = deployed_q.order_by(DeployedModel.created_at.desc()).limit(5).all()

    return {
        "stats": {
            "total_datasets": datasets_count,
            "total_visualizations": vis_count,
            "total_trained_models": trained_count,
            "total_deployed_models": deployed_count
        },
        "recent_sessions": [s.to_dict() for s in recent_sessions],
        "recent_models": [m.to_dict() for m in recent_models],
        "recent_deployments": [d.to_dict() for d in recent_deployments]
    }

# ============================================================================
# 7. DASHBOARD BUILDER ENDPOINTS
# ============================================================================

@router.post("/dashboards")
def create_dashboard(req: DashboardCreateRequest, db: Session = Depends(get_db), x_user_id: Optional[str] = Header(None)):
    """Creates a new dashboard with unique ID and default tab layout."""
    created = dashboard_service.create_dashboard(
        db=db,
        project_id=req.project_id,
        title=req.title,
        description=req.description,
        tabs=req.tabs,
        settings=req.settings,
        user_id=x_user_id
    )
    return created

@router.get("/dashboards")
def list_dashboards(project_id: Optional[str] = None, db: Session = Depends(get_db), x_user_id: Optional[str] = Header(None)):
    """Lists dashboards, optionally filtered by project_id and user_id."""
    return dashboard_service.list_dashboards(db=db, project_id=project_id, user_id=x_user_id)


@router.post("/dashboards/generate-ai")
async def generate_ai_dashboard(req: AIDashboardGenerateRequest, db: Session = Depends(get_db)):
    """
    Extracts the active project's dataset schema and calls the LLM to design a complete
    multi-tab dashboard. Validates the LLM JSON and materializes tabs, cards, and layout.
    Returns the saved dashboard dict ready for the builder page.
    """
    try:
        result = await dashboard_service.generate_ai_dashboard(
            db=db,
            project_id=req.project_id,
            dashboard_title=req.dashboard_title,
            model=req.model
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("AI dashboard generation error")
        raise HTTPException(status_code=500, detail=f"AI dashboard generation failed: {str(e)}")


@router.post("/dashboards/modify-card-ai")
async def modify_card_ai(req: AskAICardRequest, db: Session = Depends(get_db)):
    """
    Modifies a single dashboard card/chart based on natural-language user request.
    Uses the active dataset schema and LLM to regenerate query, dimensions, and configuration
    while preserving position, size, and layout unless explicitly requested.
    Returns the updated card, query execution results, and an explanation.
    """
    try:
        result = await dashboard_service.modify_card_with_ai(
            db=db,
            card_id=req.card_id,
            user_prompt=req.user_prompt,
            current_card=req.current_card,
            project_id=req.project_id,
            dashboard_id=req.dashboard_id,
            conversation_history=req.conversation_history,
            model=req.model
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Modify card with AI error")
        raise HTTPException(status_code=500, detail=f"Failed to modify card with AI: {str(e)}")


@router.post("/dashboards/forecast")
def generate_dashboard_forecast(req: DashboardForecastRequest, db: Session = Depends(get_db)):
    """
    Computes ML model forecasting predictions for a chart.
    Returns actual points + orange prediction overlay series.
    """
    try:
        return dashboard_service.generate_ml_forecast(
            db=db,
            model_id=req.model_id,
            dataset_id=req.dataset_id,
            x_variable=req.x_variable,
            y_variable=req.y_variable,
            horizon=req.horizon or 3,
            historical_data=req.historical_data
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Forecast generation error")
        raise HTTPException(status_code=500, detail=f"Failed to generate forecast: {str(e)}")


@router.get("/dashboards/{dashboard_id}")
def get_dashboard(dashboard_id: str, db: Session = Depends(get_db)):
    """Retrieves a specific dashboard by its unique ID."""
    d = dashboard_service.get_dashboard(db=db, dashboard_id=dashboard_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return d


@router.put("/dashboards/{dashboard_id}")
def update_dashboard(dashboard_id: str, req: DashboardUpdateRequest, db: Session = Depends(get_db)):
    """Updates dashboard title, description, tabs/sections, cards and settings."""
    updated = dashboard_service.update_dashboard(
        db=db,
        dashboard_id=dashboard_id,
        project_id=req.project_id,
        title=req.title,
        description=req.description,
        tabs=req.tabs,
        settings=req.settings
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return updated


@router.delete("/dashboards/{dashboard_id}")
def delete_dashboard(dashboard_id: str, db: Session = Depends(get_db)):
    """Deletes a dashboard by ID."""
    deleted = dashboard_service.delete_dashboard(db=db, dashboard_id=dashboard_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return {"message": "Dashboard deleted successfully"}


@router.post("/dashboards/{dashboard_id}/add-visualization")
def add_visualization_to_dashboard(
    dashboard_id: str,
    req: AddVisualizationToDashboardRequest,
    db: Session = Depends(get_db)
):
    """Adds a visualization to a specific dashboard and tab."""
    res = dashboard_service.add_visualization_to_dashboard(
        db=db,
        dashboard_id=dashboard_id,
        vis_id=req.visualization_id,
        tab_id=req.tab_id,
        vis_config=req.visualization_config,
        col_span=req.col_span or 6,
        height=req.height or 360
    )
    if not res:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return res


