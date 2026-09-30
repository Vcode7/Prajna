from typing import List, Dict, Any, Optional
from backend.llm.client import groq_client
from backend.config import settings
from backend.prompts.templates import get_insight_generation_prompt
import logging

logger = logging.getLogger(__name__)

class InsightService:
    async def generate_insights(
        self,
        user_question: str,
        sql: str,
        columns: List[str],
        rows: List[Dict[str, Any]],
        model: Optional[str] = None,
        row_count: Optional[int] = None
    ) -> str:
        """
        Generates business insights from the query results using the LLM.
        
        row_count: If provided, used as the canonical total row count
                   (so callers can pass a data sample while still reporting
                   the true total). Defaults to len(rows) when not provided.
        """
        if not rows:
            return "No data returned by the query to generate insights from."

        # Resolve canonical total row count
        total_rows = row_count if row_count is not None else len(rows)

        # Truncate row listings to avoid overloading LLM token limits
        max_sample_rows = 15
        sample_rows = rows[:max_sample_rows]

        # Build simple textual representation of the data
        data_summary_lines = []
        data_summary_lines.append(f"Total Rows: {total_rows}")
        data_summary_lines.append(f"Columns: {', '.join(columns)}")
        data_summary_lines.append("Data Sample:")

        for idx, row in enumerate(sample_rows):
            vals = [str(row[col]) for col in columns if col in row]
            data_summary_lines.append(f"  Row {idx + 1}: {', '.join(vals)}")

        if total_rows > max_sample_rows:
            data_summary_lines.append(f"  ... ({total_rows - max_sample_rows} more rows)")

        data_summary = "\n".join(data_summary_lines)

        prompt = get_insight_generation_prompt(user_question, sql, data_summary)

        messages = [
            {"role": "system", "content": "You are a helpful business intelligence analyst."},
            {"role": "user", "content": prompt}
        ]

        try:
            logger.info("Generating insights from query data...")
            insights = await groq_client.get_chat_completion(
                messages=messages,
                model=model,
                temperature=0.3,
                max_tokens=settings.widget_insight_max_tokens,
                json_mode=False,
                task_name="Widget Insight"
            )
            return insights
        except Exception as e:
            logger.error(f"Failed to generate insights: {e}")
            return f"Error generating insights: {str(e)}"

insight_service = InsightService()

