import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx
from backend.llm.client import groq_client
from backend.services.sql_generator import sql_generator_service
from backend.config import settings

@pytest.mark.asyncio
async def test_keyerror_title_defensive_summary():
    """Verify that generate_executive_summary handles widgets missing the 'title' key gracefully without raising KeyError."""
    incomplete_widgets = [
        {
            "sql": "SELECT * FROM orders",
            "data": {"columns": ["id"], "rows": [{"id": 1}], "row_count": 1}
            # Missing 'title' key!
        },
        {
            "title": "Valid Widget Title",
            "sql": "SELECT * FROM products",
            "data": {"columns": ["id"], "rows": [{"id": 1}], "row_count": 1}
        }
    ]

    with patch("backend.services.sql_generator.groq_client.get_chat_completion", new_callable=AsyncMock) as mock_llm:
        mock_llm.return_value = "Executive Summary Report"

        result = await sql_generator_service.generate_executive_summary(
            user_question="Compare orders and products",
            widgets=incomplete_widgets
        )

        assert result == "Executive Summary Report"
        mock_llm.assert_called_once()

@pytest.mark.asyncio
async def test_circuit_breaker_activation_on_429():
    """Verify that an initial HTTP 429 rate limit activates circuit_breaker_active and routes all subsequent requests directly to Ollama."""
    groq_client.reset_circuit_breaker()
    assert groq_client.circuit_breaker_active is False

    mock_429_resp = MagicMock()
    mock_429_resp.status_code = 429
    mock_429_resp.text = "Rate limit exceeded"

    messages = [{"role": "user", "content": "Test prompt"}]

    with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post, \
         patch.object(groq_client, "_call_ollama", new_callable=AsyncMock) as mock_ollama:

        mock_post.return_value = mock_429_resp
        mock_ollama.return_value = "Ollama Result"

        # 1. First call encounters 429 across all configured Groq keys before falling back
        res1 = await groq_client.get_chat_completion(messages)
        expected_attempts = len(settings.get_all_groq_api_keys())
        assert res1 == "Ollama Result"
        assert groq_client.circuit_breaker_active is True
        assert mock_post.call_count == expected_attempts
        assert mock_ollama.call_count == 1

        # 2. Second call in same job must bypass Groq completely (mock_post should NOT be called again)
        res2 = await groq_client.get_chat_completion(messages)
        assert res2 == "Ollama Result"
        assert mock_post.call_count == expected_attempts # Still expected_attempts! No new network request to Groq
        assert mock_ollama.call_count == 2

@pytest.mark.asyncio
async def test_circuit_breaker_reset():
    """Verify that calling reset_circuit_breaker() restores normal Groq API operation for a new job."""
    groq_client.circuit_breaker_active = True
    
    groq_client.reset_circuit_breaker()
    assert groq_client.circuit_breaker_active is False

    mock_200_resp = MagicMock()
    mock_200_resp.status_code = 200
    mock_200_resp.json.return_value = {"choices": [{"message": {"content": "Groq Result"}}]}

    messages = [{"role": "user", "content": "New Job"}]

    with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post, \
         patch.object(groq_client, "_call_ollama", new_callable=AsyncMock) as mock_ollama:

        mock_post.return_value = mock_200_resp

        res = await groq_client.get_chat_completion(messages)
        assert res == "Groq Result"
        mock_post.assert_called_once()
        mock_ollama.assert_not_called()
