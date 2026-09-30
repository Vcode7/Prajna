import asyncio
import json
import logging
import os
import re
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.models.models import DatasetSession, SavedVisualization
from backend.services.dataset_service import dataset_service
from backend.llm.client import groq_client
from backend.config import settings

logger = logging.getLogger(__name__)

class VisualizationService:
    def generate_recommendations(self, dataset_id: str, col_meta: Dict[str, Any], df: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Generates 3-4 realistic, data-grounded visualization recommendations across
        Single Variable, Bi-Variable, and Multi-Variable categories.
        """
        recs = []

        # Filter out non-column metadata entries (e.g. _sheets, _active_sheet)
        col_meta = {c: m for c, m in (col_meta or {}).items() if isinstance(m, dict) and not str(c).startswith("_")}

        num_cols = [c for c, m in col_meta.items() if m.get("data_type") == "numerical"]
        cat_cols = [c for c, m in col_meta.items() if m.get("data_type") in ("categorical", "boolean")]
        date_cols = [c for c, m in col_meta.items() if m.get("data_type") == "datetime"]

        # ----------------------------------------------------
        # TAB 1: SINGLE VARIABLE (3-4 Examples)
        # ----------------------------------------------------
        # 1.1 Categorical Frequency Bar
        if cat_cols:
            primary_cat = sorted(cat_cols, key=lambda c: col_meta[c].get("unique_count", 999))[0]
            recs.append({
                "dataset_id": dataset_id,
                "category": "single_variable",
                "chart_type": "Bar",
                "x_variable": primary_cat,
                "y_variable": "count",
                "aggregation": "count",
                "title": f"Distribution of {primary_cat.replace('_', ' ').title()}",
                "description": f"Frequency distribution across distinct {primary_cat} categories."
            })

        # 1.2 Numerical Distribution / Histogram
        if num_cols:
            primary_num = num_cols[0]
            recs.append({
                "dataset_id": dataset_id,
                "category": "single_variable",
                "chart_type": "Bar",
                "x_variable": primary_num,
                "y_variable": primary_num,
                "aggregation": "avg",
                "title": f"Summary Metric: {primary_num.replace('_', ' ').title()}",
                "description": f"Overview metric profile and central tendency for {primary_num}."
            })

        # 1.3 Pie / Donut Chart for Low-Cardinality Category
        pie_candidates = [c for c in cat_cols if 2 <= col_meta[c].get("unique_count", 99) <= 7]
        if pie_candidates:
            pie_col = pie_candidates[0]
            recs.append({
                "dataset_id": dataset_id,
                "category": "single_variable",
                "chart_type": "Donut",
                "x_variable": pie_col,
                "y_variable": "count",
                "aggregation": "count",
                "title": f"{pie_col.replace('_', ' ').title()} Share Composition",
                "description": f"Percentage breakdown of records by {pie_col}."
            })

        # 1.4 Single Metric KPI Card
        if num_cols:
            kpi_col = num_cols[-1]
            recs.append({
                "dataset_id": dataset_id,
                "category": "single_variable",
                "chart_type": "Metric",
                "x_variable": kpi_col,
                "y_variable": kpi_col,
                "aggregation": "sum",
                "title": f"Total {kpi_col.replace('_', ' ').title()}",
                "description": f"Overall aggregated aggregate sum for {kpi_col}."
            })

        # ----------------------------------------------------
        # TAB 2: BI-VARIABLE (3-4 Examples)
        # ----------------------------------------------------
        # 2.1 Categorical vs Numerical Bar (e.g. Sales by Category)
        if cat_cols and num_cols:
            cat = cat_cols[0]
            num = num_cols[0]
            recs.append({
                "dataset_id": dataset_id,
                "category": "bi_variable",
                "chart_type": "Bar",
                "x_variable": cat,
                "y_variable": num,
                "aggregation": "sum",
                "title": f"Total {num.replace('_', ' ').title()} by {cat.replace('_', ' ').title()}",
                "description": f"Comparative breakdown of {num} across different {cat} groups."
            })

        # 2.2 Date vs Numerical Line (Trend)
        if date_cols and num_cols:
            d_col = date_cols[0]
            num = num_cols[0]
            recs.append({
                "dataset_id": dataset_id,
                "category": "bi_variable",
                "chart_type": "Line",
                "x_variable": d_col,
                "y_variable": num,
                "aggregation": "avg",
                "title": f"{num.replace('_', ' ').title()} Trend Over Time",
                "description": f"Temporal progression and trajectory of {num} over {d_col}."
            })
        elif len(cat_cols) >= 2 and num_cols:
            # Fallback horizontal bar
            cat2 = cat_cols[1]
            num = num_cols[0]
            recs.append({
                "dataset_id": dataset_id,
                "category": "bi_variable",
                "chart_type": "Horizontal Bar",
                "x_variable": cat2,
                "y_variable": num,
                "aggregation": "avg",
                "title": f"Average {num.replace('_', ' ').title()} by {cat2.replace('_', ' ').title()}",
                "description": f"Ranked performance comparison for {cat2}."
            })

        # 2.3 Numerical vs Numerical Scatter
        if len(num_cols) >= 2:
            num1, num2 = num_cols[0], num_cols[1]
            recs.append({
                "dataset_id": dataset_id,
                "category": "bi_variable",
                "chart_type": "Scatter",
                "x_variable": num1,
                "y_variable": num2,
                "aggregation": "none",
                "title": f"Correlation: {num1.replace('_', ' ').title()} vs {num2.replace('_', ' ').title()}",
                "description": f"Scatter correlation and distribution between {num1} and {num2}."
            })

        # 2.4 Area or Grouped Bar
        if num_cols and cat_cols:
            cat = cat_cols[-1]
            num = num_cols[-1]
            recs.append({
                "dataset_id": dataset_id,
                "category": "bi_variable",
                "chart_type": "Area",
                "x_variable": cat,
                "y_variable": num,
                "aggregation": "avg",
                "title": f"Average {num.replace('_', ' ').title()} across {cat.replace('_', ' ').title()}",
                "description": f"Area distribution of {num} by {cat}."
            })

        # ----------------------------------------------------
        # TAB 3: MULTI-VARIABLE (3-4 Examples)
        # ----------------------------------------------------
        # 3.1 Stacked Bar: Cat 1 + Cat 2 + Numerical
        if len(cat_cols) >= 2 and num_cols:
            c1, c2 = cat_cols[0], cat_cols[1]
            num = num_cols[0]
            recs.append({
                "dataset_id": dataset_id,
                "category": "multi_variable",
                "chart_type": "Stacked Bar",
                "x_variable": c1,
                "y_variable": num,
                "group_variable": c2,
                "aggregation": "sum",
                "title": f"{num.replace('_', ' ').title()} by {c1.replace('_', ' ').title()} grouped by {c2.replace('_', ' ').title()}",
                "description": f"Multi-dimensional stacked segment analysis."
            })

        # 3.2 Multi-Series Line: Date + Category + Numerical
        if date_cols and cat_cols and num_cols:
            d_col = date_cols[0]
            cat = cat_cols[0]
            num = num_cols[0]
            recs.append({
                "dataset_id": dataset_id,
                "category": "multi_variable",
                "chart_type": "Line",
                "x_variable": d_col,
                "y_variable": num,
                "group_variable": cat,
                "aggregation": "sum",
                "title": f"Multi-Series {num.replace('_', ' ').title()} Trends by {cat.replace('_', ' ').title()}",
                "description": f"Time series breakdown for {num} segmented by {cat}."
            })
        elif len(cat_cols) >= 1 and len(num_cols) >= 2:
            # Multi-metric grouped line
            cat = cat_cols[0]
            num1 = num_cols[0]
            num2 = num_cols[1]
            recs.append({
                "dataset_id": dataset_id,
                "category": "multi_variable",
                "chart_type": "Stacked Area",
                "x_variable": cat,
                "y_variable": num1,
                "group_variable": cat_cols[1] if len(cat_cols) > 1 else cat,
                "aggregation": "sum",
                "title": f"Cumulative {num1.replace('_', ' ').title()} Allocation",
                "description": f"Stacked area composition by {cat}."
            })

        # 3.3 Bubble Scatter: Num 1 + Num 2 + Category (Group) + Num 3 (Size)
        if len(num_cols) >= 2 and cat_cols:
            num1, num2 = num_cols[0], num_cols[1]
            cat = cat_cols[0]
            size_var = num_cols[2] if len(num_cols) > 2 else None
            recs.append({
                "dataset_id": dataset_id,
                "category": "multi_variable",
                "chart_type": "Scatter",
                "x_variable": num1,
                "y_variable": num2,
                "group_variable": cat,
                "size_variable": size_var,
                "aggregation": "none",
                "title": f"Multi-Dimensional Cluster: {num1} vs {num2} by {cat}",
                "description": f"Clustered scatter relationship with categorical grouping."
            })

        # 3.4 Treemap / Hierarchical breakdown
        if len(cat_cols) >= 2 and num_cols:
            c1, c2 = cat_cols[0], cat_cols[1]
            num = num_cols[0]
            recs.append({
                "dataset_id": dataset_id,
                "category": "multi_variable",
                "chart_type": "Treemap",
                "x_variable": c1,
                "y_variable": num,
                "group_variable": c2,
                "aggregation": "sum",
                "title": f"Hierarchical Treemap of {num.replace('_', ' ').title()}",
                "description": f"Nested visualization across {c1} and {c2}."
            })

        return recs

    def compute_visualization_data(
        self,
        file_path: str,
        chart_type: str,
        x_variable: Optional[str] = None,
        y_variable: Optional[str] = None,
        group_variable: Optional[str] = None,
        size_variable: Optional[str] = None,
        aggregation: str = "none",
        filters: Optional[List[Dict[str, Any]]] = None,
        limit: int = 1000
    ) -> Dict[str, Any]:
        """
        Filters, aggregates, and transforms dataset into ready-to-render ECharts payload.
        """
        df = pd.read_csv(file_path, encoding='utf-8', on_bad_lines='skip')

        # 1. Apply Filters
        if filters:
            for flt in filters:
                col = flt.get("column")
                op = flt.get("operator", "eq")
                val = flt.get("value")
                if not col or col not in df.columns or val is None or val == "":
                    continue

                try:
                    if op == "eq":
                        df = df[df[col].astype(str).str.lower() == str(val).lower()]
                    elif op == "neq":
                        df = df[df[col].astype(str).str.lower() != str(val).lower()]
                    elif op == "gt":
                        df = df[pd.to_numeric(df[col], errors='coerce') > float(val)]
                    elif op == "gte":
                        df = df[pd.to_numeric(df[col], errors='coerce') >= float(val)]
                    elif op == "lt":
                        df = df[pd.to_numeric(df[col], errors='coerce') < float(val)]
                    elif op == "lte":
                        df = df[pd.to_numeric(df[col], errors='coerce') <= float(val)]
                    elif op == "in" and isinstance(val, list):
                        str_vals = [str(v).lower() for v in val]
                        df = df[df[col].astype(str).str.lower().isin(str_vals)]
                    elif op == "contains":
                        df = df[df[col].astype(str).str.contains(str(val), case=False, na=False)]
                except Exception as e:
                    logger.warning(f"Failed to apply filter {flt}: {e}")

        if df.empty:
            return {"columns": [], "rows": [], "chart_type": chart_type, "row_count": 0}

        # 2. Execute Aggregation & Data Transformation
        norm_type = chart_type.lower().replace(" ", "_")
        
        # Single KPI Metric
        if norm_type == "metric":
            num_col = y_variable or x_variable
            val = 0
            if num_col and num_col in df.columns:
                num_series = pd.to_numeric(df[num_col], errors='coerce').dropna()
                if aggregation == "sum":
                    val = float(num_series.sum())
                elif aggregation == "avg":
                    val = float(num_series.mean())
                elif aggregation == "min":
                    val = float(num_series.min())
                elif aggregation == "max":
                    val = float(num_series.max())
                elif aggregation == "count":
                    val = float(len(num_series))
                else:
                    val = float(num_series.sum()) if not num_series.empty else 0.0

            return {
                "columns": ["metric", "value"],
                "rows": [{"metric": num_col or "Total", "value": round(val, 2)}],
                "row_count": 1,
                "chart_type": "Metric"
            }

        # Scatter Plots (no aggregation by default)
        if norm_type == "scatter":
            cols_needed = [c for c in [x_variable, y_variable, group_variable, size_variable] if c and c in df.columns]
            sample_df = df[cols_needed].dropna().head(limit)
            return {
                "columns": cols_needed,
                "rows": sample_df.to_dict(orient='records'),
                "row_count": len(sample_df),
                "chart_type": "Scatter"
            }

        # Grouped / Stacked aggregations
        if group_variable and group_variable in df.columns and x_variable and x_variable in df.columns:
            target_num = y_variable if (y_variable and y_variable in df.columns and pd.api.types.is_numeric_dtype(df[y_variable])) else None
            
            agg_func = aggregation if aggregation in ("sum", "mean", "min", "max", "median") else "sum"
            if agg_func == "avg":
                agg_func = "mean"

            if target_num:
                pivot = df.pivot_table(index=x_variable, columns=group_variable, values=target_num, aggfunc=agg_func, fill_value=0)
            else:
                pivot = df.pivot_table(index=x_variable, columns=group_variable, aggfunc='size', fill_value=0)

            pivot = pivot.head(50)
            pivot_reset = pivot.reset_index()
            cols = [str(c) for c in pivot_reset.columns]
            pivot_reset.columns = cols
            
            return {
                "columns": cols,
                "rows": pivot_reset.to_dict(orient='records'),
                "row_count": len(pivot_reset),
                "chart_type": chart_type,
                "x_axis": x_variable,
                "group_variable": group_variable
            }

        # Metric / KPI Single Card
        if norm_type in ("metric", "kpi"):
            metric_col = y_variable or x_variable or (df.columns[0] if not df.empty else "value")
            if metric_col in df.columns and pd.api.types.is_numeric_dtype(df[metric_col]):
                agg_fn = "mean" if aggregation == "avg" else (aggregation if aggregation in ("sum", "min", "max", "mean") else "sum")
                val = float(df[metric_col].agg(agg_fn))
                return {
                    "columns": [metric_col, "value"],
                    "rows": [{metric_col: metric_col, "value": round(val, 2)}],
                    "row_count": 1,
                    "chart_type": "Metric"
                }
            else:
                cnt = len(df)
                return {
                    "columns": ["metric", "value"],
                    "rows": [{"metric": "Total Records", "value": cnt}],
                    "row_count": 1,
                    "chart_type": "Metric"
                }

        # Standard 1D / 2D Aggregation
        if x_variable and x_variable in df.columns:
            # Case A: Same variable for X and Y (e.g. self-count or frequency distribution)
            if x_variable == y_variable:
                if aggregation == "count" or norm_type in ("pie", "donut", "bar", "horizontal bar"):
                    counts = df[x_variable].value_counts().reset_index()
                    counts.columns = [x_variable, "count"]
                    counts = counts.head(50)
                    return {
                        "columns": [x_variable, "count"],
                        "rows": counts.to_dict(orient='records'),
                        "row_count": len(counts),
                        "chart_type": chart_type
                    }
                elif pd.api.types.is_numeric_dtype(df[x_variable]):
                    agg_fn = "mean" if aggregation == "avg" else (aggregation if aggregation in ("sum", "min", "max", "mean") else "count")
                    val = float(df[x_variable].agg(agg_fn))
                    return {
                        "columns": [x_variable, "value"],
                        "rows": [{x_variable: x_variable, "value": round(val, 2)}],
                        "row_count": 1,
                        "chart_type": chart_type
                    }

            # Case B: Distinct X and Y with numerical aggregation
            if y_variable and y_variable in df.columns and y_variable != x_variable and pd.api.types.is_numeric_dtype(df[y_variable]) and aggregation != "none":
                agg_fn = "mean" if aggregation == "avg" else aggregation
                try:
                    grouped = df.groupby(x_variable, as_index=False)[y_variable].agg(agg_fn)
                    grouped = grouped.sort_values(by=y_variable, ascending=False).head(50)
                    grouped.columns = [x_variable, y_variable]
                    return {
                        "columns": [x_variable, y_variable],
                        "rows": grouped.to_dict(orient='records'),
                        "row_count": len(grouped),
                        "chart_type": chart_type
                    }
                except Exception as e:
                    logger.warning(f"Groupby aggregation failed: {e}")

            # Case C: Category count or Pie / Donut
            if aggregation == "count" or norm_type in ("pie", "donut"):
                counts = df[x_variable].value_counts().reset_index()
                counts.columns = [x_variable, "count"]
                counts = counts.head(30)
                return {
                    "columns": [x_variable, "count"],
                    "rows": counts.to_dict(orient='records'),
                    "row_count": len(counts),
                    "chart_type": chart_type
                }
            else:
                # Raw sample rows
                cols_to_show = [c for c in [x_variable, y_variable] if c and c in df.columns]
                sample_rows = df[cols_to_show].dropna().head(50)
                return {
                    "columns": cols_to_show,
                    "rows": sample_rows.to_dict(orient='records'),
                    "row_count": len(sample_rows),
                    "chart_type": chart_type
                }

        # Fallback first 2 columns
        first_cols = list(df.columns[:2])
        return {
            "columns": first_cols,
            "rows": df[first_cols].head(30).to_dict(orient='records'),
            "row_count": min(len(df), 30),
            "chart_type": chart_type
        }

    async def chat_to_visualization_spec(
        self,
        user_prompt: str,
        col_meta: Dict[str, Any],
        model: Optional[str] = None,
        dataset_id: Optional[str] = None,
        db: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Converts user's natural language chart request into a structured visualization specification.
        Generates required SQL query, calculates transformation steps, selects chart type, and executes
        the SQL against dataset to provide live preview data.
        """
        import re
        # Filter out internal keys (e.g. _sheets, _active_sheet) and ensure entries are dicts
        clean_col_meta = {
            c: m for c, m in (col_meta or {}).items()
            if isinstance(m, dict) and not str(c).startswith("_")
        }

        # Identify available tables (primary 'dataset' + any multi-sheet workbook tables)
        available_tables = ["dataset"]
        raw_sheets = (col_meta or {}).get("_sheets", [])
        if isinstance(raw_sheets, list):
            for s in raw_sheets:
                tbl = re.sub(r'[^a-zA-Z0-9_]', '_', str(s)).strip('_').lower()
                if tbl and tbl not in available_tables:
                    available_tables.append(tbl)

        columns_desc = []
        for col, m in clean_col_meta.items():
            dt = m.get('data_type', 'string')
            uc = m.get('unique_count', 'unknown')
            columns_desc.append(f"- {col} (Type: {dt}, Distinct: {uc})")

        tables_clause = f"AVAILABLE TABLES:\n- Primary Active Sheet: `dataset`\n"
        if len(available_tables) > 1:
            tables_clause += f"- Multi-Sheet Workbook Tables: " + ", ".join([f"`{t}`" for t in available_tables if t != 'dataset']) + "\n"

        prompt = f"""You are a Principal Data Architect & Analytics Visualizer.
Convert the user's natural language visualization request into an optimized SQLite query, calculate transformation steps, and select the best chart type.

{tables_clause}
ACTIVE DATASET SCHEMA:
{chr(10).join(columns_desc)}

USER REQUEST:
"{user_prompt}"

INSTRUCTIONS:
1. Generate the SQLite SQL query (`sql`):
   - Query from `dataset` (or JOIN other available tables on common keys if needed).
   - Use standard SQLite aggregations: SUM(), AVG(), COUNT(), MIN(), MAX(), ROUND().
   - Use GROUP BY, ORDER BY, and LIMIT (maximum 50 rows) appropriately.
2. Determine `calculations`:
   - State in 1-2 concise sentences the exact aggregations, grouping, calculations, or filters applied.
3. Select `chart_type`:
   - Best fit from: Bar, Horizontal Bar, Line, Area, Pie, Donut, Scatter, Treemap, Stacked Bar, Stacked Area, Metric.
4. Select `x_variable` and `y_variable`:
   - MUST match column names or aliases present in your generated SQL SELECT clause.
5. Select `category`:
   - "single_variable", "bi_variable", or "multi_variable".
6. Return JSON ONLY matching this structure:
{{
  "sql": "SELECT column_x, SUM(column_y) AS total_val FROM dataset GROUP BY column_x ORDER BY total_val DESC LIMIT 20;",
  "calculations": "Aggregated total_val using SUM() grouped by column_x, sorted descending.",
  "chart_type": "Bar",
  "category": "bi_variable",
  "x_variable": "column_x",
  "y_variable": "total_val",
  "title": "Descriptive Chart Title",
  "description": "Short explanation of what the chart visualizes.",
  "reasoning": "Why this SQL query and chart type best answer the user's request."
}}
"""
        messages = [
            {"role": "system", "content": "You are a professional data visualization architect. Return valid JSON only."},
            {"role": "user", "content": prompt}
        ]

        try:
            resp = await groq_client.get_chat_completion(
                messages=messages,
                model=model,
                temperature=0.0,
                max_tokens=settings.chart_generation_max_tokens,
                json_mode=True,
                task_name="Chat to Visualization Spec"
            )
            resp_clean = resp.strip()
            if resp_clean.startswith("```"):
                lines = resp_clean.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                resp_clean = "\n".join(lines).strip()

            parsed = json.loads(resp_clean)

            # Ensure required fields and column validity
            if not parsed.get("x_variable") and clean_col_meta:
                parsed["x_variable"] = list(clean_col_meta.keys())[0]
            if not parsed.get("chart_type"):
                parsed["chart_type"] = "Bar"
            if not parsed.get("category"):
                parsed["category"] = "bi_variable" if parsed.get("y_variable") else "single_variable"
            if not parsed.get("title"):
                parsed["title"] = f"Chart: {user_prompt[:40]}"
            if not parsed.get("sql"):
                first_col = parsed.get("x_variable")
                second_col = parsed.get("y_variable") or first_col
                parsed["sql"] = f"SELECT {first_col}, COUNT(*) AS count FROM dataset GROUP BY {first_col} LIMIT 30;"
                parsed["calculations"] = f"Grouped by {first_col} with record counts."

            # Execute the generated SQL query to provide live preview data
            query_cols = []
            query_rows = []
            row_count = 0
            if dataset_id and db:
                try:
                    from backend.services.project_service import project_service
                    res = project_service.query_project_data(dataset_id, parsed["sql"], db, limit=50)
                    query_cols = res.get("columns", [])
                    query_rows = res.get("rows", [])
                    row_count = res.get("row_count", 0)
                except Exception as q_err:
                    logger.warning(f"Generated SQL execution failed: {q_err}. Falling back to default query.")
                    try:
                        from backend.services.project_service import project_service
                        fallback_sql = "SELECT * FROM dataset LIMIT 30;"
                        res = project_service.query_project_data(dataset_id, fallback_sql, db, limit=30)
                        query_cols = res.get("columns", [])
                        query_rows = res.get("rows", [])
                        row_count = res.get("row_count", 0)
                    except Exception:
                        pass

            parsed["columns"] = query_cols
            parsed["rows"] = query_rows
            parsed["row_count"] = row_count
            return parsed

        except Exception as e:
            logger.error(f"Failed to generate visualization spec: {e}")
            
            # Intelligent semantic column match based on user prompt tokens
            prompt_lower = user_prompt.lower()
            all_cols = list(clean_col_meta.keys())
            
            # 1. Match numeric value column
            num_candidates = [c for c, m in clean_col_meta.items() if m.get("data_type") == "numerical"]
            matched_num = None
            for c in num_candidates:
                c_low = c.lower()
                if c_low in prompt_lower or any(part in prompt_lower for part in c_low.split('_') if len(part) > 2):
                    matched_num = c
                    break
            if not matched_num and num_candidates:
                matched_num = num_candidates[0]

            # 2. Match dimension / categorical column
            cat_candidates = [c for c, m in clean_col_meta.items() if m.get("data_type") != "numerical"]
            matched_cat = None
            for c in cat_candidates:
                c_low = c.lower()
                if c_low in prompt_lower or any(part in prompt_lower for part in c_low.split('_') if len(part) > 2):
                    matched_cat = c
                    break
            if not matched_cat and cat_candidates:
                matched_cat = cat_candidates[0]

            dim_col = matched_cat or (all_cols[0] if all_cols else "category")
            val_col = matched_num or (all_cols[1] if len(all_cols) > 1 else dim_col)

            # 3. Detect aggregation intent
            is_avg = any(w in prompt_lower for w in ["average", "avg", "mean"])
            agg_fn = f"ROUND(AVG({val_col}), 2)" if is_avg else f"SUM({val_col})"
            agg_alias = f"avg_{val_col}" if is_avg else f"total_{val_col}"
            agg_label = "Average" if is_avg else "Total"

            fallback_sql = f"SELECT {dim_col}, {agg_fn} AS {agg_alias} FROM dataset GROUP BY {dim_col} ORDER BY {agg_alias} DESC LIMIT 30;"
            
            fallback_spec = {
                "sql": fallback_sql,
                "calculations": f"Calculated {agg_label.lower()} {val_col.replace('_', ' ')} grouped by {dim_col.replace('_', ' ')}, ordered descending.",
                "category": "bi_variable",
                "chart_type": "Bar",
                "x_variable": dim_col,
                "y_variable": agg_alias,
                "aggregation": "avg" if is_avg else "sum",
                "title": f"{agg_label} {val_col.replace('_', ' ').title()} by {dim_col.replace('_', ' ').title()}",
                "description": f"Visualization of {agg_label.lower()} {val_col.replace('_', ' ')} across different {dim_col.replace('_', ' ')} groups.",
                "reasoning": f"Identified {val_col} and {dim_col} as best match for '{user_prompt}'.",
                "columns": [dim_col, agg_alias],
                "rows": [],
                "row_count": 0
            }

            if dataset_id and db:
                try:
                    from backend.services.project_service import project_service
                    res = project_service.query_project_data(dataset_id, fallback_sql, db, limit=30)
                    fallback_spec["columns"] = res.get("columns", [dim_col, agg_alias])
                    fallback_spec["rows"] = res.get("rows", [])
                    fallback_spec["row_count"] = res.get("row_count", 0)
                except Exception as fb_err:
                    logger.warning(f"Fallback SQL execution failed: {fb_err}")

            return fallback_spec

    async def generate_visualization_insights(
        self,
        title: str,
        chart_type: str,
        x_variable: str,
        y_variable: str,
        aggregated_data: List[Dict[str, Any]],
        columns: List[str],
        model: Optional[str] = None
    ) -> str:
        """
        Analyzes summarized chart data on explicit user demand and returns Markdown insights.
        """
        sample_rows = aggregated_data[:15]
        data_text = "\n".join([str(r) for r in sample_rows])

        prompt = f"""You are an elite Business Intelligence Analyst. Provide clear, data-driven analytical insights for the following chart.

CHART DETAILS:
- Title: {title}
- Chart Type: {chart_type}
- Variables: X = {x_variable}, Y = {y_variable}
- Aggregated Data Sample:
{data_text}

INSTRUCTIONS:
1. Provide a concise, highly structured Markdown analysis.
2. Include headings: `### Key Findings`, `### Notable Trends & Patterns`, `### Outliers & Anomalies`, `### Strategic Takeaways`.
3. Use bullet points and **bold** numbers for key percentages and totals.
4. Keep the insights actionable, professional, and grounded solely in the provided data.
"""
        messages = [
            {"role": "system", "content": "You are a helpful business intelligence analyst."},
            {"role": "user", "content": prompt}
        ]

        try:
            resp = await groq_client.get_chat_completion(
                messages=messages,
                model=model,
                temperature=0.3,
                max_tokens=settings.widget_insight_max_tokens,
                json_mode=False,
                task_name="Visualization Insights"
            )
            return resp
        except Exception as e:
            logger.error(f"Failed to generate visualization insights: {e}")
            return f"Unable to generate insights: {str(e)}"

    def get_dataset_multi_table_schema(self, dataset_id: str, db: Session) -> Dict[str, Any]:
        """
        Extracts multi-sheet / multi-table schema for the dataset, including table names,
        columns, data types, null counts, unique counts, sample values, and potential join keys.
        """
        if isinstance(dataset_id, DatasetSession):
            project = dataset_id
            dataset_id = project.id
        else:
            project = db.query(DatasetSession).filter(DatasetSession.id == str(dataset_id)).first()
        if not project:
            raise ValueError("Dataset project not found")

        tables = []
        table_names = []
        all_col_names = set()

        # Check if Excel file with multiple sheets
        if project.file_path and os.path.exists(project.file_path) and dataset_service.is_excel_file(project.file_path):
            sheet_names = dataset_service.get_sheet_names(project.file_path)
            for s in sheet_names:
                table_name = re.sub(r'[^a-zA-Z0-9_]', '_', s).strip('_').lower()
                if not table_name:
                    continue
                try:
                    sdf = dataset_service.read_excel_sheet(project.file_path, sheet_name=s)
                    col_list = []
                    for c in sdf.columns:
                        all_col_names.add(c)
                        series = sdf[c]
                        col_list.append({
                            "name": c,
                            "data_type": str(series.dtype),
                            "null_count": int(series.isnull().sum()),
                            "unique_count": int(series.nunique(dropna=True)),
                            "sample_values": [str(x) for x in series.dropna().head(3).tolist()]
                        })
                    tables.append({
                        "table_name": table_name,
                        "sheet_name": s,
                        "row_count": len(sdf),
                        "column_count": len(sdf.columns),
                        "columns": col_list
                    })
                    table_names.append(table_name)
                except Exception as err:
                    logger.warning(f"Could not profile sheet {s}: {err}")

        # If no tables from multi-sheet, profile processed CSV
        if not tables:
            csv_path = project.processed_file_path or project.file_path
            if csv_path and os.path.exists(csv_path):
                df = dataset_service.read_csv_robust(csv_path)
                col_list = []
                for c in df.columns:
                    all_col_names.add(c)
                    series = df[c]
                    col_list.append({
                        "name": c,
                        "data_type": str(series.dtype),
                        "null_count": int(series.isnull().sum()),
                        "unique_count": int(series.nunique(dropna=True)),
                        "sample_values": [str(x) for x in series.dropna().head(3).tolist()]
                    })
                tables.append({
                    "table_name": "dataset",
                    "sheet_name": "Active Data",
                    "row_count": len(df),
                    "column_count": len(df.columns),
                    "columns": col_list
                })
                table_names = ["dataset", "data", "df"]

        # Identify potential join keys across tables (columns ending in _id, id, code, or shared across multiple tables)
        potential_keys = []
        if len(tables) > 1:
            col_table_counts = {}
            for t in tables:
                for c in t["columns"]:
                    name = c["name"]
                    col_table_counts[name] = col_table_counts.get(name, 0) + 1
            for name, cnt in col_table_counts.items():
                if cnt > 1 or name.lower().endswith(('_id', 'id', '_code', '_key')):
                    potential_keys.append(name)
        else:
            potential_keys = [c["name"] for c in tables[0]["columns"] if c["name"].lower().endswith(('_id', 'id', '_code', '_key'))]

        return {
            "project_name": project.name,
            "total_tables": len(tables),
            "table_names": table_names,
            "tables": tables,
            "potential_join_keys": potential_keys
        }

    def _format_compact_schema(self, schema_info: Dict[str, Any]) -> str:
        """
        Formats schema into a compact, token-efficient representation to avoid Groq ITPM 413 limits.
        """
        lines = []
        tables = schema_info.get("tables", [])
        for t in tables:
            tname = t.get("table_name", "dataset")
            sname = t.get("sheet_name", tname)
            rows = t.get("row_count", 0)
            sheet_label = f" (Sheet: '{sname}')" if sname != tname else ""
            lines.append(f"Table `{tname}`{sheet_label} - {rows:,} rows:")
            cols = t.get("columns", [])
            for c in cols[:30]:
                cname = c.get("name")
                dtype = c.get("data_type", "string")
                samples = c.get("sample_values", [])[:2]
                samples_str = f" [e.g. {', '.join([str(s)[:25] for s in samples])}]" if samples else ""
                lines.append(f"  * `{cname}` ({dtype}{samples_str})")
            if len(cols) > 30:
                lines.append(f"  * ... ({len(cols) - 30} more columns)")
            lines.append("")

        join_keys = schema_info.get("potential_join_keys", [])
        if join_keys:
            lines.append(f"Potential Common / Join Keys: {', '.join([f'`{k}`' for k in join_keys])}\n")
        return "\n".join(lines).strip()

    def _parse_visualizations_json(self, resp_str: str) -> List[Dict[str, Any]]:
        """
        Robust JSON extractor with multiple fallback recovery strategies:
        1. Direct json.loads
        2. Markdown-stripped json.loads
        3. Regex recovery of individual completed visualization objects if response was truncated
        """
        clean = resp_str.strip()
        if "```" in clean:
            clean = re.sub(r'```(?:json)?\s*', '', clean)
            clean = clean.replace('```', '').strip()

        # 1. Direct parse
        try:
            data = json.loads(clean)
            if isinstance(data, dict) and isinstance(data.get("visualizations"), list):
                return data["visualizations"]
            if isinstance(data, list):
                return data
        except Exception:
            pass

        # 2. Extract outermost { ... }
        try:
            match = re.search(r'\{[\s\S]*\}', clean)
            if match:
                data = json.loads(match.group(0))
                if isinstance(data, dict) and isinstance(data.get("visualizations"), list):
                    return data["visualizations"]
        except Exception:
            pass

        # 3. Truncated stream recovery: Extract every completed individual object
        recovered = []
        obj_matches = re.finditer(r'\{[^{}]*?"title"\s*:\s*"[^"]+?"[^{}]*?\}', clean)
        for m in obj_matches:
            try:
                item = json.loads(m.group(0))
                if isinstance(item, dict) and "title" in item:
                    recovered.append(item)
            except Exception:
                continue

        if recovered:
            logger.info(f"Recovered {len(recovered)} valid visualization objects from truncated LLM response.")
            return recovered

        return []

    async def generate_single_variable_plans(
        self,
        schema_info: Dict[str, Any],
        model: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Stage 1 Planner 1: Identifies 3-4 high-impact single-variable visualizations
        (KPI metric cards, distributions, record counts, frequency breakdowns).
        Does NOT generate SQL. Returns structured ideas only.
        """
        compact_schema = self._format_compact_schema(schema_info)
        prompt = f"""You are PRAJNA's Single-Variable Visualization Planner.
Your task is to analyze the dataset schema and recommend 3 to 4 high-value visualizations that primarily depend on a SINGLE field (e.g. key KPI metrics, value distributions, category counts, status breakdowns).

DATASET SCHEMA:
{compact_schema}

RECOMMENDED SINGLE-VARIABLE PATTERNS:
- Key numeric metric (e.g. Total Revenue, Total Volume) -> "Metric" KPI Card
- Categorical frequency / count (e.g. Orders by Status, Users by Tier) -> "Bar"
- Percentage composition of low-cardinality category (3-7 unique values) -> "Donut" or "Pie"
- Numerical distribution profile -> "Bar" (Histogram/Distribution) or "Area"

REQUIREMENTS:
1. Output ONLY a valid JSON object matching the format below.
2. Select 3 to 4 visualizations strictly based on actual columns in the schema. Do not invent columns.
3. DO NOT write or output SQL queries at this planning stage.
4. Keep titles concise (under 7 words).

JSON format:
{{
  "visualizations": [
    {{
      "title": "Total Revenue KPI",
      "chart_type": "Metric",
      "fields": ["revenue"],
      "description": "Aggregate total revenue value across all records.",
      "category": "single_variable"
    }}
  ]
}}"""
        try:
            resp = await groq_client.get_chat_completion(
                messages=[
                    {"role": "system", "content": "You are a senior data visualization planner. Return valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                model=model or settings.default_model,
                temperature=0.2,
                max_tokens=1000,
                json_mode=True,
                task_name="Planner: Single-Variable Visualizations"
            )
            parsed = self._parse_visualizations_json(resp)
            results = []
            for item in parsed:
                fields = item.get("fields") or ([item.get("x_variable")] if item.get("x_variable") else [])
                results.append({
                    "title": item.get("title", "Single Variable Metric"),
                    "chart_type": item.get("chart_type", "Metric"),
                    "fields": [f for f in fields if f],
                    "description": item.get("description", ""),
                    "category": "single_variable",
                    "sql": item.get("sql"),
                    "x_variable": item.get("x_variable"),
                    "y_variable": item.get("y_variable"),
                    "aggregation": item.get("aggregation")
                })
            return results[:4]
        except Exception as e:
            logger.warning(f"Single-variable planner LLM call failed: {e}")
            return []

    async def generate_bi_variable_plans(
        self,
        schema_info: Dict[str, Any],
        model: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Stage 1 Planner 2: Identifies 3-4 high-impact bi-variable visualizations
        (time trends Date+Metric, category comparisons Cat+Metric, correlations Num+Num).
        Does NOT generate SQL. Returns structured ideas only.
        """
        compact_schema = self._format_compact_schema(schema_info)
        prompt = f"""You are PRAJNA's Bi-Variable Visualization Planner.
Your task is to analyze the dataset schema and recommend 3 to 4 high-value visualizations that analyze relationships between TWO fields.

DATASET SCHEMA:
{compact_schema}

RECOMMENDED BI-VARIABLE PATTERNS:
- Date/Timestamp + Numerical Metric -> "Line" (e.g. Monthly Revenue Trend)
- Category + Numerical Metric -> "Bar" or "Horizontal Bar" (e.g. Sales by Product Category)
- Numerical + Numerical -> "Scatter" (e.g. Price vs Sales Volume correlation)
- Category (2-6 values) + Metric -> "Donut" or "Pie" (e.g. Revenue share by Region)

REQUIREMENTS:
1. Output ONLY a valid JSON object matching the format below.
2. Select 3 to 4 visualizations strictly based on actual columns in the schema. Do not invent columns.
3. DO NOT write or output SQL queries at this planning stage.
4. Keep titles concise (under 7 words).

JSON format:
{{
  "visualizations": [
    {{
      "title": "Monthly Sales Trend",
      "chart_type": "Line",
      "fields": ["order_date", "sales"],
      "description": "Show monthly sales progression over time.",
      "category": "bi_variable"
    }}
  ]
}}"""
        try:
            resp = await groq_client.get_chat_completion(
                messages=[
                    {"role": "system", "content": "You are a senior data visualization planner. Return valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                model=model or settings.default_model,
                temperature=0.2,
                max_tokens=1000,
                json_mode=True,
                task_name="Planner: Bi-Variable Visualizations"
            )
            parsed = self._parse_visualizations_json(resp)
            results = []
            for item in parsed:
                fields = item.get("fields") or []
                if not fields and (item.get("x_variable") or item.get("y_variable")):
                    fields = [f for f in [item.get("x_variable"), item.get("y_variable")] if f]
                results.append({
                    "title": item.get("title", "Bi-Variable Relationship"),
                    "chart_type": item.get("chart_type", "Bar"),
                    "fields": fields,
                    "description": item.get("description", ""),
                    "category": "bi_variable",
                    "sql": item.get("sql"),
                    "x_variable": item.get("x_variable"),
                    "y_variable": item.get("y_variable"),
                    "aggregation": item.get("aggregation")
                })
            return results[:4]
        except Exception as e:
            logger.warning(f"Bi-variable planner LLM call failed: {e}")
            return []

    async def generate_multi_variable_plans(
        self,
        schema_info: Dict[str, Any],
        model: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Stage 1 Planner 3: Identifies 3-4 high-impact multi-variable visualizations
        (segments, dimensions, multi-series trends, bubble clusters, or cross-sheet relationships).
        Does NOT generate SQL. Returns structured ideas only.
        """
        compact_schema = self._format_compact_schema(schema_info)
        prompt = f"""You are PRAJNA's Multi-Variable Visualization Planner.
Your task is to analyze the dataset schema (including multiple tables & join keys if present) and recommend 3 to 4 high-value visualizations involving MULTIPLE fields, segments, dimensions, or meaningful combinations.

DATASET SCHEMA:
{compact_schema}

RECOMMENDED MULTI-VARIABLE PATTERNS:
- Dimension 1 + Dimension 2 + Metric -> "Stacked Bar" (e.g. Sales by Category segmented by Region)
- Date + Dimension + Metric -> "Line" (e.g. Monthly Revenue Trends across Product Lines)
- Metric 1 + Metric 2 + Dimension (Group) + Metric 3 (Size) -> "Scatter" (Cluster / Bubble analysis)
- Hierarchical breakdown -> "Treemap" or "Stacked Area"

REQUIREMENTS:
1. Output ONLY a valid JSON object matching the format below.
2. Select 3 to 4 visualizations strictly based on actual columns in the schema. Do not invent columns.
3. Avoid overly complex charts; focus on practical business insight.
4. DO NOT write or output SQL queries at this planning stage.
5. Keep titles concise (under 7 words).

JSON format:
{{
  "visualizations": [
    {{
      "title": "Regional Sales by Category",
      "chart_type": "Stacked Bar",
      "fields": ["region", "category", "sales"],
      "description": "Compare category sales contributions across geographic regions.",
      "category": "multi_variable"
    }}
  ]
}}"""
        try:
            resp = await groq_client.get_chat_completion(
                messages=[
                    {"role": "system", "content": "You are a senior data visualization planner. Return valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                model=model or settings.default_model,
                temperature=0.2,
                max_tokens=1000,
                json_mode=True,
                task_name="Planner: Multi-Variable Visualizations"
            )
            parsed = self._parse_visualizations_json(resp)
            results = []
            for item in parsed:
                fields = item.get("fields") or []
                if not fields and (item.get("x_variable") or item.get("y_variable") or item.get("group_variable")):
                    fields = [f for f in [item.get("x_variable"), item.get("y_variable"), item.get("group_variable")] if f]
                results.append({
                    "title": item.get("title", "Multi-Variable Analysis"),
                    "chart_type": item.get("chart_type", "Stacked Bar"),
                    "fields": fields,
                    "description": item.get("description", ""),
                    "category": "multi_variable",
                    "sql": item.get("sql"),
                    "x_variable": item.get("x_variable"),
                    "y_variable": item.get("y_variable"),
                    "group_variable": item.get("group_variable"),
                    "size_variable": item.get("size_variable"),
                    "aggregation": item.get("aggregation")
                })
            return results[:4]
        except Exception as e:
            logger.warning(f"Multi-variable planner LLM call failed: {e}")
            return []

    def combine_visualization_plans(
        self,
        single_plans: List[Dict[str, Any]],
        bi_plans: List[Dict[str, Any]],
        multi_plans: List[Dict[str, Any]],
        fallback_recs: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Combines Stage 1 planner outputs, removes duplicates and redundant ideas,
        and ensures balanced representation across Single, Bi, and Multi-variable categories.
        Aims for 10-12 high-value visualization ideas.
        """
        # Ensure category fallback if any planner produced 0 results
        if fallback_recs:
            if not single_plans:
                single_plans = [r for r in fallback_recs if r.get("category") == "single_variable"][:4]
            if not bi_plans:
                bi_plans = [r for r in fallback_recs if r.get("category") == "bi_variable"][:4]
            if not multi_plans:
                multi_plans = [r for r in fallback_recs if r.get("category") == "multi_variable"][:4]

        combined = []
        seen_titles = set()
        seen_field_combos = set()

        for group, cat_name in [(single_plans, "single_variable"), (bi_plans, "bi_variable"), (multi_plans, "multi_variable")]:
            count_for_cat = 0
            for item in group:
                if count_for_cat >= 4:
                    break
                title = item.get("title", "").strip()
                norm_title = re.sub(r'[^a-z0-9]', '', title.lower())
                fields = sorted([str(f).lower() for f in item.get("fields", []) if f])
                field_key = f"{cat_name}:{':'.join(fields)}:{item.get('chart_type', '').lower()}"

                if norm_title in seen_titles or (fields and field_key in seen_field_combos):
                    continue

                seen_titles.add(norm_title)
                if fields:
                    seen_field_combos.add(field_key)

                combined.append({
                    "title": title or f"{cat_name.replace('_', ' ').title()} Chart",
                    "chart_type": item.get("chart_type", "Bar"),
                    "fields": item.get("fields", []),
                    "description": item.get("description", ""),
                    "category": cat_name,
                    "sql": item.get("sql"),
                    "x_variable": item.get("x_variable"),
                    "y_variable": item.get("y_variable"),
                    "group_variable": item.get("group_variable"),
                    "size_variable": item.get("size_variable"),
                    "aggregation": item.get("aggregation")
                })
                count_for_cat += 1

        return combined

    async def generate_visualization_from_plan(
        self,
        dataset_id: str,
        plan_item: Dict[str, Any],
        schema_info: Dict[str, Any],
        db: Session,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Stage 2: Takes a single visualization idea and generates its detailed
        chart specification, validates & executes SQL, and saves SavedVisualization.
        """
        from backend.services.project_service import project_service
        from backend.services.sql_validator import sql_validator

        compact_schema = self._format_compact_schema(schema_info)
        table_names = schema_info.get("table_names", ["dataset"])
        primary_table = table_names[0] if table_names else "dataset"

        title = plan_item.get("title", "AI Chart")
        category = plan_item.get("category", "bi_variable")
        chart_type = plan_item.get("chart_type", "Bar")
        fields = plan_item.get("fields", [])
        desc = plan_item.get("description", "")

        # If plan_item already has fully formulated SQL & variables (e.g. from unit test mock or fallback),
        # use it directly without a redundant LLM call
        preset_sql = plan_item.get("sql")
        if preset_sql:
            spec = {
                "title": title,
                "category": category,
                "chart_type": chart_type,
                "x_variable": plan_item.get("x_variable") or (fields[0] if fields else None),
                "y_variable": plan_item.get("y_variable") or (fields[1] if len(fields) > 1 else None),
                "group_variable": plan_item.get("group_variable"),
                "size_variable": plan_item.get("size_variable"),
                "aggregation": plan_item.get("aggregation", "none"),
                "sql": preset_sql,
                "calculations": plan_item.get("calculations", desc),
                "description": desc
            }
        else:
            prompt = f"""You are PRAJNA's Visualization Specification & SQL Engineer.
Generate the complete specification and SQLite SQL query for THIS SINGLE visualization:

TARGET VISUALIZATION:
- Title: "{title}"
- Category: "{category}"
- Suggested Chart Type: "{chart_type}"
- Relevant Fields: {json.dumps(fields)}
- Business Objective: "{desc}"

DATASET SCHEMA:
{compact_schema}

REQUIREMENTS:
1. Write a read-only SQLite SQL query. Always query the specific table name `{primary_table}` (or JOIN available tables {json.dumps(table_names)}) rather than 'dataset'.
2. Always include LIMIT 50. Use GROUP BY, ORDER BY, and standard functions: SUM(), AVG(), COUNT(), MIN(), MAX(), ROUND().
3. Select columns that cleanly map to x_variable and y_variable.
4. Output ONLY valid JSON matching this schema:
{{
  "title": "{title}",
  "category": "{category}",
  "chart_type": "{chart_type}",
  "x_variable": "ColumnName",
  "y_variable": "MetricColumn",
  "group_variable": null,
  "size_variable": null,
  "aggregation": "sum" | "avg" | "count" | "min" | "max" | "none",
  "sql": "SELECT ... FROM ... LIMIT 30;",
  "calculations": "1 concise sentence calculation explanation.",
  "description": "{desc}"
}}"""

            resp = await groq_client.get_chat_completion(
                messages=[
                    {"role": "system", "content": "You are a professional SQL and visualization engineer. Return valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                model=model or settings.default_model,
                temperature=0.1,
                max_tokens=1000,
                json_mode=True,
                task_name=f"Spec & SQL: {title[:30]}"
            )

            # Parse response
            spec_list = self._parse_visualizations_json(resp)
            if spec_list and isinstance(spec_list, list):
                # Try finding matching title in spec_list or pick first
                matched = next((s for s in spec_list if s.get("title") == title), spec_list[0])
                spec = matched
            else:
                try:
                    loaded = json.loads(resp)
                    if isinstance(loaded.get("visualizations"), list) and loaded["visualizations"]:
                        spec = loaded["visualizations"][0]
                    else:
                        spec = loaded
                except Exception:
                    spec = {
                        "title": title,
                        "category": category,
                        "chart_type": chart_type,
                        "x_variable": fields[0] if fields else None,
                        "y_variable": fields[1] if len(fields) > 1 else None,
                        "sql": f"SELECT * FROM {primary_table} LIMIT 20;",
                        "calculations": "Direct sample query",
                        "description": desc
                    }

        sql = (spec.get("sql") or spec.get("sql_query") or f"SELECT * FROM {primary_table} LIMIT 20;").strip()

        # Validate SQL against dataset schema
        is_valid, val_err = sql_validator.validate(sql, schema=schema_info)
        if not is_valid:
            logger.warning(f"Generated SQL failed validation ({val_err}): {sql}")
            if fields:
                f0 = fields[0]
                sql = f"SELECT `{f0}`, COUNT(*) AS count FROM {primary_table} GROUP BY `{f0}` LIMIT 20;"
            else:
                sql = f"SELECT * FROM {primary_table} LIMIT 20;"

        # Execute query
        try:
            query_result = project_service.query_project_data(dataset_id, sql, db, limit=50)
        except Exception as q_err:
            logger.warning(f"Query execution failed for '{title}' ({q_err}). Trying fallback.")
            fallback_sql = f"SELECT * FROM {primary_table} LIMIT 20;"
            query_result = project_service.query_project_data(dataset_id, fallback_sql, db, limit=20)
            sql = fallback_sql

        # Save to database
        cat_final = spec.get("category", category).lower().replace(" ", "_")
        if cat_final not in ["single_variable", "bi_variable", "multi_variable"]:
            cat_final = category

        vis = SavedVisualization(
            dataset_id=dataset_id,
            category=cat_final,
            chart_type=spec.get("chart_type", chart_type),
            x_variable=spec.get("x_variable"),
            y_variable=spec.get("y_variable"),
            group_variable=spec.get("group_variable"),
            size_variable=spec.get("size_variable"),
            aggregation=spec.get("aggregation", "none"),
            title=spec.get("title", title),
            description=spec.get("description", desc),
            configuration={
                "sql": sql,
                "calculations": spec.get("calculations", "")
            }
        )
        db.add(vis)
        db.commit()
        db.refresh(vis)

        return {
            "visualization": vis.to_dict(),
            "chart_data": {
                "columns": query_result.get("columns", []),
                "rows": query_result.get("rows", []),
                "row_count": query_result.get("row_count", 0)
            }
        }

    async def stream_visualization_generation(
        self,
        dataset_id: str,
        db: Session,
        model: Optional[str] = None
    ):
        """
        Server-Sent Events (SSE) Generator for Progressive Two-Stage AI Visualization Generation:
        Stage 1: 3 parallel planners (single, bi, multi-variable).
        Combine & deduplicate -> 10-12 ideas.
        Stage 2: Progressive independent chart generation, SQL validation, execution, and immediate SSE streaming.
        """
        try:
            schema_info = self.get_dataset_multi_table_schema(dataset_id, db)
            # Clear existing visualizations for this dataset to replace cleanly
            db.query(SavedVisualization).filter(SavedVisualization.dataset_id == dataset_id).delete()
            db.commit()
        except Exception as init_err:
            logger.error(f"Failed to initialize visualization generation: {init_err}")
            yield f"data: {json.dumps({'type': 'visualization_error', 'error': str(init_err)})}\n\n"
            return

        # Heuristic fallback recs in case LLM planning fails
        project = db.query(DatasetSession).filter(DatasetSession.id == str(dataset_id)).first()
        fallback_recs = []
        if project:
            csv_path = project.processed_file_path or project.file_path
            df = dataset_service.read_csv_robust(csv_path) if csv_path and os.path.exists(csv_path) else pd.DataFrame()
            col_meta = project.column_metadata or {}
            fallback_recs = self.generate_recommendations(dataset_id, col_meta, df)

        yield f"data: {json.dumps({'type': 'generation_started', 'stage': 'planning'})}\n\n"

        # ── STAGE 1: Parallel Planning ──────────────────────────────────────────
        try:
            single_task = asyncio.create_task(self.generate_single_variable_plans(schema_info, model))
            bi_task = asyncio.create_task(self.generate_bi_variable_plans(schema_info, model))
            multi_task = asyncio.create_task(self.generate_multi_variable_plans(schema_info, model))

            # Run all 3 planners concurrently
            results = await asyncio.gather(single_task, bi_task, multi_task, return_exceptions=True)

            single_plans = results[0] if isinstance(results[0], list) else []
            bi_plans = results[1] if isinstance(results[1], list) else []
            multi_plans = results[2] if isinstance(results[2], list) else []

            yield f"data: {json.dumps({'type': 'stage1_progress', 'planner': 'single_variable', 'status': 'completed', 'count': len(single_plans)})}\n\n"
            yield f"data: {json.dumps({'type': 'stage1_progress', 'planner': 'bi_variable', 'status': 'completed', 'count': len(bi_plans)})}\n\n"
            yield f"data: {json.dumps({'type': 'stage1_progress', 'planner': 'multi_variable', 'status': 'completed', 'count': len(multi_plans)})}\n\n"

            final_plan = self.combine_visualization_plans(single_plans, bi_plans, multi_plans, fallback_recs)

            if not final_plan and fallback_recs:
                final_plan = fallback_recs[:10]

            yield f"data: {json.dumps({'type': 'stage1_completed', 'total_planned': len(final_plan), 'plan': final_plan})}\n\n"

        except Exception as e:
            logger.error(f"Stage 1 planning error: {e}", exc_info=True)
            final_plan = fallback_recs[:10]
            yield f"data: {json.dumps({'type': 'stage1_completed', 'total_planned': len(final_plan), 'plan': final_plan, 'warning': str(e)})}\n\n"

        # ── STAGE 2: Progressive Generation & Streaming ─────────────────────────
        total_items = len(final_plan)
        successful = 0
        failed = 0

        for idx, plan_item in enumerate(final_plan):
            title = plan_item.get("title", f"Chart #{idx + 1}")
            category = plan_item.get("category", "bi_variable")

            # Emit visualization_started
            yield f"data: {json.dumps({'type': 'visualization_started', 'index': idx, 'title': title, 'category': category})}\n\n"

            try:
                result = await self.generate_visualization_from_plan(
                    dataset_id=dataset_id,
                    plan_item=plan_item,
                    schema_info=schema_info,
                    db=db,
                    model=model
                )
                vis_dict = result["visualization"]
                chart_data = result["chart_data"]
                successful += 1

                yield f"data: {json.dumps({'type': 'visualization_completed', 'index': idx, 'title': title, 'visualization': vis_dict, 'chart_data': chart_data})}\n\n"

            except Exception as e:
                failed += 1
                logger.warning(f"Visualization #{idx + 1} '{title}' failed: {e}", exc_info=True)
                yield f"data: {json.dumps({'type': 'visualization_error', 'index': idx, 'title': title, 'error': str(e)})}\n\n"

        # Emit generation_completed
        yield f"data: {json.dumps({'type': 'generation_completed', 'total': total_items, 'successful': successful, 'failed': failed})}\n\n"

    async def generate_ai_important_visualizations(
        self,
        dataset_id: str,
        db: Session,
        model: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Synchronous batch wrapper around the two-stage progressive architecture.
        Used for non-streaming consumers and backward-compatibility.
        """
        saved_items = []
        async for raw_event in self.stream_visualization_generation(dataset_id, db, model):
            line = raw_event.strip()
            if line.startswith("data: "):
                try:
                    event = json.loads(line[6:])
                    if event.get("type") == "visualization_completed" and "visualization" in event:
                        saved_items.append(event["visualization"])
                except Exception:
                    pass
        return saved_items

    async def chat_with_data_and_visualization(
        self,
        dataset_id: str,
        user_message: str = "",
        user_prompt: Optional[str] = None,
        history: Optional[List[Dict[str, Any]]] = None,
        current_spec: Optional[Dict[str, Any]] = None,
        db: Session = None,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Conversational Data + Visualization Assistant.
        1. Analyzes user prompt + multi-table schema.
        2. Determines intent (data_answer vs visualization).
        3. Generates SQL query (single table or cross-sheet joins).
        4. Executes SQL against SQLite.
        5. For data questions: passes SQL data back to LLM to return plain English answer with insights.
        6. For visualizations: returns chart spec + data + explanation, with refinement support.
        """
        prompt_text = (user_prompt or user_message or "").strip()
        from backend.services.project_service import project_service
        schema_info = self.get_dataset_multi_table_schema(dataset_id, db)
        compact_schema = self._format_compact_schema(schema_info)

        history_context = ""
        if history:
            trimmed = []
            for m in history[-4:]:
                role = m.get("role", "user")
                c = (m.get("content") or "").strip()
                if role == "assistant" and len(c) > 200:
                    c = c[:200] + "..."
                elif role == "user" and len(c) > 250:
                    c = c[:250] + "..."
                trimmed.append(f"{role}: {c}")
            history_context = "\n".join(trimmed)

        current_spec_context = ""
        if current_spec and isinstance(current_spec, dict):
            filtered = {
                k: current_spec[k] for k in ["title", "chart_type", "x_variable", "y_variable", "group_variable", "aggregation", "sql"]
                if k in current_spec and current_spec[k] is not None
            }
            if filtered:
                current_spec_context = f"\nACTIVE / PREVIOUS CHART TO REFINE IF APPLICABLE:\n{json.dumps(filtered)}\n"

        prompt_stage1 = f"""You are PRAJNA's Senior Data & Visualization AI Assistant.
You have access to the complete dataset in an in-memory SQLite database across all uploaded sheets/tables.

AVAILABLE TABLES & MULTI-SHEET SCHEMA:
{compact_schema}
{current_spec_context}
CONVERSATION HISTORY:
{history_context}

USER MESSAGE:
"{prompt_text}"

YOUR TASK:
1. Determine whether the user's intent is a DATA QUESTION (needs a numeric, textual, or analytical answer) or a VISUALIZATION REQUEST (needs a chart/graph, or is modifying/refining an existing chart).
   - Examples of DATA QUESTIONS:
     * "What is the average downtime of each machine?"
     * "Which plant has the highest defect rate?"
     * "How many total units were produced in Q1?"
   - Examples of VISUALIZATION REQUESTS:
     * "Generate a chart showing monthly revenue."
     * "Show me the relationship between production quantity and downtime."
     * "Plot downtime by machine."
     * "Change this to a horizontal bar chart."
     * "Group it by plant."

2. Generate the precise SQLite SQL query to answer the question or produce the chart data.
   - For multi-sheet workbooks, query specific sheet table names: {schema_info.get('table_names', ['dataset'])} (e.g. `manufacturing_production`).
   - If tables share keys (e.g. `product_id`, `machine_id`), write standard SQLite JOIN syntax.
   - Use standard SQLite functions: SUM(), AVG(), COUNT(), MIN(), MAX(), ROUND().
   - Include GROUP BY, ORDER BY, and LIMIT (maximum 50 rows) where appropriate.

3. Select the best chart configuration if intent is "visualization".
   - chart_type: "Bar" | "Horizontal Bar" | "Line" | "Area" | "Pie" | "Donut" | "Scatter" | "Stacked Bar" | "Stacked Area" | "Treemap" | "Metric"

Output ONLY a JSON object with this exact structure:
{{
  "intent": "data_answer" | "visualization",
  "sql_query": "SELECT ...",
  "chart_type": "Bar",
  "category": "single_variable" | "bi_variable" | "multi_variable",
  "x_variable": "ColumnName",
  "y_variable": "MetricColumn",
  "group_variable": null,
  "size_variable": null,
  "aggregation": "sum" | "avg" | "count" | "none",
  "title": "Descriptive Chart Title",
  "explanation": "Brief description of the query and calculation."
}}"""

        try:
            resp_stage1 = await groq_client.get_chat_completion(
                messages=[
                    {"role": "system", "content": "You are a professional SQL and data visualization engineer. Return valid JSON only."},
                    {"role": "user", "content": prompt_stage1}
                ],
                model=model or settings.default_model,
                temperature=0.1,
                max_tokens=500,
                json_mode=True,
                task_name="Visualization AI Intent & SQL"
            )

            parsed_stage1 = {}
            try:
                parsed_stage1 = json.loads(resp_stage1)
            except Exception:
                json_match = re.search(r'\{.*\}', resp_stage1, re.DOTALL)
                if json_match:
                    parsed_stage1 = json.loads(json_match.group(0))
                else:
                    parsed_stage1 = {
                        "intent": "data_answer",
                        "sql_query": "SELECT * FROM dataset LIMIT 20;",
                        "explanation": "Querying dataset"
                    }

            intent_raw = parsed_stage1.get("intent") or parsed_stage1.get("request_type") or "data_answer"
            if "vis" in intent_raw.lower() or "chart" in intent_raw.lower():
                intent = "visualization"
            else:
                intent = "data_answer"

            sql_query = (parsed_stage1.get("sql_query") or parsed_stage1.get("sql") or "SELECT * FROM dataset LIMIT 20;").strip()
            tables_used = parsed_stage1.get("tables_used", [])

            # Execute SQL Query on SQLite
            query_result = {"columns": [], "rows": [], "row_count": 0}
            try:
                query_result = project_service.query_project_data(dataset_id, sql_query, db, limit=50)
            except Exception as sql_err:
                logger.warning(f"SQL execution failed ({sql_err}). Falling back to primary dataset table.")
                try:
                    fallback_sql = "SELECT * FROM dataset LIMIT 30;"
                    query_result = project_service.query_project_data(dataset_id, fallback_sql, db, limit=30)
                    sql_query = fallback_sql
                except Exception:
                    pass

            # Stage 2: Synthesis based on intent
            if intent == "data_answer":
                # Sample and compress rows for token efficiency
                sample_rows = []
                for r in query_result.get("rows", [])[:10]:
                    sample_rows.append({k: (str(v)[:60] if isinstance(v, str) and len(v) > 60 else v) for k, v in r.items()})

                # Synthesize clear executive natural-language answer
                prompt_stage2 = f"""You are PRAJNA's Executive Data Analyst.
The user asked: "{prompt_text}"
The SQLite database executed the query and returned the following result:
Columns: {query_result.get('columns')}
Rows: {json.dumps(sample_rows)}

INSTRUCTIONS:
1. Provide a direct, professional, natural-language answer to the user's question.
2. Highlight specific values, leaders, minimums, maximums, or averages found in the data.
3. Offer 1-2 useful analytical insights or strategic takeaways based on the results.
4. DO NOT show raw SQL queries or database code in your answer. Keep it executive and clean."""

                synthesized_text = await groq_client.get_chat_completion(
                    messages=[
                        {"role": "system", "content": "You are a helpful executive data analyst."},
                        {"role": "user", "content": prompt_stage2}
                    ],
                    model=model or settings.default_model,
                    temperature=0.2,
                    max_tokens=600,
                    json_mode=False,
                    task_name="Data Answer Synthesis"
                )

                return {
                    "type": "data",
                    "intent": "data_answer",
                    "answer": synthesized_text,
                    "insights": synthesized_text,
                    "data_preview": {
                        "columns": query_result.get("columns", []),
                        "rows": query_result.get("rows", []),
                        "row_count": query_result.get("row_count", 0)
                    },
                    "columns": query_result.get("columns", []),
                    "rows": query_result.get("rows", []),
                    "row_count": query_result.get("row_count", 0),
                    "sql": sql_query,
                    "tables_used": tables_used
                }

            else:
                # Visualization Request
                chart_type = parsed_stage1.get("chart_type", "Bar")
                title = parsed_stage1.get("title", f"Analysis: {prompt_text[:40]}")
                x_var = parsed_stage1.get("x_variable")
                y_var = parsed_stage1.get("y_variable")
                group_var = parsed_stage1.get("group_variable")
                size_var = parsed_stage1.get("size_variable")
                cat = parsed_stage1.get("category", "bi_variable")
                aggregation = parsed_stage1.get("aggregation", "none")
                explanation = parsed_stage1.get("explanation", f"Visualizing {y_var or ''} by {x_var or ''}.")

                # Generate brief analytical takeaway for the chart
                prompt_vis_explanation = f"""The user requested a visualization: "{prompt_text}".
Chart: {chart_type} titled '{title}'.
Data Sample: {json.dumps(query_result.get('rows', [])[:10])}
Write 1-2 concise sentences explaining what this chart reveals and the main insight. Do not show SQL."""

                try:
                    explanation_text = await groq_client.get_chat_completion(
                        messages=[
                            {"role": "system", "content": "You are a data visualization analyst."},
                            {"role": "user", "content": prompt_vis_explanation}
                        ],
                        model=model or settings.default_model,
                        temperature=0.2,
                        max_tokens=250,
                        json_mode=False,
                        task_name="Visualization Chart Explanation"
                    )
                except Exception:
                    explanation_text = explanation

                return {
                    "type": "visualization",
                    "intent": "visualization",
                    "answer": explanation_text,
                    "insights": explanation_text,
                    "sql": sql_query,
                    "tables_used": tables_used,
                    "chart": {
                        "title": title,
                        "chart_type": chart_type,
                        "category": cat,
                        "x_variable": x_var,
                        "y_variable": y_var,
                        "group_variable": group_var,
                        "size_variable": size_var,
                        "aggregation": aggregation,
                        "description": explanation_text,
                        "sql": sql_query,
                        "calculations": parsed_stage1.get("calculations", explanation),
                        "columns": query_result.get("columns", []),
                        "rows": query_result.get("rows", []),
                        "row_count": query_result.get("row_count", 0)
                    }
                }

        except Exception as e:
            logger.error(f"Error in chat_with_data_and_visualization: {e}", exc_info=True)
            return {
                "type": "data",
                "intent": "data_answer",
                "answer": f"I encountered an issue processing your request: {str(e)}. Please check your dataset columns or try rephrasing.",
                "insights": "",
                "data_preview": {"columns": [], "rows": [], "row_count": 0},
                "columns": [],
                "rows": [],
                "row_count": 0,
                "sql": "",
                "tables_used": []
            }

visualization_service = VisualizationService()
