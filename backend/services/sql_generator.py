import json
import asyncio
from typing import Dict, Any, List, Optional
from backend.llm.client import groq_client
from backend.config import settings
from backend.prompts.templates import get_sql_generation_prompt, get_sql_repair_prompt, get_insight_generation_prompt
from backend.services.context_builder import context_builder
from backend.services.sql_validator import sql_validator
from backend.services.sql_executor import sql_executor, SQLExecutionError
from backend.services.chart_service import chart_service
from backend.services.insight_service import insight_service
from backend.services.query_planner import query_planner
import logging

logger = logging.getLogger(__name__)

class SQLGeneratorService:
    async def regenerate_sql_for_empty_data(
        self,
        title: str,
        sql_instructions: str,
        original_prompt: str,
        empty_sql: str,
        schema_context: str,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Re-runs SQL generation specifically for a widget that produced 0 rows (no data).
        """
        logger.info(f"Regenerating SQL for widget '{title}' because initial query returned 0 rows: {empty_sql}")
        
        prompt = f"""You are a professional SQLite database specialist.
The initial SQL query generated for analysis goal '{title}' executed without syntax errors, but returned 0 rows (empty dataset):

INITIAL QUERY (RETURNED 0 ROWS):
```sql
{empty_sql}
```

ANALYSIS GOAL:
{title}
Instructions: {sql_instructions}
General Request Context: {original_prompt}

DATABASE SCHEMA CONTEXT:
{schema_context}

INSTRUCTIONS:
1. Identify why the previous query returned 0 rows (e.g. overly restrictive WHERE clause, incorrect JOIN keys, exact string matching issues, or non-existent date range bounds).
2. Rewrite the SQLite query so that it retrieves valid, non-empty data matching the user's intent.
3. Ensure the query remains a valid read-only SELECT statement.
4. Return ONLY JSON in the format:
{{
  "reasoning": "Reasoning for revising the query to get data",
  "sql": "SELECT ...",
  "explanation": "Brief explanation of the revised query"
}}
"""
        messages = [
            {"role": "system", "content": "You are a professional SQLite developer. Return JSON."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response_text = await groq_client.get_chat_completion(
                messages=messages,
                model=model,
                temperature=0.0,
                max_tokens=settings.zero_row_repair_max_tokens,
                json_mode=True,
                task_name="Zero-Row SQL Repair"
            )
            response_json = json.loads(response_text)
            reasoning = response_json.get("reasoning", "")
            revised_sql = response_json.get("sql", "").strip()
            explanation = response_json.get("explanation", "")
            
            is_valid, validation_msg = sql_validator.validate(revised_sql)
            if not is_valid:
                logger.warning(f"Regenerated SQL for widget '{title}' failed validation: {validation_msg}")
                return {"success": False, "has_data": False}
                
            execution_result = sql_executor.execute(revised_sql)
            if execution_result["row_count"] == 0 or len(execution_result["rows"]) == 0:
                logger.warning(f"Regenerated SQL for widget '{title}' still returned 0 rows.")
                return {"success": False, "has_data": False}
                
            chart_config = await chart_service.generate_chart_config(
                user_question=title,
                columns=execution_result["columns"],
                rows=execution_result["rows"],
                model=model,
                use_ai_charts=self._use_ai_charts
            )
            # Insights are NOT generated here — they are on-demand only.
            return {
                "success": True,
                "has_data": True,
                "sql": revised_sql,
                "reasoning": reasoning,
                "explanation": explanation,
                "data": execution_result,
                "chart": chart_config,
                "insights": None
            }
        except Exception as e:
            logger.error(f"Error during SQL regeneration for widget '{title}': {e}")
            return {"success": False, "has_data": False}

    async def generate_sql_for_widget(
        self,
        widget_id: str,
        title: str,
        sql_instructions: str,
        original_prompt: str,
        model: Optional[str] = None,
        progress_callback: Optional[Any] = None,
        use_ai_charts: bool = False
    ) -> Dict[str, Any]:
        """
        Executes SQL generation, validation, SQL execution, and Chart generation for a single widget.
        Insight generation has been removed from this pipeline — insights are generated on-demand
        only when the user explicitly requests them from the frontend Insights tab.
        Processes steps sequentially and invokes progress_callback if provided.
        """
        # Store use_ai_charts flag on instance for downstream calls within this widget's scope
        self._use_ai_charts = use_ai_charts
        logger.info(f"Generating widget '{title}' sequentially using instructions: {sql_instructions}")
        
        # Step 1: Generating SQL
        if progress_callback:
            await progress_callback("generating_sql", "Generating SQL...")

        # 1. Build optimized database context schema for this widget
        schema_context = context_builder.build_schema_context(sql_instructions)
        
        # 2. Formulate prompt specifically for this analysis item
        prompt = get_sql_generation_prompt(
            schema_context=schema_context,
            user_question=f"Analysis goal: {title}. Instructions: {sql_instructions}. General prompt context: {original_prompt}",
            conversation_history=""
        )
        
        messages = [
            {"role": "system", "content": "You are a professional SQLite developer. Return JSON."},
            {"role": "user", "content": prompt}
        ]
        
        # 3. Call LLM
        response_text = await groq_client.get_chat_completion(
            messages=messages,
            model=model,
            temperature=0.0,
            max_tokens=settings.sql_generation_max_tokens,
            json_mode=True,
            task_name="SQL Generation"
        )
        
        # 4. Parse response JSON
        try:
            response_json = json.loads(response_text)
            reasoning = response_json.get("reasoning", "")
            sql = response_json.get("sql", "").strip()
            explanation = response_json.get("explanation", "")
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response JSON for widget {title}: {response_text}")
            return await self.repair_sql_loop(title, response_text, f"JSON parse error: {str(e)}", schema_context, model=model)

        # 5. Validate SQL
        is_valid, validation_msg = sql_validator.validate(sql)
        if not is_valid:
            logger.warning(f"Initial SQL validation failed for widget {title}: {validation_msg}")
            return await self.repair_sql_loop(title, sql, f"SQL Validation Error: {validation_msg}", schema_context, model=model)
            
        # Step 2: Executing SQL
        if progress_callback:
            await progress_callback("executing_sql", "Executing SQL...")

        # 6. Execute SQL
        try:
            execution_result = sql_executor.execute(sql)

            # ── Zero-Row Regeneration Guard ───────────────────────────────────
            # Regeneration ONLY triggers when:
            #   - SQL executed successfully (no SQLExecutionError was raised), AND
            #   - The execution returned 0 rows (filter/logic issue, not a syntax/schema error).
            # SQL execution failures (syntax, unknown table, bad join) are handled
            # exclusively by repair_sql_loop in the SQLExecutionError except branch below.
            # Do NOT add any regeneration logic inside the except branch.
            if execution_result["row_count"] == 0 or len(execution_result["rows"]) == 0:
                logger.warning(f"Initial SQL for widget '{title}' returned 0 rows. Automatically regenerating query...")
                if progress_callback:
                    await progress_callback("regenerating_sql", "Regenerating SQL (0 rows)...")

                regen_res = await self.regenerate_sql_for_empty_data(
                    title=title,
                    sql_instructions=sql_instructions,
                    original_prompt=original_prompt,
                    empty_sql=sql,
                    schema_context=schema_context,
                    model=model
                )
                if regen_res.get("success", False) and regen_res.get("has_data", False):
                    return {
                        "id": widget_id,
                        "title": title,
                        **regen_res
                    }
                else:
                    logger.info(f"Regenerated query for widget '{title}' still returned 0 rows. Silently skipping widget.")
                    return {
                        "id": widget_id,
                        "title": title,
                        "success": False,
                        "has_data": False,
                        "error": "Query returned no data after regeneration."
                    }

            # Step 3: Generating Chart
            if progress_callback:
                await progress_callback("generating_chart", "Generating Chart...")

            # 7. Generate chart config (heuristic or LLM based on use_ai_charts flag)
            chart_config = await chart_service.generate_chart_config(
                user_question=title,
                columns=execution_result["columns"],
                rows=execution_result["rows"],
                model=model,
                use_ai_charts=use_ai_charts
            )
            # NOTE: Insights are NOT generated here.
            # They are generated on-demand via POST /api/widget-insights.
            return {
                "id": widget_id,
                "title": title,
                "success": True,
                "has_data": True,
                "sql": sql,
                "reasoning": reasoning,
                "explanation": explanation,
                "data": execution_result,
                "chart": chart_config,
                "insights": None
            }
        except SQLExecutionError as e:
            logger.warning(f"Initial SQL execution failed for widget {title}: {str(e)}")
            return await self.repair_sql_loop(title, sql, f"SQL Execution Error: {str(e)}", schema_context, model=model)

    async def generate_sql(
        self,
        user_question: str,
        conversation_history: str = "",
        model: Optional[str] = None,
        use_ai_charts: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Main Entrypoint: Plans, runs, and assembles either single queries or multi-query dashboards.
        Executes widgets sequentially.
        """
        # 1. Analyze prompt intent and generate Query Execution Plan
        plan_res = await query_planner.generate_plan(user_question, model=model)
        mode = plan_res.get("mode", "generator")

        if mode == "response":
            response_text = plan_res.get(
                "response_text",
                "This application is designed specifically for database analytics, SQL generation, visualization, reporting, and business intelligence."
            )
            logger.info("Query planner returned 'response' mode — skipping analytics execution pipeline.")
            return {
                "success": True,
                "mode": "response",
                "is_multi": False,
                "executive_title": "Assistant Response",
                "insights": response_text,
                "widgets": []
            }

        # Resolve use_ai_charts: per-request override > global config default
        resolved_use_ai_charts = use_ai_charts if use_ai_charts is not None else settings.use_ai_charts
        logger.info(f"Chart generation mode: {'AI (LLM)' if resolved_use_ai_charts else 'Heuristic (with LLM fallback)'}")

        is_multi = plan_res.get("is_multi_query", False)
        executive_title = plan_res.get("executive_title", "Business Analytics Dashboard")
        analyses = plan_res.get("plan", [])
        
        if not is_multi or len(analyses) <= 1:
            # Single query pipeline
            logger.info("Executing single query plan...")
            single_item = analyses[0] if analyses else {
                "id": "query_1",
                "title": "Business Query",
                "sql_instructions": user_question
            }
            
            widget_res = await self.generate_sql_for_widget(
                widget_id=single_item.get("id", "query_1"),
                title=single_item.get("title", "Business Query"),
                sql_instructions=single_item.get("sql_instructions", user_question),
                original_prompt=user_question,
                model=model,
                use_ai_charts=resolved_use_ai_charts
            )
            
            if not widget_res.get("success", False) or widget_res.get("data", {}).get("row_count", 0) == 0:
                return {
                    "success": False,
                    "error": widget_res.get("error") or "No valid data found for the requested query."
                }
                
            exec_summary = await self.generate_executive_summary(
                user_question=user_question,
                widgets=[widget_res],
                model=model
            )

            return {
                "success": True,
                "is_multi": False,
                "executive_title": executive_title,
                "reasoning": widget_res.get("reasoning"),
                "sql": widget_res.get("sql"),
                "explanation": widget_res.get("explanation"),
                "data": widget_res.get("data"),
                "chart": widget_res.get("chart"),
                "insights": exec_summary,
                "widgets": [widget_res] # Pack single item as list for frontend layout reuse
            }
            
        # Multi-query pipeline (SEQUENTIAL processing)
        logger.info(f"Executing multi-query plan: processing {len(analyses)} queries sequentially...")
        
        completed_widgets = []
        for idx, item in enumerate(analyses):
            widget_res = await self.generate_sql_for_widget(
                widget_id=item.get("id", f"widget_{idx+1}"),
                title=item.get("title", f"Widget {idx+1}"),
                sql_instructions=item.get("sql_instructions", ""),
                original_prompt=user_question,
                model=model,
                use_ai_charts=resolved_use_ai_charts
            )
            completed_widgets.append(widget_res)
        
        # Filter successful queries that returned valid non-empty data
        successful_widgets = [
            w for w in completed_widgets 
            if w.get("success", False) and w.get("has_data", True) and w.get("data", {}).get("row_count", 0) > 0
        ]
        
        if not successful_widgets:
            return {
                "success": False,
                "error": "No valid data found for the requested analysis."
            }
            
        # Generate final high-level Executive Summary report summarizing only widgets with valid data
        exec_summary = await self.generate_executive_summary(
            user_question=user_question,
            widgets=successful_widgets,
            model=model
        )
        
        return {
            "success": True,
            "is_multi": True,
            "executive_title": executive_title,
            "insights": exec_summary,
            "widgets": successful_widgets
        }

    async def generate_executive_summary(
        self,
        user_question: str,
        widgets: List[Dict[str, Any]],
        model: Optional[str] = None
    ) -> str:
        """
        Generates a high-level executive report comparing outcomes across widgets.

        Optimization: Uses only condensed semantic widget context (title, insight text,
        row count, and computed key metrics). Raw SQL strings and data sample rows are
        intentionally excluded to minimize prompt size (~60-80% reduction per widget).
        """
        logger.info("Generating global executive summary...")

        widget_summaries = []
        for w in widgets:
            w_title = w.get("title", "Widget Analysis")
            data = w.get("data", {})
            rows = data.get("rows", []) if isinstance(data, dict) else []
            columns = data.get("columns", []) if isinstance(data, dict) else []
            row_count = data.get("row_count", 0) if isinstance(data, dict) else 0
            widget_insight = w.get("insights", "")

            # Compute key metrics per numeric column from available rows (no raw rows in prompt)
            key_metrics = self._compute_key_metrics(columns, rows)

            summary_block = f"""- **Widget: {w_title}**
  - Total Rows: {row_count}
  - Key Metrics: {key_metrics or 'N/A'}
  - Analysis: {widget_insight[:600] if widget_insight else 'No insight generated.'}
"""
            widget_summaries.append(summary_block)

        prompt = f"""You are an elite Chief Financial Officer & Senior Data Analyst. Write a high-level executive summary summarizing the analytics dashboard in response to the user's request.

USER REQUEST:
"{user_question}"

DASHBOARD WIDGETS (condensed):
{"".join(widget_summaries)}

INSTRUCTIONS:
1. Format your response in clean, well-structured Markdown.
2. Use Markdown headings (`## Executive Summary`, `### Cross-Module Analysis`, `### Key Strategic Insights`, `### Recommended Action Items`).
3. Use bullet lists (`- `) and numbered lists (`1. `) for structured findings.
4. Use **bold text** to highlight key numbers, financial totals, percentages, and metrics.
5. Use Markdown blockquotes (`> Key Observation: ...`) for critical takeaways or risks.
6. Use Markdown tables (`| Metric | Details | Status |`) when comparing or breaking down multiple widget metrics.
7. Suggest 3 follow-up business questions.

Make it look like a premium, highly professional BI executive report.
"""
        messages = [
            {"role": "system", "content": "You are a professional business consultant."},
            {"role": "user", "content": prompt}
        ]

        try:
            summary = await groq_client.get_chat_completion(
                messages=messages,
                model=model,
                temperature=0.3,
                max_tokens=settings.executive_summary_max_tokens,
                json_mode=False,
                task_name="Executive Summary"
            )
            return summary
        except Exception as e:
            logger.error(f"Failed to generate executive summary: {e}")
            return "Executive analysis generated successfully. Click individual widgets below for details."

    def _compute_key_metrics(self, columns: List[str], rows: List[Dict[str, Any]]) -> str:
        """
        Computes a concise key metrics string (total, avg, min, max) for numeric columns.
        Uses all available rows for aggregation without including raw rows in the prompt.
        """
        if not rows or not columns:
            return ""

        metric_parts = []
        for col in columns:
            values = []
            for row in rows:
                v = row.get(col)
                if v is not None:
                    try:
                        values.append(float(v))
                    except (ValueError, TypeError):
                        pass

            if len(values) >= 1:
                total = sum(values)
                avg = total / len(values)
                minimum = min(values)
                maximum = max(values)
                # Format nicely: use int display when value is whole number
                def fmt(n: float) -> str:
                    return str(int(n)) if n == int(n) else f"{n:.2f}"

                metric_parts.append(
                    f"{col}: total={fmt(total)}, avg={fmt(avg)}, min={fmt(minimum)}, max={fmt(maximum)}"
                )

        return " | ".join(metric_parts) if metric_parts else ""

    async def repair_sql_loop(
        self,
        title: str = "Query",
        failing_sql: str = "",
        error_message: str = "",
        schema_context: str = "",
        max_retries: int = 3,
        model: Optional[str] = None,
        user_question: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Recursively repairs failing SQL queries.
        """
        target_title = user_question or title or "Query"
        current_sql = failing_sql
        current_error = error_message
        
        for attempt in range(1, max_retries + 1):
            logger.info(f"Auto Repair Attempt {attempt}/{max_retries} for widget '{target_title}': {current_sql}")
            
            prompt = get_sql_repair_prompt(schema_context, current_sql, current_error)
            messages = [
                {"role": "system", "content": "You are an expert SQL debugger. Return JSON."},
                {"role": "user", "content": prompt}
            ]
            
            try:
                response_text = await groq_client.get_chat_completion(
                    messages=messages,
                    model=model,
                    temperature=0.0,
                    max_tokens=settings.sql_repair_max_tokens,
                    json_mode=True,
                    task_name="SQL Repair"
                )
                
                response_json = json.loads(response_text)
                reasoning = response_json.get("reasoning", "")
                repaired_sql = response_json.get("sql", "").strip()
                explanation = response_json.get("explanation", "")
                
                is_valid, validation_msg = sql_validator.validate(repaired_sql)
                if not is_valid:
                    current_sql = repaired_sql
                    current_error = f"SQL Validation Error: {validation_msg}"
                    continue
                    
                execution_result = sql_executor.execute(repaired_sql)
                logger.info(f"Auto Repair succeeded on attempt {attempt} for '{title}'")
                
                # ECharts configurations
                chart_config = await chart_service.generate_chart_config(
                    user_question=title,
                    columns=execution_result["columns"],
                    rows=execution_result["rows"],
                    model=model
                )
                
                # Insights configuration
                widget_insights = await insight_service.generate_insights(
                    user_question=title,
                    sql=repaired_sql,
                    columns=execution_result["columns"],
                    rows=execution_result["rows"],
                    model=model
                )

                return {
                    "title": title,
                    "success": True,
                    "has_data": execution_result.get("row_count", 0) > 0,
                    "sql": repaired_sql,
                    "reasoning": reasoning,
                    "explanation": explanation,
                    "data": execution_result,
                    "chart": chart_config,
                    "insights": widget_insights,
                    "repaired_attempts": attempt
                }
                
            except Exception as e:
                current_error = f"Error during repair attempt {attempt}: {str(e)}"
                if isinstance(e, SQLExecutionError):
                    current_sql = e.sql
                
        logger.error(f"Auto Repair failed for widget '{title}' after {max_retries} attempts.")
        return {
            "title": title,
            "success": False,
            "has_data": False,
            "error": f"Failed to generate correct SQL for '{title}' after repair. Last error: {current_error}"
        }

sql_generator_service = SQLGeneratorService()
