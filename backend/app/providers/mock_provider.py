"""
backend/app/providers/mock_provider.py

Mock LLM Provider for testing fault tolerance, retries, and recovery scenarios.
Supports simulating:
  - normal generation
  - transient failure then success (tests retry)
  - permanent failure (tests redistribution)
  - timeout (tests deadline enforcement)
  - empty/malformed responses
  - circuit breaker trigger
"""

import asyncio
import time
from typing import Dict, List, Optional
from app.core.resilience import FailureCategory
from app.providers.base import (
    BaseLLMProvider,
    EmptyResponseError,
    LLMResponse,
    ProviderAuthError,
    ProviderError,
    ProviderModelNotFoundError,
    ProviderRateLimitError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)


class MockLLMProvider(BaseLLMProvider):
    def __init__(
        self,
        model_name: str = "mock-model",
        fail_times: int = 0,
        failure_type: FailureCategory = FailureCategory.EXECUTION_ERROR,
        simulated_delay: float = 0.0,
        response_template: Optional[str] = None,
    ):
        self.model_name = model_name
        self.fail_times = fail_times
        self.failure_type = failure_type
        self.simulated_delay = simulated_delay
        self.response_template = response_template
        self.call_count = 0
        self.history: List[Dict[str, str]] = []

    async def generate(
        self,
        prompt: str,
        system_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        timeout_seconds: float = 30.0,
    ) -> LLMResponse:
        self.call_count += 1
        start_time = time.time()

        if self.simulated_delay > 0:
            if self.simulated_delay > timeout_seconds:
                await asyncio.sleep(timeout_seconds + 0.05)
                raise ProviderTimeoutError(f"Simulated timeout: took > {timeout_seconds}s")
            await asyncio.sleep(self.simulated_delay)

        # Check if we should fail this attempt
        if self.call_count <= self.fail_times:
            if self.failure_type == FailureCategory.TIMEOUT:
                raise ProviderTimeoutError("Simulated network timeout")
            elif self.failure_type == FailureCategory.AUTH_ERROR:
                raise ProviderAuthError("Simulated invalid API key", retryable=False)
            elif self.failure_type == FailureCategory.MODEL_NOT_FOUND:
                raise ProviderModelNotFoundError(f"Model '{self.model_name}' not found", retryable=False)
            elif self.failure_type == FailureCategory.RATE_LIMIT:
                raise ProviderRateLimitError("Simulated rate limit exceeded")
            elif self.failure_type == FailureCategory.EMPTY_RESPONSE:
                raise EmptyResponseError("Simulated empty response from model")
            else:
                raise ProviderUnavailableError("Simulated provider connection error")

        latency_ms = int((time.time() - start_time) * 1000)
        content = self.response_template or f"[{self.model_name}] Response for: {prompt[:40]}..."
        self.history.append({"prompt": prompt, "system": system_prompt, "response": content})

        return LLMResponse(
            content=content,
            model_name=self.model_name,
            tokens_used=len(content.split()) * 2,
            latency_ms=latency_ms,
        )

    async def check_health(self) -> bool:
        return self.call_count > self.fail_times

