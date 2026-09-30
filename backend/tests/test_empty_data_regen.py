import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from backend.services.sql_generator import sql_generator_service

@pytest.mark.asyncio
async def test_widget_with_valid_data():
    """Verify that a widget query returning valid data (>0 rows) succeeds without invoking regeneration."""
    mock_execution = {
        "columns": ["order_id", "total_amount"],
        "rows": [{"order_id": 1, "total_amount": 150.0}],
        "row_count": 1,
        "execution_time_ms": 5.0
    }

    with patch("backend.services.sql_generator.context_builder.build_schema_context", return_value="Schema Context"), \
         patch("backend.services.sql_generator.groq_client.get_chat_completion", new_callable=AsyncMock) as mock_llm, \
         patch("backend.services.sql_generator.sql_validator.validate", return_value=(True, "")), \
         patch("backend.services.sql_generator.sql_executor.execute", return_value=mock_execution), \
         patch("backend.services.sql_generator.chart_service.generate_chart_config", new_callable=AsyncMock, return_value={}), \
         patch("backend.services.sql_generator.insight_service.generate_insights", new_callable=AsyncMock, return_value="Insights"), \
         patch.object(sql_generator_service, "regenerate_sql_for_empty_data", new_callable=AsyncMock) as mock_regen:

        mock_llm.return_value = '{"reasoning": "ok", "sql": "SELECT * FROM orders", "explanation": "ok"}'

        result = await sql_generator_service.generate_sql_for_widget(
            widget_id="w1",
            title="Orders Test",
            sql_instructions="Select orders",
            original_prompt="Show orders"
        )

        assert result["success"] is True
        assert result["has_data"] is True
        assert result["data"]["row_count"] == 1
        mock_regen.assert_not_called()

@pytest.mark.asyncio
async def test_empty_data_triggers_regeneration_success():
    """Verify that an initial query returning 0 rows triggers regeneration, and if regeneration succeeds, widget is returned."""
    mock_empty_execution = {
        "columns": ["order_id"],
        "rows": [],
        "row_count": 0,
        "execution_time_ms": 2.0
    }

    mock_regen_result = {
        "success": True,
        "has_data": True,
        "sql": "SELECT * FROM orders LIMIT 5",
        "reasoning": "Fixed date filter",
        "explanation": "Revised query",
        "data": {"columns": ["order_id"], "rows": [{"order_id": 1}], "row_count": 1},
        "chart": {},
        "insights": "Good data"
    }

    with patch("backend.services.sql_generator.context_builder.build_schema_context", return_value="Schema Context"), \
         patch("backend.services.sql_generator.groq_client.get_chat_completion", new_callable=AsyncMock) as mock_llm, \
         patch("backend.services.sql_generator.sql_validator.validate", return_value=(True, "")), \
         patch("backend.services.sql_generator.sql_executor.execute", return_value=mock_empty_execution), \
         patch.object(sql_generator_service, "regenerate_sql_for_empty_data", new_callable=AsyncMock, return_value=mock_regen_result) as mock_regen:

        mock_llm.return_value = '{"reasoning": "ok", "sql": "SELECT * FROM orders WHERE 1=0", "explanation": "ok"}'

        result = await sql_generator_service.generate_sql_for_widget(
            widget_id="w2",
            title="Empty Query Test",
            sql_instructions="Select orders",
            original_prompt="Show orders"
        )

        assert result["success"] is True
        assert result["has_data"] is True
        mock_regen.assert_called_once()

@pytest.mark.asyncio
async def test_empty_data_regeneration_still_empty_skipped():
    """Verify that if initial AND regenerated queries return 0 rows, the widget is marked as has_data=False and silently skipped."""
    mock_empty_execution = {
        "columns": ["order_id"],
        "rows": [],
        "row_count": 0,
        "execution_time_ms": 2.0
    }

    mock_failed_regen = {
        "success": False,
        "has_data": False
    }

    with patch("backend.services.sql_generator.context_builder.build_schema_context", return_value="Schema Context"), \
         patch("backend.services.sql_generator.groq_client.get_chat_completion", new_callable=AsyncMock) as mock_llm, \
         patch("backend.services.sql_generator.sql_validator.validate", return_value=(True, "")), \
         patch("backend.services.sql_generator.sql_executor.execute", return_value=mock_empty_execution), \
         patch.object(sql_generator_service, "regenerate_sql_for_empty_data", new_callable=AsyncMock, return_value=mock_failed_regen) as mock_regen:

        mock_llm.return_value = '{"reasoning": "ok", "sql": "SELECT * FROM orders WHERE 1=0", "explanation": "ok"}'

        result = await sql_generator_service.generate_sql_for_widget(
            widget_id="w3",
            title="Persistent Empty Query Test",
            sql_instructions="Select nonexistent orders",
            original_prompt="Show orders"
        )

        assert result["success"] is False
        assert result["has_data"] is False
        mock_regen.assert_called_once()
