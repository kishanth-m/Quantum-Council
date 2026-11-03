"""
backend/app/providers/base.py

Base interface and exceptions for LLM providers.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
from app.core.resilience import FailureCategory


class ProviderError(Exception):
    """Base exception for provider failures."""
    category: FailureCategory = FailureCategory.EXECUTION_ERROR
    retryable: bool = True

    def __init__(self, message: str, category: Optional[FailureCategory] = None, retryable: Optional[bool] = None):
        super().__init__(message)
        if category is not None:
            self.category = category
        if retryable is not None:
            self.retryable = retryable


class ProviderUnavailableError(ProviderError):
    category = FailureCategory.PROVIDER_UNAVAILABLE
    retryable = True


class ProviderTimeoutError(ProviderError):
    category = FailureCategory.TIMEOUT
    retryable = True


class ProviderAuthError(ProviderError):
    category = FailureCategory.AUTH_ERROR
    retryable = False


class ProviderModelNotFoundError(ProviderError):
    category = FailureCategory.MODEL_NOT_FOUND
    retryable = False


class ProviderRateLimitError(ProviderError):
    category = FailureCategory.RATE_LIMIT
    retryable = True


class EmptyResponseError(ProviderError):
    category = FailureCategory.EMPTY_RESPONSE
    retryable = True


@dataclass
class LLMResponse:
    content: str
    model_name: str
    tokens_used: int = 0
    latency_ms: int = 0
    finish_reason: Optional[str] = None  # "stop" | "length" | "content_filter" | None


class BaseLLMProvider(ABC):
    """Abstract interface for all local and online LLM providers."""

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 1024,
        timeout_seconds: float = 30.0,
    ) -> LLMResponse:
        """Generate a response given a prompt and system instruction."""
        pass

    @abstractmethod
    async def check_health(self) -> bool:
        """Verify provider availability."""
        pass

