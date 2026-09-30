import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from backend.services.sql_generator import sql_generator_service

@pytest.mark.asyncio
async def test_sequential_widget_execution_order():
    """Verify that multi-query widgets execute sequentially in a for loop order."""
    mock_plan = {
        "is_multi_query": True,
        "executive_title": "Test Sequential Dashboard",
        "plan": [
            {"id": "w1", "title": "Widget 1", "sql_instructions": "Get w1 data"},
            {"id": "w2", "title": "Widget 2", "sql_instructions": "Get w2 data"}
        ]
    }

    execution_sequence = []

    async def mock_gen_widget(widget_id, title, sql_instructions, original_prompt, model=None, progress_callback=None, **kwargs):
        execution_sequence.append(widget_id)
        return {
            "id": widget_id,
            "title": title,
            "success": True,
            "has_data": True,
            "sql": f"SELECT 1 FROM {widget_id}",
            "data": {"columns": ["id"], "rows": [{"id": 1}], "row_count": 1, "execution_time_ms": 5},
            "chart": {"chart_type": "bar"},
            "insights": "Widget Insights"
        }

    with patch("backend.services.sql_generator.query_planner.generate_plan", new_callable=AsyncMock) as mock_planner, \
         patch.object(sql_generator_service, "generate_sql_for_widget", side_effect=mock_gen_widget), \
         patch.object(sql_generator_service, "generate_executive_summary", new_callable=AsyncMock) as mock_summary:

        mock_planner.return_value = mock_plan
        mock_summary.return_value = "Executive Summary Content"

        res = await sql_generator_service.generate_sql(user_question="Compare w1 and w2")

        assert res["success"] is True
        assert execution_sequence == ["w1", "w2"]

@pytest.mark.asyncio
async def test_stepwise_progress_callbacks():
    """Verify that generate_sql_for_widget invokes progress_callback sequentially with appropriate step labels."""
    widget_id = "test_w"
    title = "Sales Analytics"
    sql_instructions = "Select total sales"
    original_prompt = "Analyze sales"

    steps_recorded = []

    async def sample_progress_callback(step: str, step_label: str):
        steps_recorded.append(step)

    mock_llm_json = '{"reasoning": "valid", "sql": "SELECT * FROM sales", "explanation": "test"}'
    mock_exec_data = {"columns": ["sales"], "rows": [{"sales": 100}], "row_count": 1, "execution_time_ms": 10}

    with patch("backend.services.sql_generator.groq_client.get_chat_completion", new_callable=AsyncMock) as mock_llm, \
         patch("backend.services.sql_generator.sql_validator.validate", return_value=(True, "")), \
         patch("backend.services.sql_generator.sql_executor.execute", return_value=mock_exec_data), \
         patch("backend.services.sql_generator.chart_service.generate_chart_config", new_callable=AsyncMock) as mock_chart, \
         patch("backend.services.sql_generator.insight_service.generate_insights", new_callable=AsyncMock) as mock_insights:

        mock_llm.return_value = mock_llm_json
        mock_chart.return_value = {"chart_type": "line"}
        mock_insights.return_value = "Widget insight content"

        res = await sql_generator_service.generate_sql_for_widget(
            widget_id=widget_id,
            title=title,
            sql_instructions=sql_instructions,
            original_prompt=original_prompt,
            progress_callback=sample_progress_callback
        )

        assert res["success"] is True
        assert steps_recorded == ["generating_sql", "executing_sql", "generating_chart"]

@pytest.mark.asyncio
async def test_generate_sql_stream_endpoint_imports():
    """Verify that query_planner is correctly imported and available in backend/api/routes.py."""
    from backend.api.routes import query_planner, generate_sql_stream_endpoint
    assert query_planner is not None
    assert generate_sql_stream_endpoint is not None
