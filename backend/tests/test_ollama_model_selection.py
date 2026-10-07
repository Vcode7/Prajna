import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx
from backend.llm.client import groq_client

@pytest.mark.asyncio
async def test_ollama_model_selection_priority():
    """
    Validates model selection priority:
    1. Qwen text model (top priority)
    2. Gemma model (fallback if no Qwen)
    3. Error if neither exists (never fallback to OCR/VLM)
    """
    mock_client = MagicMock(spec=httpx.AsyncClient)
    base_url = "http://localhost:11434"

    # Test 1: Only OCR models + Gemma installed -> Must pick Gemma
    res_gemma = MagicMock()
    res_gemma.status_code = 200
    res_gemma.json.return_value = {
        "models": [
            {"name": "ahmgam/chandra-ocr-2:q4"},
            {"name": "ahmgam/chandra-ocr-2:q3"},
            {"name": "hf.co/prithivMLmods/gemma-4-E4B-it-qat-GGUF:Q3_K_S"}
        ]
    }
    mock_client.get = AsyncMock(return_value=res_gemma)

    selected = await groq_client._get_available_ollama_model(mock_client, base_url)
    assert selected == "hf.co/prithivMLmods/gemma-4-E4B-it-qat-GGUF:Q3_K_S"

    # Test 2: Qwen + Gemma installed -> Must pick Qwen first
    res_qwen = MagicMock()
    res_qwen.status_code = 200
    res_qwen.json.return_value = {
        "models": [
            {"name": "ahmgam/chandra-ocr-2:q4"},
            {"name": "hf.co/prithivMLmods/gemma-4-E4B-it-qat-GGUF:Q3_K_S"},
            {"name": "qwen2.5:7b"}
        ]
    }
    mock_client.get = AsyncMock(return_value=res_qwen)

    selected = await groq_client._get_available_ollama_model(mock_client, base_url)
    assert selected == "qwen2.5:7b"

    # Test 3: Only OCR/VLM installed -> Must raise RuntimeError (never use OCR/VLM)
    res_ocr_only = MagicMock()
    res_ocr_only.status_code = 200
    res_ocr_only.json.return_value = {
        "models": [
            {"name": "ahmgam/chandra-ocr-2:q4"},
            {"name": "ahmgam/chandra-ocr-2:q3"}
        ]
    }
    mock_client.get = AsyncMock(return_value=res_ocr_only)

    with pytest.raises(RuntimeError) as exc_info:
        await groq_client._get_available_ollama_model(mock_client, base_url)
    assert "No suitable local LLM found" in str(exc_info.value)
    assert "Will not fall back to OCR or VLM models" in str(exc_info.value)

    # Test 4: Neither Qwen nor Gemma, but another text model (e.g. llama3.2:3b) is installed -> Must pick it
    res_other = MagicMock()
    res_other.status_code = 200
    res_other.json.return_value = {
        "models": [
            {"name": "ahmgam/chandra-ocr-2:q4"},
            {"name": "llama3.2:3b"}
        ]
    }
    mock_client.get = AsyncMock(return_value=res_other)

    selected = await groq_client._get_available_ollama_model(mock_client, base_url)
    assert selected == "llama3.2:3b"
