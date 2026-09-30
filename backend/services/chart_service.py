import json
from typing import List, Dict, Any, Optional
from backend.llm.client import groq_client
from backend.config import settings
from backend.services.chart_heuristic import chart_heuristic
from backend.prompts.templates import get_chart_generation_prompt
import logging

logger = logging.getLogger(__name__)

class ChartService:
    async def generate_chart_config(
        self,
        user_question: str,
        columns: List[str],
        rows: List[Dict[str, Any]],
        model: Optional[str] = None,
        use_ai_charts: bool = False
    ) -> Dict[str, Any]:
        """
        Decides chart type and outputs ECharts configuration options.
        
        Pipeline:
          1. If use_ai_charts=False (default), run heuristic engine first.
             - Confidence 'high'   → return heuristic result, skip LLM entirely.
             - Confidence 'medium' → run LLM for a better pick.
             - Confidence 'low'    → run LLM.
          2. If use_ai_charts=True, always call LLM (original behaviour).
        """
        if not rows or not columns:
            return self._get_fallback_config("No data available", columns)

        # ── Heuristic Path ─────────────────────────────────────────────────
        if not use_ai_charts:
            heuristic_result = chart_heuristic.infer(columns, rows, user_question)
            confidence = heuristic_result.get("confidence", "low")

            if confidence == "high":
                logger.info(
                    f"Chart heuristic returned '{heuristic_result['chart_type']}' "
                    f"with HIGH confidence — skipping LLM chart call."
                )
                # Remove internal confidence key before returning
                heuristic_result.pop("confidence", None)
                return heuristic_result

            # Medium / low confidence — fall through to LLM with a hint
            logger.info(
                f"Chart heuristic returned '{heuristic_result.get('chart_type')}' "
                f"with {confidence.upper()} confidence — delegating to LLM."
            )

        # ── LLM Path ──────────────────────────────────────────────────────
        sample_rows = rows[:3]
        prompt = get_chart_generation_prompt(user_question, columns, sample_rows)
        messages = [
            {"role": "system", "content": "You are a helpful data visualization assistant."},
            {"role": "user", "content": prompt}
        ]

        try:
            logger.info("Generating chart configuration from LLM...")
            response_text = await groq_client.get_chat_completion(
                messages=messages,
                model=model,
                temperature=0.0,
                max_tokens=settings.chart_generation_max_tokens,
                json_mode=True,
                task_name="Chart Generation"
            )

            config = json.loads(response_text)

            # Basic validation
            chart_type = config.get("chart_type", "Bar")
            title = config.get("title", f"Chart for: {user_question[:30]}...")
            x_axis = config.get("x_axis", columns[0] if columns else "")

            series = config.get("series", [])
            if not series:
                y_axis = config.get("y_axis", columns[1] if len(columns) > 1 else columns[0])
                series = [{"name": y_axis.replace("_", " ").title(), "data_key": y_axis}]

            return {
                "chart_type": chart_type,
                "title": title,
                "x_axis": x_axis,
                "y_axis": config.get("y_axis", series[0]["data_key"] if series else ""),
                "series": series
            }

        except Exception as e:
            logger.error(f"Failed to generate chart config via LLM: {e}. Using heuristic fallback.")
            fallback = chart_heuristic.infer(columns, rows, user_question)
            fallback.pop("confidence", None)
            return fallback if fallback.get("chart_type") else self._get_fallback_config(user_question, columns)

    def _get_fallback_config(self, user_question: str, columns: List[str]) -> Dict[str, Any]:
        """Creates a safe fallback configuration if both heuristic and LLM fail."""
        if not columns:
            return {
                "chart_type": "Bar",
                "title": "No Data",
                "x_axis": "",
                "y_axis": "",
                "series": []
            }

        x_axis = columns[0]
        y_axis = columns[1] if len(columns) > 1 else columns[0]

        return {
            "chart_type": "Bar",
            "title": f"Results for: {user_question[:30]}...",
            "x_axis": x_axis,
            "y_axis": y_axis,
            "series": [{"name": y_axis.replace("_", " ").title(), "data_key": y_axis}]
        }

chart_service = ChartService()
