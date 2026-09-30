import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx
from backend.llm.client import groq_client
from backend.config import settings

@pytest.mark.asyncio
async def test_primary_api_success_no_ollama():
    """Verify that when primary API succeeds (HTTP 200), it returns response directly without invoking Ollama fallback."""
    groq_client.reset_circuit_breaker()
    mock_primary_resp = MagicMock()
    mock_primary_resp.status_code = 200
    mock_primary_resp.json.return_value = {
        "choices": [{"message": {"content": "SELECT * FROM orders;"}}]
    }

    messages = [{"role": "user", "content": "Get all orders"}]

    with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post, \
         patch.object(groq_client, "_call_ollama", new_callable=AsyncMock) as mock_ollama:
        
        mock_post.return_value = mock_primary_resp
        
        result = await groq_client.get_chat_completion(messages)
        
        assert result == "SELECT * FROM orders;"
        mock_post.assert_called_once()
        mock_ollama.assert_not_called()

@pytest.mark.asyncio
async def test_primary_api_rate_limit_fallback_to_ollama(caplog):
    """Verify that when primary API returns rate limit 429 error, it logs the error and falls back to Ollama."""
    groq_client.reset_circuit_breaker()
    mock_error_resp = MagicMock()
    mock_error_resp.status_code = 429
    mock_error_resp.text = "Rate limit exceeded"

    messages = [{"role": "user", "content": "Get all customers"}]

    with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post, \
         patch.object(groq_client, "_call_ollama", new_callable=AsyncMock) as mock_ollama, \
         patch("asyncio.sleep", new_callable=AsyncMock):

        mock_post.return_value = mock_error_resp
        mock_ollama.return_value = "SELECT * FROM customers;"

        result = await groq_client.get_chat_completion(messages)

        assert result == "SELECT * FROM customers;"
        assert mock_ollama.called is True

@pytest.mark.asyncio
async def test_primary_api_connection_error_fallback_to_ollama(caplog):
    """Verify that when primary API fails to connect (httpx.RequestError), it logs the failure and calls Ollama fallback."""
    groq_client.reset_circuit_breaker()
    messages = [{"role": "user", "content": "Count products"}]

    with patch.object(httpx.AsyncClient, "post", side_effect=httpx.RequestError("Connection timeout")), \
         patch.object(groq_client, "_call_ollama", new_callable=AsyncMock) as mock_ollama, \
         patch("asyncio.sleep", new_callable=AsyncMock):

        mock_ollama.return_value = "SELECT COUNT(*) FROM products;"

        result = await groq_client.get_chat_completion(messages)

        assert result == "SELECT COUNT(*) FROM products;"
        assert mock_ollama.called is True
        assert "Primary API connection failure" in caplog.text

@pytest.mark.asyncio
async def test_missing_api_key_fallback_to_ollama(caplog):
    """Verify that if GROQ_API_KEY is missing, error is logged and Ollama fallback is called immediately."""
    groq_client.reset_circuit_breaker()
    messages = [{"role": "user", "content": "List employees"}]

    with patch.object(settings, "groq_api_key", ""), \
         patch.object(groq_client, "_call_ollama", new_callable=AsyncMock) as mock_ollama:

        mock_ollama.return_value = "SELECT * FROM employees;"

        result = await groq_client.get_chat_completion(messages)

        assert result == "SELECT * FROM employees;"
        assert mock_ollama.called is True
        assert "GROQ_API_KEY is missing or not configured" in caplog.text

@pytest.mark.asyncio
async def test_groq_key_rotation_on_429_success(caplog):
    """Verify that when primary key hits 429, it seamlessly rotates to fallback1 Groq key and succeeds without calling Ollama."""
    groq_client.reset_circuit_breaker()

    # Call 1 (Primary Key): 429 Rate Limit
    mock_429 = MagicMock()
    mock_429.status_code = 429
    mock_429.text = "Rate limit hit on primary key"

    # Call 2 (Fallback 1 Key): 200 Success
    mock_200 = MagicMock()
    mock_200.status_code = 200
    mock_200.json.return_value = {
        "choices": [{"message": {"content": "SELECT * FROM fallback_success;"}}]
    }

    messages = [{"role": "user", "content": "Test rotation"}]

    with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post, \
         patch.object(groq_client, "_call_ollama", new_callable=AsyncMock) as mock_ollama:

        mock_post.side_effect = [mock_429, mock_200]

        result = await groq_client.get_chat_completion(messages)

        assert result == "SELECT * FROM fallback_success;"
        assert mock_post.call_count == 2
        # Ollama must NOT have been called
        mock_ollama.assert_not_called()
        # Circuit breaker must NOT be active
        assert groq_client.circuit_breaker_active is False
        # Active key index updated to 1
        assert groq_client.current_key_index == 1
        assert "Rotating to fallback Groq key #2" in caplog.text

@pytest.mark.asyncio
async def test_groq_exhausts_all_keys_then_falls_back_to_ollama(caplog):
    """Verify that when all Groq keys (primary + fallbacks) hit 429, circuit breaker trips and Ollama fallback is called."""
    groq_client.reset_circuit_breaker()

    mock_429 = MagicMock()
    mock_429.status_code = 429
    mock_429.text = "Rate limit exceeded"

    messages = [{"role": "user", "content": "All keys rate limited"}]

    with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post, \
         patch.object(groq_client, "_call_ollama", new_callable=AsyncMock) as mock_ollama:

        mock_post.return_value = mock_429
        mock_ollama.return_value = "Ollama Result After All Keys Failed"

        result = await groq_client.get_chat_completion(messages)

        total_keys = len(settings.get_all_groq_api_keys())
        assert result == "Ollama Result After All Keys Failed"
        assert mock_post.call_count == total_keys
        assert mock_ollama.call_count == 1
        assert groq_client.circuit_breaker_active is True
        assert f"All {total_keys} Groq API keys exhausted due to rate limits" in caplog.text

