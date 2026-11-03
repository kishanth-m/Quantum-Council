"""
backend/app/providers/ollama_provider.py

Ollama Local LLM Provider implementation.
"""

import time
import httpx
from app.core.resilience import FailureCategory
from app.providers.base import (
    BaseLLMProvider,
    EmptyResponseError,
    LLMResponse,
    ProviderModelNotFoundError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)


class OllamaProvider(BaseLLMProvider):
    def __init__(self, base_url: str = "http://127.0.0.1:11434", default_model: str = "llama3.2:1b"):
        self.base_url = base_url.rstrip("/")
        self.default_model = default_model

    async def _get_installed_models(self, client: httpx.AsyncClient) -> list[str]:
        """Fetch list of actually installed models in local Ollama."""
        try:
            res = await client.get(f"{self.base_url}/api/tags")
            if res.status_code == 200:
                data = res.json()
                return [m.get("name") for m in data.get("models", []) if m.get("name")]
        except Exception:
            pass
        return []

    async def generate(
        self,
        prompt: str,
        system_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        timeout_seconds: float = 30.0,
    ) -> LLMResponse:
        start_time = time.time()
        timeout = httpx.Timeout(timeout_seconds, connect=2.5)

        active_model = self.default_model
        payload = {
            "model": active_model,
            "prompt": prompt,
            "system": system_prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(f"{self.base_url}/api/generate", json=payload)
                
                # If requested model is not found, dynamically resolve to an installed model
                if response.status_code == 404:
                    installed = await self._get_installed_models(client)
                    if installed:
                        fallback_model = installed[0]
                        payload["model"] = fallback_model
                        active_model = fallback_model
                        response = await client.post(f"{self.base_url}/api/generate", json=payload)

                if response.status_code == 404:
                    raise ProviderModelNotFoundError(
                        f"Ollama model '{self.default_model}' not found and no local fallback model available. Run 'ollama pull {self.default_model}'.",
                        category=FailureCategory.MODEL_NOT_FOUND,
                    )
                if response.status_code != 200:
                    raise ProviderUnavailableError(f"Ollama returned HTTP {response.status_code}: {response.text}")

                data = response.json()
                content = data.get("response", "").strip()
                if not content:
                    raise EmptyResponseError("Ollama returned an empty response")

                latency_ms = int((time.time() - start_time) * 1000)
                eval_count = data.get("eval_count", len(content.split()) * 2)
                done_reason = data.get("done_reason")  # e.g. "stop" or "length"

                return LLMResponse(
                    content=content,
                    model_name=active_model,
                    tokens_used=eval_count,
                    latency_ms=latency_ms,
                    finish_reason=done_reason,
                )

        except (httpx.ConnectError, httpx.NetworkError):
            raise ProviderUnavailableError("Could not connect to Ollama server at " + self.base_url)
        except httpx.TimeoutException:
            raise ProviderTimeoutError(f"Ollama request timed out after {timeout_seconds}s")

    async def check_health(self) -> bool:
        try:
            timeout = httpx.Timeout(1.0, connect=1.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                return res.status_code == 200
        except Exception:
            return False

