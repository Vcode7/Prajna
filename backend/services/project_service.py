import os
import io
import re
import json
import uuid
import sqlite3
import logging
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.models.models import DatasetSession, SavedVisualization, MLExperiment, DeployedModel
from backend.services.dataset_service import dataset_service
from backend.llm.client import groq_client
from backend.config import settings

logger = logging.getLogger(__name__)

PROJECTS_DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "projects")
os.makedirs(PROJECTS_DB_DIR, exist_ok=True)

class ProjectService:
    def __init__(self):
        self.llm_client = groq_client

    def get_project_tree(self, db: Session) -> List[Dict[str, Any]]:
        """
        Returns full hierarchical project tree for sidebar navigation.
        Project -> Database info, Visualizations list, ML Models list (with deployment status).
        """
        projects = db.query(DatasetSession).order_by(DatasetSession.created_at.desc()).all()
        tree = []

        for p in projects:
            # Visualizations under this project
            vis_list = [
                {
                    "id": v.id,
                    "title": v.title,
                    "chart_type": v.chart_type,
                    "category": v.category,
                    "x_variable": v.x_variable,
                    "y_variable": v.y_variable
                }
                for v in p.visualizations
            ]

            # Models under this project
            models_list = [
                {
                    "id": m.id,
                    "model_name": m.model_name,
                    "algorithm": m.algorithm,
                    "problem_type": m.problem_type,
                    "target_column": m.target_column,
                    "accuracy": m.metrics.get("accuracy") if m.metrics else None,
                    "r2_score": m.metrics.get("r2_score") if m.metrics else None,
                    "status": m.status,
                    "is_deployed": m.deployment is not None,
                    "deployment_id": m.deployment.id if m.deployment else None
                }
                for m in p.experiments
            ]

            tree.append({
                "id": p.id,
                "name": p.name,
                "original_filename": p.original_filename,
                "file_path": p.file_path,
                "processed_file_path": p.processed_file_path,
                "has_data": bool(p.processed_file_path and os.path.exists(p.processed_file_path)),
                "row_count": p.row_count,
                "column_count": p.column_count,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "database_info": {
                    "row_count": p.row_count,
                    "column_count": p.column_count,
                    "data_quality": p.data_quality or {},
                    "column_metadata": p.column_metadata or {},
                    "transformations_count": len(p.data_transformations or [])
                },
                "visualizations": vis_list,
                "models": models_list
            })

        return tree

    def create_empty_project(self, name: str, db: Session) -> DatasetSession:
        """Creates a new empty project session without dataset."""
        session = DatasetSession(
            name=name,
            original_filename="",
            file_path="",
            processed_file_path="",
            row_count=0,
            column_count=0,
            column_metadata={},
            data_quality={},
            derived_features=[],
            data_transformations=[],
            saved_queries=[]
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    def transform_project_data(
        self,
        project_id: str,
        transformation_type: str,
        params: Dict[str, Any],
        db: Session
    ) -> Dict[str, Any]:
        """
        Executes a data transformation on the project dataset and updates the file and column metadata.
        Supported transformation types:
        - 'add_column': {'new_column': 'total_amount', 'formula': 'price * quantity'}
        - 'rename_column': {'old_name': 'colA', 'new_name': 'colB'} or {'columns_map': {'colA': 'colB'}}
        - 'drop_column': {'columns': ['colA', 'colB']}
        - 'fill_missing': {'column': 'age', 'strategy': 'mean' | 'median' | 'mode' | 'constant' | 'drop_na', 'value': 0}
        - 'drop_na_rows': {'columns': ['Product_ID']} (or None for all columns)
        - 'drop_duplicates': {'columns': ['id']} (or None for all columns)
        - 'filter_rows': {'query': 'age > 18 and sales > 0'}
        - 'cast_type': {'column': 'id', 'target_type': 'integer' | 'float' | 'datetime' | 'string' | 'categorical' | 'boolean'}
        - 'replace_values': {'column': 'status', 'to_replace': 'unknown', 'value': 'active'}
        - 'reset_raw': Reverts to original uploaded CSV
        """
        project = db.query(DatasetSession).filter(DatasetSession.id == project_id).first()
        if not project:
            raise ValueError("Project not found")

        if not project.processed_file_path or not os.path.exists(project.processed_file_path):
            raise ValueError("Project has no active dataset to transform")

        # Load current processed dataframe
        df = dataset_service.read_csv_robust(project.processed_file_path)
        action_summary = ""

        if transformation_type in ["add_column", "calculated_column"]:
            new_col = (params.get("new_column") or params.get("column_name") or params.get("name") or "").strip().strip("`'\"")
            formula = (params.get("formula") or params.get("expression") or "").strip()
            if not new_col or not formula:
                raise ValueError("New column name and formula are required")

            clean_formula = formula.strip("`")
            try:
                # Safe eval with pandas DataFrame context
                df[new_col] = df.eval(clean_formula)
                action_summary = f"Added column '{new_col}' computed as ({formula})"
            except Exception:
                # Fallback: try python expression with df variables
                try:
                    sanitized_formula = re.sub(r'`([^`]+)`', r'\1', formula)
                    local_dict = {col: df[col] for col in df.columns}
                    local_dict['np'] = np
                    local_dict['pd'] = pd
                    df[new_col] = eval(sanitized_formula, {"__builtins__": {}}, local_dict)
                    action_summary = f"Added column '{new_col}' computed as ({formula})"
                except Exception as inner_e:
                    raise ValueError(f"Failed to evaluate formula '{formula}': {str(inner_e)}")

        elif transformation_type == "rename_column":
            columns_map = params.get("columns_map")
            if isinstance(columns_map, dict):
                valid_renames = {k: v for k, v in columns_map.items() if k in df.columns and v}
                if not valid_renames:
                    raise ValueError("No matching columns to rename")
                df = df.rename(columns=valid_renames)
                action_summary = f"Renamed columns: {', '.join([f'{k} -> {v}' for k, v in valid_renames.items()])}"
            else:
                old_name = params.get("old_name") or params.get("column")
                new_name = (params.get("new_name") or params.get("new_column") or "").strip()
                if not old_name or not new_name or old_name not in df.columns:
                    raise ValueError(f"Column '{old_name}' not found")
                df = df.rename(columns={old_name: new_name})
                action_summary = f"Renamed column '{old_name}' to '{new_name}'"

        elif transformation_type == "drop_column":
            cols_to_drop = params.get("columns", [])
            if not cols_to_drop and params.get("column"):
                cols_to_drop = [params.get("column")]
            if isinstance(cols_to_drop, str):
                cols_to_drop = [cols_to_drop]
            valid_cols = [c for c in cols_to_drop if c in df.columns]
            if not valid_cols:
                raise ValueError("No matching columns to drop")
            df = df.drop(columns=valid_cols)
            action_summary = f"Dropped column(s): {', '.join(valid_cols)}"

        elif transformation_type == "fill_missing":
            col = params.get("column")
            strategy = params.get("strategy", "mean").lower()
            if not col or col not in df.columns:
                raise ValueError(f"Column '{col}' not found in dataset")

            if strategy == "mean" and pd.api.types.is_numeric_dtype(df[col]):
                fill_val = df[col].mean()
                df[col] = df[col].fillna(fill_val)
                action_summary = f"Filled missing values in '{col}' with Mean ({round(fill_val, 2)})"
            elif strategy == "median" and pd.api.types.is_numeric_dtype(df[col]):
                fill_val = df[col].median()
                df[col] = df[col].fillna(fill_val)
                action_summary = f"Filled missing values in '{col}' with Median ({round(fill_val, 2)})"
            elif strategy == "mode":
                fill_val = df[col].mode().iloc[0] if not df[col].mode().empty else "Unknown"
                df[col] = df[col].fillna(fill_val)
                action_summary = f"Filled missing values in '{col}' with Mode ('{fill_val}')"
            elif strategy == "constant":
                fill_val = params.get("value", "")
                df[col] = df[col].fillna(fill_val)
                action_summary = f"Filled missing values in '{col}' with '{fill_val}'"
            elif strategy == "drop_na":
                old_len = len(df)
                df = df.dropna(subset=[col])
                action_summary = f"Removed {old_len - len(df)} row(s) with missing values in '{col}'"
            else:
                # Default numeric to median or string to mode
                if pd.api.types.is_numeric_dtype(df[col]):
                    fill_val = df[col].median()
                    df[col] = df[col].fillna(fill_val)
                    action_summary = f"Filled missing values in '{col}' with Median ({round(fill_val, 2)})"
                else:
                    fill_val = df[col].mode().iloc[0] if not df[col].mode().empty else "Missing"
                    df[col] = df[col].fillna(fill_val)
                    action_summary = f"Filled missing values in '{col}' with Mode ('{fill_val}')"

        elif transformation_type in ["drop_na_rows", "remove_missing_rows", "remove_rows_missing"]:
            cols = params.get("columns") or params.get("column")
            if isinstance(cols, str):
                cols = [cols] if cols.lower() not in ["all", "any", "none"] else None
            initial_count = len(df)
            if cols:
                valid_cols = [c for c in cols if c in df.columns]
                if not valid_cols:
                    raise ValueError(f"Specified column(s) not found in dataset: {cols}")
                df = df.dropna(subset=valid_cols)
                dropped = initial_count - len(df)
                action_summary = f"Removed {dropped} row(s) where {', '.join(valid_cols)} was missing"
            else:
                df = df.dropna()
                dropped = initial_count - len(df)
                action_summary = f"Removed {dropped} row(s) with missing values across all columns"

        elif transformation_type in ["drop_duplicates", "remove_duplicates"]:
            cols = params.get("columns") or params.get("column")
            if isinstance(cols, str):
                cols = [cols]
            valid_cols = [c for c in cols if c in df.columns] if cols else None
            initial_count = len(df)
            df = df.drop_duplicates(subset=valid_cols)
            dropped = initial_count - len(df)
            col_desc = f" based on {', '.join(valid_cols)}" if valid_cols else ""
            action_summary = f"Removed {dropped} duplicate row(s){col_desc}"

        elif transformation_type in ["cast_type", "type_conversion", "convert_type"]:
            col = params.get("column")
            target_type = str(params.get("target_type", "")).strip().lower()
            if not col or col not in df.columns:
                raise ValueError(f"Column '{col}' not found in dataset")

            if target_type in ["int", "integer", "int64"]:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).astype(int)
                action_summary = f"Converted column '{col}' to Integer"
            elif target_type in ["float", "float64", "numeric", "decimal"]:
                df[col] = pd.to_numeric(df[col], errors="coerce")
                action_summary = f"Converted column '{col}' to Numeric/Float"
            elif target_type in ["datetime", "date", "timestamp"]:
                df[col] = pd.to_datetime(df[col], errors="coerce")
                action_summary = f"Converted column '{col}' to Datetime"
            elif target_type in ["str", "string", "text"]:
                df[col] = df[col].astype(str)
                action_summary = f"Converted column '{col}' to Text/String"
            elif target_type in ["category", "categorical"]:
                df[col] = df[col].astype("category")
                action_summary = f"Converted column '{col}' to Categorical"
            elif target_type in ["bool", "boolean"]:
                df[col] = df[col].astype(bool)
                action_summary = f"Converted column '{col}' to Boolean"
            else:
                raise ValueError(f"Unsupported target type '{target_type}'. Supported: integer, float, datetime, string, categorical, boolean")

        elif transformation_type in ["replace_values", "replace_value"]:
            col = params.get("column")
            if not col or col not in df.columns:
                raise ValueError(f"Column '{col}' not found in dataset")
            to_replace = params.get("to_replace")
            value = params.get("value", "")
            df[col] = df[col].replace(to_replace, value)
            action_summary = f"Replaced '{to_replace}' with '{value}' in column '{col}'"

        elif transformation_type in ["filter_rows", "remove_rows"]:
            query_expr = (params.get("query") or params.get("condition") or "").strip()
            if not query_expr:
                raise ValueError("Query expression is required")
            try:
                initial_count = len(df)
                df = df.query(query_expr)
                action_summary = f"Filtered dataset to {len(df)} rows matching ({query_expr})"
            except Exception as e:
                raise ValueError(f"Filter expression error: {str(e)}")

        elif transformation_type == "reset_raw":
            if project.file_path and os.path.exists(project.file_path):
                df = dataset_service.read_csv_robust(project.file_path)
                action_summary = "Reverted dataset to original uploaded raw state"
            else:
                raise ValueError("Original raw CSV not found")

        else:
            raise ValueError(f"Unknown transformation type '{transformation_type}'")

        # Save updated processed CSV and sync persistent SQLite database
        df.to_csv(project.processed_file_path, index=False)
        try:
            self.refresh_project_sqlite_db(project)
        except Exception as sync_err:
            logger.warning(f"Could not refresh persistent SQLite DB after transformation: {sync_err}")

        # Re-profile dataset
        col_meta, data_quality = dataset_service.profile_dataset(df)

        # Record transformation in history
        history = list(project.data_transformations or [])
        history.append({
            "type": transformation_type,
            "params": params,
            "summary": action_summary,
            "timestamp": pd.Timestamp.utcnow().isoformat()
        })

        project.row_count = len(df)
        project.column_count = len(df.columns)
        project.column_metadata = col_meta
        project.data_quality = data_quality
        project.data_transformations = history
        db.commit()
        db.refresh(project)

        return {
            "status": "success",
            "message": action_summary,
            "project": project.to_dict(),
            "preview": {
                "columns": list(df.columns),
                "rows": json.loads(df.head(100).to_json(orient="records", date_format="iso")),
                "total_rows": len(df),
                "total_columns": len(df.columns)
            }
        }

    def get_project_db_path(self, project_id: str) -> str:
        """Returns the filesystem path for the persistent project SQLite database."""
        safe_id = re.sub(r'[^a-zA-Z0-9_-]', '_', project_id)
        return os.path.join(PROJECTS_DB_DIR, f"{safe_id}.db")

    def get_or_create_project_sqlite_db(
        self,
        project: DatasetSession,
        force_refresh: bool = False
    ) -> str:
        """
        Returns the path to the persistent SQLite database for the project session.
        If the database doesn't exist or is older than the source files, it builds
        all tables once. Subsequent queries directly query this persistent DB in <5ms.
        """
        db_path = self.get_project_db_path(project.id)

        # Check if DB is already fresh
        if not force_refresh and os.path.exists(db_path):
            try:
                db_mtime = os.path.getmtime(db_path)
                source_paths = [project.processed_file_path, project.file_path]
                source_mtimes = [
                    os.path.getmtime(p) for p in source_paths if p and os.path.exists(p)
                ]
                if source_mtimes and db_mtime >= max(source_mtimes):
                    return db_path
            except Exception as e:
                logger.warning(f"Error checking project DB timestamps ({e}), rebuilding.")

        # Build / Rebuild persistent SQLite database
        logger.info(f"Building persistent SQLite database for project '{project.id}' at {db_path}...")
        temp_db_path = f"{db_path}.tmp_{uuid.uuid4().hex[:6]}"
        try:
            conn = sqlite3.connect(temp_db_path)
            conn.execute("PRAGMA journal_mode = WAL;")
            conn.execute("PRAGMA synchronous = NORMAL;")

            # 1. Load active processed sheet as 'dataset', 'data', 'df'
            if project.processed_file_path and os.path.exists(project.processed_file_path):
                df = dataset_service.read_csv_robust(project.processed_file_path)
                df.to_sql("dataset", conn, index=False, if_exists="replace")
                df.to_sql("data", conn, index=False, if_exists="replace")
                df.to_sql("df", conn, index=False, if_exists="replace")

            # 2. If multi-sheet Excel file, load each sheet as a distinct table
            if project.file_path and os.path.exists(project.file_path) and dataset_service.is_excel_file(project.file_path):
                try:
                    sheet_names = dataset_service.get_sheet_names(project.file_path)
                    for s in sheet_names:
                        table_name = re.sub(r'[^a-zA-Z0-9_]', '_', s).strip('_').lower()
                        if table_name:
                            sdf = dataset_service.read_excel_sheet(project.file_path, sheet_name=s)
                            sdf.to_sql(table_name, conn, index=False, if_exists="replace")
                except Exception as e:
                    logger.warning(f"Could not load multi-sheet tables into persistent SQLite: {e}")

            conn.commit()
            conn.close()

            # Atomically replace temp_db_path -> db_path
            if os.path.exists(db_path):
                try:
                    os.remove(db_path)
                except Exception:
                    pass
            os.replace(temp_db_path, db_path)
            logger.info(f"Successfully created persistent SQLite database: {db_path}")
            return db_path

        except Exception as e:
            if os.path.exists(temp_db_path):
                try:
                    os.remove(temp_db_path)
                except Exception:
                    pass
            raise RuntimeError(f"Failed to build persistent SQLite DB for project {project.id}: {e}")

    def refresh_project_sqlite_db(self, project: DatasetSession) -> str:
        """Forces recreation of the project's persistent SQLite database."""
        return self.get_or_create_project_sqlite_db(project, force_refresh=True)

    def delete_project_sqlite_db(self, project_id: str):
        """Removes the persistent SQLite database files for the project session."""
        db_path = self.get_project_db_path(project_id)
        for ext in ["", "-wal", "-shm"]:
            target = f"{db_path}{ext}"
            if os.path.exists(target):
                try:
                    os.remove(target)
                except Exception as e:
                    logger.warning(f"Could not delete project DB file {target}: {e}")

    def query_project_data(
        self,
        project_id: str,
        query_str: str,
        db: Session,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        Executes a SQL query on the project dataset using a persistent SQLite database.
        Table name can be 'dataset' or 'data' or 'df' or individual sheet names.
        """
        project = db.query(DatasetSession).filter(DatasetSession.id == project_id).first()
        if not project or not project.processed_file_path:
            raise ValueError("Project dataset not found")

        # Connect to persistent project SQLite database (built once, cached for all queries)
        db_path = self.get_or_create_project_sqlite_db(project)
        conn = sqlite3.connect(db_path, check_same_thread=False)

        try:
            # If query doesn't have LIMIT, strip trailing semicolon and add one
            clean_query = query_str.strip().rstrip(';').strip()
            if not re.search(r'\blimit\b', clean_query, re.IGNORECASE):
                clean_query = f"{clean_query} LIMIT {limit}"

            try:
                result_df = pd.read_sql_query(clean_query, conn)
            except Exception as first_err:
                err_msg = str(first_err)
                col_match = re.search(r'no such column:\s*([a-zA-Z0-9_]+)', err_msg, re.IGNORECASE)
                rewritten = False
                if col_match:
                    missing_col = col_match.group(1).lower()
                    cursor = conn.cursor()
                    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('dataset', 'data', 'df')")
                    other_tables = [r[0] for r in cursor.fetchall()]
                    for t in other_tables:
                        cols = [row[1].lower() for row in cursor.execute(f"PRAGMA table_info({t})").fetchall()]
                        if missing_col in cols:
                            new_query = re.sub(r'\b(FROM|JOIN)\s+(dataset|data|df)\b', f'\\1 {t}', clean_query, flags=re.IGNORECASE)
                            try:
                                result_df = pd.read_sql_query(new_query, conn)
                                clean_query = new_query
                                rewritten = True
                                logger.info(f"Auto-resolved table for query from 'dataset' to '{t}' for missing column '{missing_col}'")
                                break
                            except Exception:
                                continue
                if not rewritten:
                    raise first_err
            
            # Store in saved queries if not already present
            saved = list(project.saved_queries or [])
            if clean_query not in saved:
                saved.append(clean_query)
                project.saved_queries = saved[-20:] # keep last 20
                db.commit()

            return {
                "columns": list(result_df.columns),
                "rows": json.loads(result_df.to_json(orient="records", date_format="iso")),
                "row_count": len(result_df)
            }
        except Exception as e:
            raise ValueError(f"SQL execution error: {str(e)}")
        finally:
            conn.close()

    async def project_data_chat(
        self,
        project_id: str,
        user_message: str,
        db: Session,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        LLM-powered Data Transformation Assistant.
        Analyzes the user's natural language request alongside the dataset schema and column profiles.
        Returns a structured action plan with natural-language explanation and execution parameters.
        Does NOT show raw SQL or code to the user.
        """
        project = db.query(DatasetSession).filter(DatasetSession.id == project_id).first()
        if not project:
            raise ValueError("Project not found")

        if not project.processed_file_path or not os.path.exists(project.processed_file_path):
            return {
                "reply": f"Project '{project.name}' has no active dataset uploaded yet. Please upload a CSV first.",
                "explanation": "No dataset uploaded yet. Please upload a CSV first to start transformations.",
                "is_executable": False,
                "operation": None,
                "clarification_needed": False
            }

        # Extract detailed schema, types, null counts, and sample values
        df = dataset_service.read_csv_robust(project.processed_file_path)
        columns_info = []
        for col in df.columns:
            series = df[col]
            null_cnt = int(series.isnull().sum())
            non_null_samples = series.dropna().head(3).tolist()
            formatted_samples = [str(x) for x in non_null_samples]
            columns_info.append({
                "column": col,
                "dtype": str(series.dtype),
                "null_count": null_cnt,
                "sample_values": formatted_samples
            })

        system_prompt = f"""You are the PRAJNA AI Data & Transformation Engine for project '{project.name}'.
You are directly connected to an interactive data transformation system that allows users to clean, enrich, filter, and transform datasets.

CURRENT DATASET INFORMATION:
- Total Rows: {len(df)}
- Total Columns: {len(df.columns)}
- Columns & Schema Details:
{json.dumps(columns_info, indent=2)}

YOUR ROLE:
1. Understand the user's request in the context of the dataset schema, column names, data types, and null counts above.
2. Determine if the request maps to a valid dataset transformation or data cleaning operation.
3. If valid, formulate the transformation operation and provide a CLEAR, NATURAL-LANGUAGE EXPLANATION of what you are going to do.

SUPPORTED OPERATIONS & PARAMETERS:
- "fill_missing": Fill null/missing values in a column.
  params: {{"column": "ColumnName", "strategy": "mean" | "median" | "mode" | "constant", "value": optional_value}}
- "drop_na_rows": Remove rows with null/missing values.
  params: {{"columns": ["ColumnName"]}} (or {{"columns": null}} for all columns)
- "add_column": Create a calculated or engineered column.
  params: {{"new_column": "NewColumnName", "formula": "Expression using existing column names, e.g. (Revenue - COGS) / Revenue or Units * Price"}}
- "filter_rows": Filter rows matching a condition.
  params: {{"query": "Condition expression, e.g. Revenue > 1000 and Status == 'Active'"}}
- "cast_type": Convert column data type.
  params: {{"column": "ColumnName", "target_type": "integer" | "float" | "datetime" | "string" | "categorical" | "boolean"}}
- "rename_column": Rename an existing column.
  params: {{"old_name": "OldCol", "new_name": "NewCol"}}
- "drop_column": Drop one or more columns from dataset.
  params: {{"columns": ["Col1", "Col2"]}}
- "drop_duplicates": Remove duplicate rows.
  params: {{"columns": ["Col1"]}} (or null for all columns)
- "replace_values": Replace specific values in a column.
  params: {{"column": "ColumnName", "to_replace": "old_val", "value": "new_val"}}

CRITICAL RULES:
1. STRICTLY DO NOT SHOW THE GENERATED SQL OR RAW PYTHON CODE TO THE USER in your explanation. The user must only see a polished, executive natural-language explanation.
   - Example 1: "Fill all missing values in the `Revenue` column using the column median."
   - Example 2: "Remove rows where `Product_ID` is missing."
   - Example 3: "Create a calculated `Profit_Margin` column using Revenue and COGS."
   - Example 4: "Convert the `Order_Date` column to Datetime format."
   - Example 5: "Filter dataset to keep only rows where `Revenue` is greater than 1,000."
2. IF THE REQUEST IS AMBIGUOUS OR CANNOT BE SAFELY MAPPED:
   - Do NOT guess or silently perform an operation.
   - Set "is_executable": false
   - Set "clarification_needed": true
   - In "explanation", politely explain what is ambiguous and ask for clarification, listing available matching columns and possible choices based on the schema.
3. IF THE USER ASKS AN INFORMATIONAL QUESTION (e.g. "What columns have nulls?", "How many rows are there?"):
   - Set "is_executable": false
   - Set "clarification_needed": false
   - In "explanation", answer the question concisely and accurately based on the dataset details.
4. IF THE REQUEST IS A VALID OPERATION:
   - Set "is_executable": true
   - Set "clarification_needed": false
   - Set "transformation_type" to one of the supported operation names.
   - Set "params" with the exact parameters needed.

Output ONLY a JSON object with this exact structure:
{{
  "is_executable": true | false,
  "explanation": "Clear natural language explanation of what the AI is going to do, or clarification question",
  "transformation_type": "fill_missing" | "drop_na_rows" | "add_column" | "filter_rows" | "cast_type" | "rename_column" | "drop_column" | "drop_duplicates" | "replace_values" | null,
  "params": {{ ... }} | null,
  "clarification_needed": true | false
}}"""

        try:
            response_text = await self.llm_client.get_chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                model=model or settings.default_model,
                temperature=0.1,
                max_tokens=1000,
                json_mode=True,
                task_name="Project Data Assistant Transformation Plan"
            )

            # Robust JSON extraction
            parsed = {}
            try:
                parsed = json.loads(response_text)
            except Exception:
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    parsed = json.loads(json_match.group(0))
                else:
                    parsed = {
                        "is_executable": False,
                        "explanation": response_text,
                        "clarification_needed": False
                    }

            is_exec = bool(parsed.get("is_executable", False))
            trans_type = parsed.get("transformation_type")
            params = parsed.get("params") or {}
            explanation = parsed.get("explanation", "").strip() or "Transformation ready for review."
            clarification = bool(parsed.get("clarification_needed", False))

            return {
                "reply": explanation,
                "explanation": explanation,
                "is_executable": is_exec and bool(trans_type),
                "operation": {
                    "transformation_type": trans_type,
                    "params": params
                } if (is_exec and trans_type) else None,
                "clarification_needed": clarification
            }

        except Exception as e:
            logger.error(f"LLM project chat failed: {e}", exc_info=True)
            return {
                "reply": f"Could not determine transformation plan: {str(e)}",
                "explanation": f"I encountered an issue analyzing this request. Please clarify what transformation or column you would like to work with.",
                "is_executable": False,
                "operation": None,
                "clarification_needed": True
            }

project_service = ProjectService()
