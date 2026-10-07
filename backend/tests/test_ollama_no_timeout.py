import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx
from backend.llm.client import groq_client
from backend.config import settings

def test_ollama_timeout_is_none_by_default():
    """Verify that settings.ollama_timeout is None by default to allow infinite execution time for local Ollama models."""
    assert settings.ollama_timeout is None

@pytest.mark.asyncio
async def test_ollama_detailed_error_diagnostics_logging(caplog):
    """Verify that when Ollama fails, exact root-cause diagnostics (endpoint, model, HTTP status / exception) are logged and included in exception message."""
    messages = [{"role": "user", "content": "Test prompt"}]

    mock_failed_resp = MagicMock()
    mock_failed_resp.status_code = 500
    mock_failed_resp.text = "Internal Server Error in Ollama engine"

    with patch.object(httpx.AsyncClient, "post", new_callable=AsyncMock) as mock_post, \
         patch.object(groq_client, "_get_available_ollama_model", new_callable=AsyncMock) as mock_model:
        mock_post.return_value = mock_failed_resp
        mock_model.return_value = settings.ollama_model

        with pytest.raises(Exception) as exc_info:
            await groq_client._call_ollama(messages)

        err_text = str(exc_info.value)
        assert "All Ollama endpoints failed" in err_text
        assert "http://localhost:11434/v1/chat/completions" in err_text or "http://localhost:11434/api/chat" in err_text
        assert settings.ollama_model in err_text
        assert "Status: 500" in err_text
        assert "Internal Server Error in Ollama engine" in err_text
        assert "Ollama /v1 Endpoint Error" in caplog.text or "Ollama native /api/chat Endpoint Error" in caplog.text
