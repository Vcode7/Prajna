from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import json
import logging
import asyncio

from backend.database.session import get_db, get_history_db
from backend.models.history import QueryHistory
from backend.schemas.query import (
    GenerateSQLRequest, ExecuteSQLRequest, RepairSQLRequest,
    ChartRequest, InsightsRequest, WidgetInsightsRequest,
    HistorySaveRequest, HistoryUpdateRequest, DashboardRequest
)
from backend.services.schema_service import schema_service
from backend.services.sql_generator import sql_generator_service
from backend.services.query_planner import query_planner
from backend.services.sql_validator import sql_validator
from backend.services.sql_executor import sql_executor, SQLExecutionError
from backend.services.chart_service import chart_service
from backend.services.insight_service import insight_service
from backend.llm.client import groq_client
from backend.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/schema")
def get_db_schema():
    """Returns database schema explorer metadata including table stats and sample rows."""
    try:
        return schema_service.get_database_explorer_metadata()
    except Exception as e:
        logger.error(f"Error fetching schema: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-sql")
async def generate_sql_endpoint(req: GenerateSQLRequest, db: Session = Depends(get_history_db)):
    """Plans and runs query analytics, outputting single-query results or multi-query dashboards."""
    groq_client.reset_circuit_breaker()
    try:
        # 1. Fetch previous session messages to build memory history
        history_entries = db.query(QueryHistory).filter(
            QueryHistory.conversation_id == req.conversation_id
        ).order_by(QueryHistory.timestamp.asc()).all()
        
        history_context_list = []
        for h in history_entries[-3:]:  # Keep context small for speed
            history_context_list.append(f"User: {h.prompt}")
            if h.generated_sql.startswith("["):
                history_context_list.append("SQL: [Multi-Query Dashboard Plan]")
            else:
                history_context_list.append(f"SQL: {h.generated_sql}")
            
        history_context = "\n".join(history_context_list)
        
        # 2. Run SQL Generation pipeline (which triggers planner)
        result = await sql_generator_service.generate_sql(
            user_question=req.prompt,
            conversation_history=history_context,
            model=req.model,
            use_ai_charts=req.use_ai_charts
        )
        
        if not result.get("success", False):
            raise HTTPException(status_code=400, detail=result.get("error"))
            
        # 3. Automatically save to history
        is_multi = result.get("is_multi", False)
        mode = result.get("mode", "generator")

        if mode == "response":
            saved_sql = "[Conversational Response]"
            saved_chart_config = None
            execution_time = 0
            rows_count = 0
        else:
            saved_sql = json.dumps([w["sql"] for w in result["widgets"]]) if is_multi else result.get("sql")
            saved_chart_config = json.dumps(result["widgets"]) if is_multi else json.dumps(result.get("chart"))
            execution_time = sum([w["data"]["execution_time_ms"] for w in result["widgets"]]) if is_multi else result.get("data", {}).get("execution_time_ms", 0)
            rows_count = sum([w["data"]["row_count"] for w in result["widgets"]]) if is_multi else result.get("data", {}).get("row_count", 0)
        
        db_history = QueryHistory(
            conversation_id=req.conversation_id,
            prompt=req.prompt,
            generated_sql=saved_sql,
            execution_time_ms=execution_time,
            rows_count=rows_count,
            chart_type="Dashboard" if is_multi else result.get("chart", {}).get("chart_type"),
            chart_config=saved_chart_config,
            insights=result.get("insights"),
            database_name="enterprise_erp.db",
            model_used=req.model or "openai/gpt-oss-120b"
        )
        
        db.add(db_history)
        db.commit()
        db.refresh(db_history)
        
        return {
            "history_id": db_history.id,
            "is_multi": is_multi,
            "executive_title": result.get("executive_title"),
            "reasoning": result.get("reasoning"),
            "sql": result.get("sql"),
            "explanation": result.get("explanation"),
            "data": result.get("data"),
            "chart": result.get("chart"),
            "insights": result.get("insights"),
            "widgets": result.get("widgets")
        }
        
    except Exception as e:
        logger.error(f"Error in generate-sql endpoint: {e}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-sql-stream")
async def generate_sql_stream_endpoint(req: GenerateSQLRequest, db: Session = Depends(get_history_db)):
    """
    Streams query execution steps and widget progress sequentially using Server-Sent Events (SSE).
    """
    groq_client.reset_circuit_breaker()

    async def event_generator():
        try:
            # 1. Fetch conversation history
            history_entries = db.query(QueryHistory).filter(
                QueryHistory.conversation_id == req.conversation_id
            ).order_by(QueryHistory.timestamp.asc()).all()
            
            history_context_list = []
            for h in history_entries[-3:]:
                history_context_list.append(f"User: {h.prompt}")
                if h.generated_sql.startswith("["):
                    history_context_list.append("SQL: [Multi-Query Dashboard Plan]")
                else:
                    history_context_list.append(f"SQL: {h.generated_sql}")
            history_context = "\n".join(history_context_list)

            # 2. Plan intent
            plan_res = await query_planner.generate_plan(req.prompt, model=req.model)
            mode = plan_res.get("mode", "generator")

            if mode == "response":
                response_text = plan_res.get(
                    "response_text",
                    "This application is designed specifically for database analytics, SQL generation, visualization, reporting, and business intelligence."
                )
                logger.info("Stream pipeline skipping analytics execution for 'response' mode query.")

                db_history = QueryHistory(
                    conversation_id=req.conversation_id,
                    prompt=req.prompt,
                    generated_sql="[Conversational Response]",
                    execution_time_ms=0,
                    rows_count=0,
                    chart_type="Text",
                    chart_config=None,
                    insights=response_text,
                    database_name="enterprise_erp.db",
                    model_used=req.model or "openai/gpt-oss-120b"
                )
                db.add(db_history)
                db.commit()
                db.refresh(db_history)

                yield f"data: {json.dumps({'type': 'response', 'mode': 'response', 'response_text': response_text, 'insights': response_text, 'widgets': []})}\n\n"
                yield f"data: {json.dumps({'type': 'complete', 'history_id': db_history.id, 'is_multi': False, 'mode': 'response', 'executive_title': 'Assistant Response', 'insights': response_text, 'widgets': []})}\n\n"
                return

            is_multi = plan_res.get("is_multi_query", False)
            executive_title = plan_res.get("executive_title", "Business Analytics Dashboard")
            analyses = plan_res.get("plan", [])

            if not is_multi or len(analyses) <= 1:
                single_item = analyses[0] if analyses else {
                    "id": "query_1",
                    "title": "Business Query",
                    "sql_instructions": req.prompt
                }
                analyses = [single_item]
                is_multi = False

            initial_widgets = [
                {
                    "id": item.get("id", f"widget_{idx+1}"),
                    "title": item.get("title", f"Widget {idx+1}"),
                    "status": "queued",
                    "step_label": "Queued / Waiting"
                }
                for idx, item in enumerate(analyses)
            ]

            # Emit initial plan event
            yield f"data: {json.dumps({'type': 'plan', 'is_multi': is_multi, 'executive_title': executive_title, 'widgets': initial_widgets})}\n\n"

            successful_widgets = []

            # 3. Process widgets SEQUENTIALLY
            for idx, item in enumerate(analyses):
                w_id = item.get("id", f"widget_{idx+1}")
                w_title = item.get("title", f"Widget {idx+1}")
                sql_instructions = item.get("sql_instructions", req.prompt)

                event_queue = asyncio.Queue()

                async def progress_cb(step: str, step_label: str):
                    await event_queue.put({"type": "widget_progress", "widget_id": w_id, "step": step, "step_label": step_label})

                task = asyncio.create_task(
                    sql_generator_service.generate_sql_for_widget(
                        widget_id=w_id,
                        title=w_title,
                        sql_instructions=sql_instructions,
                        original_prompt=req.prompt,
                        model=req.model,
                        progress_callback=progress_cb,
                        use_ai_charts=req.use_ai_charts if req.use_ai_charts is not None else False
                    )
                )

                while not task.done() or not event_queue.empty():
                    while not event_queue.empty():
                        progress_evt = await event_queue.get()
                        yield f"data: {json.dumps(progress_evt)}\n\n"
                    if not task.done():
                        await asyncio.sleep(0.05)

                widget_res = await task

                if widget_res.get("success", False) and widget_res.get("has_data", True) and widget_res.get("data", {}).get("row_count", 0) > 0:
                    successful_widgets.append(widget_res)
                    yield f"data: {json.dumps({'type': 'widget_completed', 'widget_id': w_id, 'widget': widget_res})}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'widget_skipped', 'widget_id': w_id, 'reason': 'No data or failure'})}\n\n"

            if not successful_widgets:
                yield f"data: {json.dumps({'type': 'error', 'message': 'No valid data found for the requested analysis.'})}\n\n"
                return

            # 4. Generate Executive Summary ONLY after all widgets complete
            exec_summary = ""
            if len(successful_widgets) > 0:
                yield f"data: {json.dumps({'type': 'summary_progress', 'step_label': 'Generating Executive Summary...'})}\n\n"
                exec_summary = await sql_generator_service.generate_executive_summary(
                    user_question=req.prompt,
                    widgets=successful_widgets,
                    model=req.model
                )
                yield f"data: {json.dumps({'type': 'executive_summary', 'insights': exec_summary})}\n\n"

            # 5. Save to Query History
            saved_sql = json.dumps([w["sql"] for w in successful_widgets]) if is_multi else successful_widgets[0].get("sql")
            saved_chart_config = json.dumps(successful_widgets) if is_multi else json.dumps(successful_widgets[0].get("chart"))
            execution_time = sum([w["data"]["execution_time_ms"] for w in successful_widgets]) if is_multi else successful_widgets[0]["data"]["execution_time_ms"]
            rows_count = sum([w["data"]["row_count"] for w in successful_widgets]) if is_multi else successful_widgets[0]["data"]["row_count"]

            db_history = QueryHistory(
                conversation_id=req.conversation_id,
                prompt=req.prompt,
                generated_sql=saved_sql,
                execution_time_ms=execution_time,
                rows_count=rows_count,
                chart_type="Dashboard" if is_multi else successful_widgets[0].get("chart", {}).get("chart_type"),
                chart_config=saved_chart_config,
                insights=exec_summary,
                database_name="enterprise_erp.db",
                model_used=req.model or "openai/gpt-oss-120b"
            )
            db.add(db_history)
            db.commit()
            db.refresh(db_history)

            yield f"data: {json.dumps({'type': 'complete', 'history_id': db_history.id, 'is_multi': is_multi, 'executive_title': executive_title, 'insights': exec_summary, 'widgets': successful_widgets})}\n\n"

        except Exception as e:
            logger.error(f"Error in generate-sql-stream endpoint: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/execute")
async def execute_sql_endpoint(req: ExecuteSQLRequest, db: Session = Depends(get_history_db)):
    """Safely executes edited SQL and rebuilds chart + insights."""
    is_valid, validation_msg = sql_validator.validate(req.sql)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"SQL Validation Error: {validation_msg}")
        
    try:
        execution_result = sql_executor.execute(req.sql)
        
        chart_config = await chart_service.generate_chart_config(
            user_question=req.prompt,
            columns=execution_result["columns"],
            rows=execution_result["rows"]
        )
        
        return {
            "sql": req.sql,
            "data": execution_result,
            "chart": chart_config,
            "insights": None
        }
        
    except SQLExecutionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in execute endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/dashboard-filter")
async def apply_dashboard_filters(payload: Dict[str, Any]):
    """
    Applies global dashboard filters to multiple active widgets in parallel.
    Rewrites widget SQL queries, executes them, and returns updated data.
    """
    groq_client.reset_circuit_breaker()
    raw_filters = payload.get("filters", {})
    widgets = payload.get("widgets", [])
    model = payload.get("model")
    
    # Filter out empty string or null values
    active_filters = {k: v for k, v in raw_filters.items() if v is not None and str(v).strip() != ""}
    
    if not active_filters or not widgets:
        return {"widgets": widgets}
        
    logger.info(f"Applying active global filters to {len(widgets)} widgets: {active_filters}")
    
    async def filter_single_widget(w: Dict[str, Any]) -> Dict[str, Any]:
        original_sql = w.get("sql", "")
        widget_title = w.get("title", "Widget")
        
        if not original_sql:
            return w
            
        # Formulate SQL rewrite prompt
        prompt = f"""You are a SQLite specialist. Rewrite the following SQL query to incorporate the selected global dashboard filters.

ORIGINAL SQL:
```sql
{original_sql}
```

ACTIVE GLOBAL FILTERS:
{json.dumps(active_filters)}

INSTRUCTIONS:
1. Append or inject the filters as WHERE constraints in the SQL.
2. Map filters to appropriate columns (e.g. region filter -> regions.name or customers.state; date range filters -> order_date, movement_date, downtime_date, or expense_date; category filter -> categories.name or products.category_id).
3. If a filter does not apply to any table in this query, ignore it.
4. Ensure the query remains a read-only SELECT statement.
5. Return ONLY the rewritten SQL query. Do NOT wrap in markdown block quotes.
"""
        messages = [
            {"role": "system", "content": "You are a database query formatter. Return raw SQL query only."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            rewritten_sql = await groq_client.get_chat_completion(
                messages=messages,
                model=model,
                temperature=0.0,
                max_tokens=settings.sql_generation_max_tokens,
                json_mode=False,
                task_name="SQL Filter Rewrite"
            )
            rewritten_sql = rewritten_sql.strip().strip("`").strip()
            if rewritten_sql.startswith("sql"):
                rewritten_sql = rewritten_sql[3:].strip()
                
            # Validate rewritten SQL
            is_valid, val_err = sql_validator.validate(rewritten_sql)
            if not is_valid:
                logger.warning(f"Filtered SQL failed validation: {val_err}. Falling back to original.")
                return w
                
            # Execute
            execution_res = sql_executor.execute(rewritten_sql)
            
            # Re-generate chart
            chart_config = await chart_service.generate_chart_config(
                user_question=widget_title,
                columns=execution_res["columns"],
                rows=execution_res["rows"],
                model=model
            )
            
            return {
                **w,
                "sql": rewritten_sql,
                "data": execution_res,
                "chart": chart_config
            }
            
        except Exception as e:
            logger.error(f"Failed to apply filters to widget '{widget_title}': {e}")
            return w
            
    # Process all widgets in parallel
    tasks = [filter_single_widget(w) for w in widgets]
    updated_widgets = await asyncio.gather(*tasks)
    
    return {
        "widgets": updated_widgets
    }

@router.post("/repair")
async def repair_sql_endpoint(req: RepairSQLRequest):
    """Debugs and repairs a failing SQL statement."""
    schema_context = schema_service.get_schema()
    schema_text = ""
    for tbl, info in schema_context["tables"].items():
        schema_text += f"Table: {tbl}, Columns: {list(info['columns'].keys())}\n"
        
    try:
        result = await sql_generator_service.repair_sql_loop(
            user_question="Repair Query",
            failing_sql=req.sql,
            error_message=req.error,
            schema_context=schema_text
        )
        return result
    except Exception as e:
        logger.error(f"Error in repair endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chart")
async def chart_endpoint(req: ChartRequest):
    """Triggers standard ECharts chart mapping configuration."""
    try:
        return await chart_service.generate_chart_config(
            user_question=req.prompt,
            columns=req.columns,
            rows=req.rows,
            model=req.model
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/insights")
async def insights_endpoint(req: InsightsRequest):
    """Triggers LLM insight analysis for custom outputs."""
    try:
        return await insight_service.generate_insights(
            user_question=req.prompt,
            sql=req.sql,
            columns=req.columns,
            rows=req.rows,
            model=req.model
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/widget-insights")
async def widget_insights_endpoint(req: WidgetInsightsRequest):
    """
    Generates AI insights on-demand for a single widget.
    Called only when the user explicitly requests insights from the UI.
    Accepts minimal context: widget_id, user_query, sql, columns, a data sample, and total row_count.
    """
    try:
        logger.info(f"On-demand insights requested for widget '{req.widget_id}'")
        insights = await insight_service.generate_insights(
            user_question=req.user_query,
            sql=req.sql,
            columns=req.columns,
            rows=req.rows,
            row_count=req.row_count,
            model=req.model
        )
        return {"widget_id": req.widget_id, "insights": insights}
    except Exception as e:
        logger.error(f"Error generating on-demand insights for widget '{req.widget_id}': {e}")
        raise HTTPException(status_code=500, detail=str(e))

# History routes
@router.get("/history")
def get_history(db: Session = Depends(get_history_db)):
    """Lists all past chat executions."""
    try:
        entries = db.query(QueryHistory).order_by(
            QueryHistory.is_pinned.desc(), 
            QueryHistory.timestamp.desc()
        ).all()
        return [e.to_dict() for e in entries]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/history")
def save_history(req: HistorySaveRequest, db: Session = Depends(get_history_db)):
    """Saves a query log record manually."""
    try:
        db_history = QueryHistory(
            conversation_id=req.conversation_id,
            prompt=req.prompt,
            generated_sql=req.generated_sql,
            execution_time_ms=req.execution_time_ms,
            rows_count=req.rows_count,
            chart_type=req.chart_type,
            chart_config=json.dumps(req.chart_config) if req.chart_config else None,
            insights=req.insights,
            database_name=req.database_name,
            model_used=req.model_used
        )
        db.add(db_history)
        db.commit()
        db.refresh(db_history)
        return db_history.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/history/{id}")
def update_history(id: int, req: HistoryUpdateRequest, db: Session = Depends(get_history_db)):
    """Updates pinning, favorites, or session name of a history log."""
    entry = db.query(QueryHistory).filter(QueryHistory.id == id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="History log not found")
        
    if req.is_favorite is not None:
        entry.is_favorite = req.is_favorite
    if req.is_pinned is not None:
        entry.is_pinned = req.is_pinned
    if req.session_name is not None:
        entry.session_name = req.session_name
        # Update name across all items of this conversation
        db.query(QueryHistory).filter(
            QueryHistory.conversation_id == entry.conversation_id
        ).update({"session_name": req.session_name})
        
    db.commit()
    db.refresh(entry)
    return entry.to_dict()

@router.delete("/history/{id}")
def delete_history(id: int, db: Session = Depends(get_history_db)):
    """Deletes history record."""
    entry = db.query(QueryHistory).filter(QueryHistory.id == id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="History log not found")
    db.delete(entry)
    db.commit()
    return {"message": "History deleted successfully"}

# Settings routes
@router.get("/settings")
def get_backend_settings():
    """Returns current backend settings and task-specific max token limits."""
    return {
        "default_model": settings.default_model,
        "temperature": settings.temperature,
        "max_tokens": settings.max_tokens,
        "use_ai_charts": settings.use_ai_charts,
        "query_planner_max_tokens": settings.query_planner_max_tokens,
        "sql_generation_max_tokens": settings.sql_generation_max_tokens,
        "sql_repair_max_tokens": settings.sql_repair_max_tokens,
        "zero_row_repair_max_tokens": settings.zero_row_repair_max_tokens,
        "executive_summary_max_tokens": settings.executive_summary_max_tokens,
        "widget_insight_max_tokens": settings.widget_insight_max_tokens,
        "chart_generation_max_tokens": settings.chart_generation_max_tokens,
        "chat_max_tokens": settings.chat_max_tokens
    }

@router.post("/settings")
def update_backend_settings(payload: Dict[str, Any]):
    """Updates backend settings dynamically at runtime."""
    valid_token_keys = {
        "query_planner_max_tokens", "sql_generation_max_tokens", "sql_repair_max_tokens",
        "zero_row_repair_max_tokens", "executive_summary_max_tokens", "widget_insight_max_tokens",
        "chart_generation_max_tokens", "chat_max_tokens", "max_tokens"
    }
    for key, val in payload.items():
        if hasattr(settings, key) and val is not None:
            if key in valid_token_keys:
                try:
                    val_int = int(val)
                    if 1 <= val_int <= 16384:
                        setattr(settings, key, val_int)
                except (ValueError, TypeError):
                    pass
            elif key == "temperature":
                try:
                    setattr(settings, key, float(val))
                except (ValueError, TypeError):
                    pass
            elif key == "use_ai_charts":
                setattr(settings, key, bool(val))
            elif key == "default_model" and isinstance(val, str):
                setattr(settings, key, val)

    return get_backend_settings()
