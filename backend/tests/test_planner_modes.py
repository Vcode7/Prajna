import pytest
from unittest.mock import AsyncMock, patch
from backend.services.query_planner import query_planner
from backend.services.sql_generator import sql_generator_service

@pytest.mark.asyncio
async def test_planner_generator_mode():
    """Verify that analytical queries return generator mode."""
    mock_json = '{"mode": "generator", "is_multi_query": false, "executive_title": "Monthly Sales Report", "plan": [{"id": "w1", "title": "Sales", "modules": ["Sales"], "description": "Sales", "sql_instructions": "SELECT * FROM sales"}]}'
    with patch("backend.services.query_planner.groq_client.get_chat_completion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_json
        res = await query_planner.generate_plan("Show monthly sales.")
        assert res.get("mode") == "generator"
        assert res.get("is_multi_query") is False
        assert len(res.get("plan", [])) == 1

@pytest.mark.asyncio
async def test_planner_response_mode():
    """Verify that general usage or off-topic questions return response mode."""
    mock_json = '{"mode": "response", "response_text": "I am designed specifically for database analytics and business intelligence."}'
    with patch("backend.services.query_planner.groq_client.get_chat_completion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_json
        res = await query_planner.generate_plan("What can this software do?")
        assert res.get("mode") == "response"
        assert "response_text" in res

@pytest.mark.asyncio
async def test_sql_generator_response_mode_bypass():
    """Verify that sql_generator_service bypasses analytics pipeline on response mode."""
    mock_json = '{"mode": "response", "response_text": "I am designed specifically for database analytics and business intelligence."}'
    with patch("backend.services.query_planner.groq_client.get_chat_completion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = mock_json
        res = await sql_generator_service.generate_sql("Tell me a joke.")
        assert res.get("mode") == "response"
        assert res.get("widgets") == []
        assert "insights" in res

@pytest.mark.asyncio
async def test_apply_dashboard_filters_empty_values_bypass():
    """Verify that apply_dashboard_filters skips LLM calls if all filter values are empty strings."""
    from backend.api.routes import apply_dashboard_filters
    widgets = [{"id": "w1", "title": "Widget 1", "sql": "SELECT * FROM sales"}]
    payload = {
        "filters": {"region": "", "date_start": ""},
        "widgets": widgets
    }
    with patch("backend.api.routes.groq_client.get_chat_completion", new_callable=AsyncMock) as mock_llm:
        res = await apply_dashboard_filters(payload)
        assert res["widgets"] == widgets
        mock_llm.assert_not_called()
