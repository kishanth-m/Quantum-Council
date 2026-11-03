"""
backend/app/providers/openai_provider.py

Universal provider adapter for Groq, OpenAI, and any OpenAI-compatible API endpoint.
"""

import time
from typing import Optional
import httpx

from app.core.resilience import FailureCategory
from app.providers.base import (
    BaseLLMProvider,
    EmptyResponseError,
    LLMResponse,
    ProviderAuthError,
    ProviderModelNotFoundError,
    ProviderRateLimitError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)

DEFAULT_BASE_URLS = {
    "groq": "https://api.groq.com/openai/v1",
    "openai": "https://api.openai.com/v1",
}


class OpenAICompatibleProvider(BaseLLMProvider):
    """
    Adapter for any LLM endpoint following the OpenAI Chat Completions API format
    (Groq, OpenAI, LocalAI, vLLM, LMStudio, OpenRouter, Together).
    """

    def __init__(
        self,
        provider_name: str = "groq",
        model_name: str = "llama-3.3-70b-versatile",
        api_key: str = "",
        base_url: Optional[str] = None,
    ):
        self.provider_name = provider_name.lower()
        self.model_name = model_name
        self.api_key = api_key or ""
        
        # Resolve base URL with defaults
        resolved_url = base_url or DEFAULT_BASE_URLS.get(self.provider_name, "https://api.openai.com/v1")
        self.base_url = resolved_url.rstrip("/")

    async def generate(
        self,
        prompt: str,
        system_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        timeout_seconds: float = 30.0,
    ) -> LLMResponse:
        start_time = time.time()
        timeout = httpx.Timeout(timeout_seconds, connect=5.0)

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            "temperature": max(0.0, min(temperature, 2.0)),
            "max_tokens": max_tokens,
        }

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )

                if response.status_code in (401, 403):
                    raise ProviderAuthError(
                        f"Authentication failed for {self.provider_name.upper()}. Please verify your API key.",
                        category=FailureCategory.AUTH_ERROR,
                        retryable=False,
                    )
                if response.status_code == 404:
                    raise ProviderModelNotFoundError(
                        f"Model '{self.model_name}' not found on {self.provider_name.upper()}.",
                        category=FailureCategory.MODEL_NOT_FOUND,
                        retryable=False,
                    )
                if response.status_code == 429:
                    raise ProviderRateLimitError(
                        f"Rate limit exceeded on {self.provider_name.upper()}. Backing off.",
                        category=FailureCategory.RATE_LIMIT,
                    )
                if response.status_code != 200:
                    err_msg = response.text[:200]
                    raise ProviderUnavailableError(
                        f"{self.provider_name.upper()} returned HTTP {response.status_code}: {err_msg}"
                    )

                data = response.json()
                choices = data.get("choices", [])
                if not choices:
                    raise EmptyResponseError(f"{self.provider_name.upper()} returned no completion choices")

                msg_obj = choices[0].get("message", {})
                content = msg_obj.get("content")

                # Handle reasoning models (e.g. DeepSeek-R1 or Qwen reasoning on Groq)
                if not content:
                    reasoning = msg_obj.get("reasoning") or msg_obj.get("reasoning_content")
                    if reasoning:
                        content = reasoning

                # Handle model refusal
                if not content and msg_obj.get("refusal"):
                    content = f"[{self.provider_name.upper()} Refusal]: {msg_obj.get('refusal')}"

                # Handle length truncation
                finish_reason = choices[0].get("finish_reason", "unknown")
                if not content:
                    if finish_reason == "length":
                        content = "[Response truncated: token limit reached before completion]"
                    else:
                        raise EmptyResponseError(
                            f"{self.provider_name.upper()} returned empty completion content (finish_reason: {finish_reason})"
                        )

                content = str(content).strip()
                if not content:
                    raise EmptyResponseError(
                        f"{self.provider_name.upper()} returned empty completion content (finish_reason: {finish_reason})"
                    )

                usage = data.get("usage", {})
                tokens_used = usage.get("total_tokens", len(content.split()) * 2)
                latency_ms = int((time.time() - start_time) * 1000)

                return LLMResponse(
                    content=content,
                    model_name=self.model_name,
                    tokens_used=tokens_used,
                    latency_ms=latency_ms,
                    finish_reason=finish_reason,
                )

        except (httpx.ConnectError, httpx.NetworkError) as e:
            raise ProviderUnavailableError(f"Could not connect to {self.provider_name.upper()} endpoint: {str(e)}")
        except httpx.TimeoutException:
            raise ProviderTimeoutError(f"Request to {self.provider_name.upper()} timed out after {timeout_seconds}s")

    async def check_connection_detailed(self) -> dict:
        """
        Executes a two-stage verification:
          Stage A: Authentication and model existence via GET /models
          Stage B: Live minimal chat completion via POST /chat/completions
        Returns a dict: {"success": bool, "message": str, "latency_ms": float}
        """
        if not self.api_key:
            return {
                "success": False,
                "message": f"No API key provided or saved for {self.provider_name.upper()}.",
                "latency_ms": 0.0,
            }

        start_time = time.perf_counter()
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "QuantumCouncil/0.1.0",
        }

        # ─── Stage A: Validate Authentication & Model List ───────────────────────
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(6.0, connect=3.0)) as client:
                models_resp = await client.get(f"{self.base_url}/models", headers=headers)
                latency = round((time.perf_counter() - start_time) * 1000, 2)

                if models_resp.status_code in (401, 403):
                    return {
                        "success": False,
                        "message": f"Authentication failed for {self.provider_name.upper()} (HTTP {models_resp.status_code}). Please verify your API key.",
                        "latency_ms": latency,
                    }
                elif models_resp.status_code != 200:
                    return {
                        "success": False,
                        "message": f"{self.provider_name.upper()} /models check returned HTTP {models_resp.status_code}: {models_resp.text[:150]}",
                        "latency_ms": latency,
                    }

                models_data = models_resp.json()
                available_ids = [m.get("id") for m in models_data.get("data", []) if isinstance(m, dict)]

                if available_ids and self.model_name not in available_ids:
                    sample = ", ".join(available_ids[:6])
                    return {
                        "success": False,
                        "message": (
                            f"Authentication succeeded, but model '{self.model_name}' was not found on your {self.provider_name.upper()} account. "
                            f"Available models include: {sample}"
                        ),
                        "latency_ms": latency,
                    }

        except httpx.TimeoutException:
            return {
                "success": False,
                "message": f"Connection to {self.provider_name.upper()} timed out during authentication check.",
                "latency_ms": round((time.perf_counter() - start_time) * 1000, 2),
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Could not connect to {self.provider_name.upper()} models endpoint: {str(e)}",
                "latency_ms": round((time.perf_counter() - start_time) * 1000, 2),
            }

        # ─── Stage B: Live Minimal Chat Completion ───────────────────────────────
        chat_payload = {
            "model": self.model_name,
            "messages": [
                {"role": "user", "content": "Please reply with the single word: OK"}
            ],
            "temperature": 0.1,
            "max_tokens": 60,
        }

        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=4.0)) as client:
                chat_resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=chat_payload,
                )
                total_latency = round((time.perf_counter() - start_time) * 1000, 2)

                if chat_resp.status_code == 429:
                    return {
                        "success": False,
                        "message": f"{self.provider_name.upper()} rate limit reached (HTTP 429). Please retry in a few moments.",
                        "latency_ms": total_latency,
                    }
                elif chat_resp.status_code != 200:
                    return {
                        "success": False,
                        "message": f"{self.provider_name.upper()} chat completion returned HTTP {chat_resp.status_code}: {chat_resp.text[:180]}",
                        "latency_ms": total_latency,
                    }

                chat_data = chat_resp.json()
                choices = chat_data.get("choices", [])
                if not choices:
                    return {
                        "success": False,
                        "message": f"{self.provider_name.upper()} returned an empty choices array.",
                        "latency_ms": total_latency,
                    }

                msg_obj = choices[0].get("message", {})
                content = msg_obj.get("content")
                reasoning = msg_obj.get("reasoning") or msg_obj.get("reasoning_content")
                finish_reason = choices[0].get("finish_reason", "completed")

                reply_text = (content or reasoning or "").strip()

                if not reply_text:
                    if msg_obj.get("refusal"):
                        return {
                            "success": False,
                            "message": f"Model refused the test ping: {msg_obj.get('refusal')}",
                            "latency_ms": total_latency,
                        }
                    return {
                        "success": False,
                        "message": f"{self.provider_name.upper()} returned empty text content (finish_reason: {finish_reason}).",
                        "latency_ms": total_latency,
                    }

                preview = (reply_text[:35] + "…") if len(reply_text) > 35 else reply_text
                return {
                    "success": True,
                    "message": f"Successfully connected to {self.provider_name.upper()} ({self.model_name}). Auth & inference verified. Model output: \"{preview}\"",
                    "latency_ms": total_latency,
                }

        except httpx.TimeoutException:
            return {
                "success": False,
                "message": f"{self.provider_name.upper()} inference ping timed out after 10s.",
                "latency_ms": round((time.perf_counter() - start_time) * 1000, 2),
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"{self.provider_name.upper()} inference ping failed: {str(e)}",
                "latency_ms": round((time.perf_counter() - start_time) * 1000, 2),
            }

    async def check_health(self) -> bool:
        """Perform a lightweight test request to verify API key and endpoint validity."""
        if not self.api_key:
            return False
        try:
            timeout = httpx.Timeout(5.0, connect=3.0)
            headers = {"Authorization": f"Bearer {self.api_key}"}
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.get(f"{self.base_url}/models", headers=headers)
                return res.status_code == 200
        except Exception:
            return False

