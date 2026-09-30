import asyncio
import time
import httpx
from typing import Dict, Any, List, Optional
from backend.config import settings
import logging

logger = logging.getLogger(__name__)

def _mask_api_key(key: str) -> str:
    if not key:
        return "empty"
    if len(key) <= 12:
        return "***"
    return f"{key[:8]}...{key[-4:]}"

class GroqClient:
    def __init__(self):
        self.api_url = "https://api.groq.com/openai/v1/chat/completions"
        self.semaphore = asyncio.Semaphore(1)
        self.circuit_breaker_active = False
        self.circuit_breaker_activated_at = 0.0
        self.circuit_breaker_cooldown_seconds = 60.0
        self.current_key_index = 0

    def reset_circuit_breaker(self):
        """
        Resets the circuit breaker state and resets active key index so new request jobs attempt Groq API fresh from primary key.
        """
        if self.circuit_breaker_active:
            logger.info("Resetting Groq API rate-limit circuit breaker and rotating back to primary API key.")
            self.circuit_breaker_active = False
        self.circuit_breaker_activated_at = 0.0
        self.current_key_index = 0

    async def _get_available_ollama_model(self, client: httpx.AsyncClient, base_url: str, requested_model: Optional[str] = None) -> str:
        """
        Fetches installed models from local Ollama instance via /api/tags and selects a model
        using strict fallback rules:
        1. Any installed Qwen text model (contains 'qwen' in name, excluding OCR/vision/chandra models).
        2. If no Qwen model, any installed Gemma model (contains 'gemma' in name, excluding OCR/vision models).
        3. If neither Qwen nor Gemma is found, raises RuntimeError. Never falls back to VLM or OCR models.
        """
        try:
            res = await client.get(f"{base_url}/api/tags")
            if res.status_code == 200:
                models = res.json().get("models", [])
                if not models:
                    raise RuntimeError(
                        f"No models installed in local Ollama at {base_url}. "
                        f"Please install a Qwen or Gemma model (e.g. 'ollama pull qwen2.5:7b' or 'ollama pull gemma2:9b')."
                    )

                installed_names = [m.get("name") or m.get("model", "") for m in models if (m.get("name") or m.get("model"))]

                def is_ocr_or_vlm(name: str) -> bool:
                    nl = name.lower()
                    return any(kw in nl for kw in ["ocr", "chandra", "vision", "-vl", ":vl"])

                clean_models = [n for n in installed_names if not is_ocr_or_vlm(n)]

                # Priority 1: Any Qwen text model
                qwen_models = [n for n in clean_models if "qwen" in n.lower()]
                if qwen_models:
                    if requested_model and requested_model in qwen_models:
                        return requested_model
                    selected = qwen_models[0]
                    logger.info(f"Auto-detected installed local Ollama Qwen model: '{selected}'")
                    return selected

                # Priority 2: If no Qwen model, fall back to Gemma model
                gemma_models = [n for n in clean_models if "gemma" in n.lower()]
                if gemma_models:
                    if requested_model and requested_model in gemma_models:
                        return requested_model
                    selected = gemma_models[0]
                    logger.info(f"Auto-detected installed local Ollama Gemma model: '{selected}' (Qwen not installed, falling back to Gemma)")
                    return selected

                # Priority 3: Neither Qwen nor Gemma found -> Raise Error
                err_msg = (
                    f"No suitable local LLM found in Ollama at {base_url}. "
                    f"Expected a Qwen text model or Gemma model, but installed models are: {installed_names}. "
                    f"Will not fall back to OCR or VLM models. Please run: 'ollama pull qwen2.5:7b' or 'ollama pull gemma2:9b'."
                )
                logger.error(err_msg)
                raise RuntimeError(err_msg)

        except RuntimeError:
            raise
        except Exception as e:
            logger.warning(f"Could not query Ollama /api/tags: {e}")

        # If network error or tags query failed, fall back to requested_model or settings.ollama_model
        return requested_model or settings.ollama_model

    async def _call_ollama(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        json_mode: bool = False,
        task_name: Optional[str] = None
    ) -> str:
        """
        Fallback method to call local Ollama model without timeout constraints (timeout=None).
        Attempts OpenAI-compatible /v1/chat/completions endpoint first,
        falling back to native /api/chat endpoint if needed.
        Provides detailed root-cause logging (endpoint, model, status, exception) on failure.
        """
        base_url = settings.ollama_base_url.rstrip("/")
        v1_url = f"{base_url}/v1/chat/completions"
        selected_temp = temperature if temperature is not None else settings.temperature
        selected_tokens = max_tokens or settings.max_tokens

        total_input_chars = sum(len(m.get("content", "")) for m in messages)
        est_tokens = max(1, total_input_chars // 4)
        task_label = f" [{task_name}]" if task_name else ""
        errors_log = []

        async with httpx.AsyncClient(timeout=settings.ollama_timeout) as client:
            # Resolve installed model strictly: Qwen -> Gemma -> Error
            try:
                ollama_model = await self._get_available_ollama_model(
                    client, base_url, requested_model=settings.ollama_model
                )
            except Exception as e:
                if "No suitable local LLM found" in str(e) or "No models installed" in str(e):
                    raise
                logger.warning(f"Ollama model resolution error: {e}")
                ollama_model = settings.ollama_model

            logger.info(
                f"Triggering Ollama fallback{task_label} using model '{ollama_model}' at {base_url}\n"
                f"  Model: {ollama_model}\n"
                f"  Prompt Tokens: ~{est_tokens}\n"
                f"  Max Completion Tokens: {selected_tokens}"
            )

            payload = {
                "model": ollama_model,
                "messages": messages,
                "temperature": selected_temp,
                "max_tokens": selected_tokens
            }

            if json_mode:
                payload["response_format"] = {"type": "json_object"}

            # 1. Try OpenAI-compatible /v1 endpoint
            try:
                response = await client.post(v1_url, json=payload)
                if response.status_code == 200:
                    resp_json = response.json()
                    usage = resp_json.get("usage")
                    if usage:
                        p_tok = usage.get("prompt_tokens", "N/A")
                        c_tok = usage.get("completion_tokens", "N/A")
                        t_tok = usage.get("total_tokens", "N/A")
                        logger.info(
                            f"Ollama Response Usage{task_label} | "
                            f"Prompt Tokens: {p_tok} | "
                            f"Completion Tokens: {c_tok} | "
                            f"Total Tokens: {t_tok}"
                        )
                    logger.info(f"Ollama local model '{ollama_model}' successfully completed the request via /v1 endpoint.")
                    return resp_json["choices"][0]["message"]["content"]
                else:
                    v1_err = f"Endpoint: {v1_url} | Model: {ollama_model} | Status: {response.status_code} | Body: {response.text}"
                    logger.error(f"Ollama /v1 Endpoint Error: {v1_err}")
                    errors_log.append(v1_err)

                    if "not found" in response.text.lower():
                        try:
                            detected = await self._get_available_ollama_model(client, base_url)
                            if detected != ollama_model:
                                ollama_model = detected
                                payload["model"] = ollama_model
                                retry_resp = await client.post(v1_url, json=payload)
                                if retry_resp.status_code == 200:
                                    resp_json = retry_resp.json()
                                    logger.info(f"Ollama local model '{ollama_model}' successfully completed the request via /v1 endpoint after re-detection.")
                                    return resp_json["choices"][0]["message"]["content"]
                        except Exception as det_err:
                            logger.error(f"Error during Ollama model re-detection: {det_err}")

            except Exception as req_err:
                v1_err = f"Endpoint: {v1_url} | Model: {ollama_model} | Exception ({type(req_err).__name__}): {str(req_err)}"
                logger.error(f"Ollama /v1 Endpoint Exception: {v1_err}")
                errors_log.append(v1_err)

            # 2. Try native /api/chat endpoint as secondary fallback
            native_url = f"{base_url}/api/chat"
            native_payload = {
                "model": ollama_model,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": selected_temp
                }
            }
            if json_mode:
                native_payload["format"] = "json"

            try:
                native_response = await client.post(native_url, json=native_payload)
                if native_response.status_code == 200:
                    resp_json = native_response.json()
                    prompt_eval = resp_json.get("prompt_eval_count", "N/A")
                    eval_cnt = resp_json.get("eval_count", "N/A")
                    logger.info(
                        f"Ollama Response Usage{task_label} | "
                        f"Prompt Tokens: {prompt_eval} | "
                        f"Completion Tokens: {eval_cnt}"
                    )
                    logger.info(f"Ollama local model '{ollama_model}' successfully completed the request via native /api/chat endpoint.")
                    return resp_json["message"]["content"]
                else:
                    native_err = f"Endpoint: {native_url} | Model: {ollama_model} | Status: {native_response.status_code} | Body: {native_response.text}"
                    logger.error(f"Ollama native /api/chat Endpoint Error: {native_err}")
                    errors_log.append(native_err)
            except Exception as req_err:
                native_err = f"Endpoint: {native_url} | Model: {ollama_model} | Exception ({type(req_err).__name__}): {str(req_err)}"
                logger.error(f"Ollama native /api/chat Endpoint Exception: {native_err}")
                errors_log.append(native_err)

        full_error_msg = " | ".join(errors_log) if errors_log else "Unknown connection error to Ollama."
        raise Exception(f"All Ollama endpoints failed. Diagnostics -> {full_error_msg}")

    async def get_chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        json_mode: bool = False,
        task_name: Optional[str] = None
    ) -> str:
        """
        Sends a request to Groq API chat completions with concurrency control and key rotation.
        If a 429 rate-limit occurs on a key, seamlessly rotates and retries across configured
        fallback Groq keys (up to 4 fallback keys).
        If all Groq keys hit rate limits or fail, activates circuit breaker and routes immediately
        to local Ollama model for the remainder of the job.
        """
        # 1. If Circuit Breaker is active, check if cooldown has elapsed before routing to Ollama
        if self.circuit_breaker_active:
            now = time.time()
            if self.circuit_breaker_activated_at and (now - self.circuit_breaker_activated_at > self.circuit_breaker_cooldown_seconds):
                logger.info("Circuit breaker cooldown (60s) has elapsed. Proactively resetting to retry primary Groq API...")
                self.reset_circuit_breaker()
            else:
                logger.info("Circuit breaker active due to prior 429 rate limit across Groq keys in current job. Routing request directly to local Ollama model...")
                return await self._call_ollama(
                    messages=messages,
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    json_mode=json_mode,
                    task_name=task_name
                )

        all_keys = settings.get_all_groq_api_keys()
        if not all_keys or not settings.groq_api_key:
            logger.error("GROQ_API_KEY is missing or not configured. Primary API cannot be called.")
            logger.info("Falling back to local Ollama model to complete query...")
            self.circuit_breaker_active = True
            self.circuit_breaker_activated_at = time.time()
            return await self._call_ollama(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                json_mode=json_mode,
                task_name=task_name
            )

        selected_model = model or settings.default_model
        selected_temp = temperature if temperature is not None else settings.temperature
        selected_tokens = max_tokens or settings.max_tokens

        payload = {
            "model": selected_model,
            "messages": messages,
            "temperature": selected_temp,
            "max_tokens": selected_tokens
        }

        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        total_input_chars = sum(len(m.get("content", "")) for m in messages)
        est_tokens = max(1, total_input_chars // 4)
        task_label = f" [{task_name}]" if task_name else ""
        total_keys = len(all_keys)
        start_index = self.current_key_index % total_keys
        last_error = ""

        # 2. Acquire semaphore lock to serialize / throttle concurrent Groq HTTP calls
        async with self.semaphore:
            # Double check circuit breaker state after acquiring lock
            if self.circuit_breaker_active:
                now = time.time()
                if self.circuit_breaker_activated_at and (now - self.circuit_breaker_activated_at > self.circuit_breaker_cooldown_seconds):
                    logger.info("Circuit breaker cooldown (60s) has elapsed while waiting for lock. Resetting to retry Groq API...")
                    self.reset_circuit_breaker()
                else:
                    logger.info("Circuit breaker activated while waiting for concurrency lock. Routing directly to local Ollama model...")
                    return await self._call_ollama(
                        messages=messages,
                        model=model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        json_mode=json_mode,
                        task_name=task_name
                    )

            async with httpx.AsyncClient(timeout=60.0) as client:
                for attempt in range(total_keys):
                    key_index = (start_index + attempt) % total_keys
                    current_key = all_keys[key_index]
                    masked_key = _mask_api_key(current_key)
                    key_desc = f"Key #{key_index + 1}/{total_keys} ({masked_key})"

                    headers = {
                        "Authorization": f"Bearer {current_key}",
                        "Content-Type": "application/json"
                    }

                    logger.info(
                        f"Sending request to Groq API using {key_desc}{task_label}\n"
                        f"  Model: {selected_model}\n"
                        f"  Prompt Tokens: ~{est_tokens}\n"
                        f"  Max Completion Tokens: {selected_tokens}"
                    )

                    try:
                        response = await client.post(self.api_url, headers=headers, json=payload)

                        if response.status_code == 200:
                            resp_json = response.json()
                            usage = resp_json.get("usage")
                            if usage:
                                p_tok = usage.get("prompt_tokens", "N/A")
                                c_tok = usage.get("completion_tokens", "N/A")
                                t_tok = usage.get("total_tokens", "N/A")
                                logger.info(
                                    f"Groq API Response Usage using {key_desc}{task_label} | "
                                    f"Prompt Tokens: {p_tok} | "
                                    f"Completion Tokens: {c_tok} | "
                                    f"Total Tokens: {t_tok}"
                                )
                            self.current_key_index = key_index
                            return resp_json["choices"][0]["message"]["content"]

                        # If model not found (404), seamlessly retry with verified working Groq model
                        if response.status_code == 404 and selected_model != "qwen/qwen3.8-27b":
                            logger.warning(f"Model '{selected_model}' not found on Groq API with {key_desc}. Automatically retrying with verified model 'qwen/qwen3.8-27b'...")
                            fallback_payload = dict(payload)
                            fallback_payload["model"] = "qwen/qwen3.8-27b"
                            retry_resp = await client.post(self.api_url, headers=headers, json=fallback_payload)
                            if retry_resp.status_code == 200:
                                self.current_key_index = key_index
                                return retry_resp.json()["choices"][0]["message"]["content"]

                        last_error = f"Groq API error (HTTP {response.status_code}) on {key_desc}: {response.text}"
                        logger.warning(f"Groq API call failed: {last_error}")

                        # On 429 Rate Limit, attempt rotation to the next fallback Groq key
                        if response.status_code == 429:
                            if attempt < total_keys - 1:
                                next_key_index = (key_index + 1) % total_keys
                                next_masked = _mask_api_key(all_keys[next_key_index])
                                logger.warning(
                                    f"Groq API HTTP 429 Rate Limit hit on {key_desc}! "
                                    f"Rotating to fallback Groq key #{next_key_index + 1}/{total_keys} ({next_masked}) and retrying..."
                                )
                                self.current_key_index = next_key_index
                                continue
                            else:
                                logger.warning(
                                    f"All {total_keys} Groq API keys exhausted due to rate limits (HTTP 429)! "
                                    f"Activating Ollama fallback mode for all remaining requests in this job."
                                )
                                self.circuit_breaker_active = True
                                self.circuit_breaker_activated_at = time.time()
                                break

                        # On other HTTP errors (401, 403, 500, etc.), try next fallback Groq key if available
                        if attempt < total_keys - 1:
                            next_key_index = (key_index + 1) % total_keys
                            next_masked = _mask_api_key(all_keys[next_key_index])
                            logger.warning(
                                f"Groq API returned HTTP {response.status_code} on {key_desc}. "
                                f"Trying next fallback Groq key #{next_key_index + 1}/{total_keys} ({next_masked})..."
                            )
                            self.current_key_index = next_key_index
                            continue
                        else:
                            break

                    except httpx.RequestError as e:
                        last_error = f"HTTP connection error to Groq API on {key_desc}: {str(e)}"
                        logger.error(f"Primary API connection failure: {last_error}")
                        if attempt < total_keys - 1:
                            next_key_index = (key_index + 1) % total_keys
                            next_masked = _mask_api_key(all_keys[next_key_index])
                            logger.warning(
                                f"Connection error on {key_desc}. Trying next fallback Groq key #{next_key_index + 1}/{total_keys} ({next_masked})..."
                            )
                            self.current_key_index = next_key_index
                            continue
                        else:
                            self.circuit_breaker_active = True
                            self.circuit_breaker_activated_at = time.time()
                            break

        # All Groq keys failed or rate-limited. Fallback to local Ollama model
        logger.info(f"All Groq API keys failed or rate-limited. Last error: '{last_error}'. Executing fallback to local Ollama model.")
        try:
            return await self._call_ollama(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                json_mode=json_mode,
                task_name=task_name
            )
        except Exception as ollama_err:
            logger.error(f"Local Ollama fallback also failed: {ollama_err}")
            raise Exception(f"All Groq API keys failed. Last error: '{last_error}'. Local Ollama Fallback Error: '{str(ollama_err)}'")

groq_client = GroqClient()


