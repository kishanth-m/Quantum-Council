"""
backend/app/core/response_validator.py

Response Completion Validation and Controlled Continuation Engine.

Ensures that agent deliverables:
  1. Are non-empty and substantive.
  2. Are not merely headings, section outlines, or repetitive meta-planning statements.
  3. Have balanced Markdown code fences and properly terminated tables.
  4. Have completed terminal sentences without dangling prepositions or cut-off words.
  5. Undergo controlled, bounded continuation when truncated by provider token limits.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, Optional, Tuple, List, Awaitable

from app.providers.base import BaseLLMProvider, LLMResponse


@dataclass
class ValidationReport:
    is_complete: bool
    needs_continuation: bool
    is_recoverable: bool
    reason: Optional[str] = None
    has_unclosed_fence: bool = False
    has_unclosed_table: bool = False
    is_heading_or_planning_only: bool = False
    dangling_ending: bool = False


# Words that indicate a cut-off sentence when appearing at the very end of text
DANGLING_END_WORDS = {
    "that", "which", "and", "or", "because", "with", "such", "as", "the",
    "a", "an", "to", "for", "in", "of", "is", "are", "was", "were", "from",
    "by", "doesn't", "doesn", "don't", "don", "not", "it's", "its", "if",
    "when", "while", "where", "although", "but", "also", "then", "than",
    "so", "since", "about", "into", "through", "after", "before", "between",
}

PLANNING_ONLY_PATTERNS = [
    r"^(?:we\s+need\s+to|i\s+will|let\s+us|let\s+me|this\s+section\s+will|planning:)\s+.*$",
    r"^(?:logical\s+and\s+feasibility\s+analysis|primary\s+foundational\s+research):\s*$",
]


class ResponseCompletionValidator:
    """
    Validates agent outputs for substantive completeness before marking COMPLETED.
    """

    @classmethod
    def validate(
        cls,
        text: Optional[str],
        finish_reason: Optional[str] = None,
    ) -> ValidationReport:
        if not text or not text.strip():
            return ValidationReport(
                is_complete=False,
                needs_continuation=False,
                is_recoverable=True,
                reason="EMPTY_RESPONSE",
            )

        clean = text.strip()
        words = clean.split()
        word_count = len(words)

        # 1. Heading or Planning Only Check
        # If output is very short (< 35 words) and is just a markdown title or planning phrase
        if word_count < 35:
            lines = [l.strip() for l in clean.split("\n") if l.strip()]
            all_headings_or_empty = all(l.startswith("#") or l.startswith("**") for l in lines)
            if all_headings_or_empty:
                return ValidationReport(
                    is_complete=False,
                    needs_continuation=True,
                    is_recoverable=True,
                    is_heading_or_planning_only=True,
                    reason="HEADING_ONLY_WITHOUT_CONTENT",
                )

            # Check if text is just a meta-planning statement without deliverable
            for pat in PLANNING_ONLY_PATTERNS:
                if re.match(pat, clean, re.IGNORECASE):
                    return ValidationReport(
                        is_complete=False,
                        needs_continuation=True,
                        is_recoverable=True,
                        is_heading_or_planning_only=True,
                        reason="META_PLANNING_STATEMENT_WITHOUT_DELIVERABLE",
                    )

        # 2. Provider Truncation Check
        provider_truncated = finish_reason in ("length", "max_tokens")

        # 3. Unclosed Code Fence Check (odd count of ```)
        fence_count = clean.count("```")
        has_unclosed_fence = (fence_count % 2 != 0)

        # 4. Unclosed Markdown Table Check
        has_unclosed_table = False
        lines = clean.splitlines()
        if len(lines) >= 2:
            last_line = lines[-1].strip()
            # If previous line had table markup but last line is partial
            if any("|" in l for l in lines[-3:]):
                if last_line.startswith("|") and not last_line.endswith("|"):
                    has_unclosed_table = True
                elif last_line.startswith("|") and last_line.count("|") < 2:
                    has_unclosed_table = True

        # 5. Dangling Sentence / Cut-Off Ending Check
        dangling_ending = False
        if word_count > 0:
            last_word = words[-1].lower().rstrip(".,;:!?'\"`")
            if last_word in DANGLING_END_WORDS:
                dangling_ending = True
            elif not clean.endswith((".", "!", "?", "\n", "```", ")", "\"", "'", "}", "]", "`", ":", "*")):
                # Last character is an incomplete token/letter
                dangling_ending = True

        needs_continuation = (
            provider_truncated
            or has_unclosed_fence
            or has_unclosed_table
            or dangling_ending
        )

        reasons = []
        if provider_truncated:
            reasons.append("PROVIDER_LENGTH_LIMIT_REACHED")
        if has_unclosed_fence:
            reasons.append("UNCLOSED_CODE_BLOCK")
        if has_unclosed_table:
            reasons.append("UNCLOSED_MARKDOWN_TABLE")
        if dangling_ending:
            reasons.append("INCOMPLETE_SENTENCE_ENDING")

        is_complete = not needs_continuation
        reason_str = " | ".join(reasons) if reasons else None

        return ValidationReport(
            is_complete=is_complete,
            needs_continuation=needs_continuation,
            is_recoverable=needs_continuation,
            reason=reason_str,
            has_unclosed_fence=has_unclosed_fence,
            has_unclosed_table=has_unclosed_table,
            dangling_ending=dangling_ending,
        )


async def execute_with_controlled_continuation(
    generate_fn: Callable[[str, str, int], Awaitable[LLMResponse]],
    prompt: str,
    system_prompt: str,
    max_tokens: int = 1024,
    max_continuations: int = 1,
) -> Tuple[str, bool, ValidationReport, int]:
    """
    Executes a model generation call and automatically applies controlled,
    bounded continuation if the response was cut off mid-thought or mid-code.

    Returns:
        (final_text, is_fully_complete, final_report, total_tokens_used)
    """
    initial_resp = await generate_fn(prompt, system_prompt, max_tokens)
    current_text = initial_resp.content.strip()
    total_tokens = initial_resp.tokens_used
    report = ResponseCompletionValidator.validate(current_text, finish_reason=initial_resp.finish_reason)

    if report.is_complete or not report.needs_continuation or max_continuations <= 0:
        return current_text, report.is_complete, report, total_tokens

    # Controlled continuation attempt
    continuations_done = 0
    while continuations_done < max_continuations and report.needs_continuation:
        continuations_done += 1

        # Extract anchor context from the end of the current partial response
        anchor_context = current_text[-600:]

        fence_instruction = ""
        if report.has_unclosed_fence:
            fence_instruction = "IMPORTANT: An open code block (```) was left unclosed. Complete the code and close the fence with ```.\n"
        if report.has_unclosed_table:
            fence_instruction += "IMPORTANT: An open Markdown table row was left incomplete. Finish the table rows cleanly.\n"

        continuation_prompt = (
            f"You are continuing an incomplete deliverable for the following task:\n"
            f"TASK: {prompt}\n\n"
            f"[PARTIAL RESPONSE GENERATED SO FAR - DO NOT REPEAT THIS]:\n"
            f"...{anchor_context}\n\n"
            f"[CONTINUATION RULES]:\n"
            f"1. Resume IMMEDIATELY from the exact unfinished thought or code snippet above.\n"
            f"2. DO NOT repeat any of the already generated sections.\n"
            f"3. DO NOT include any conversational filler, meta-announcements, or apologies.\n"
            f"{fence_instruction}"
            f"4. Deliver the remaining sections and provide the definitive conclusion."
        )

        try:
            cont_resp = await generate_fn(continuation_prompt, system_prompt, max_tokens)
            cont_text = cont_resp.content.strip()
            total_tokens += cont_resp.tokens_used

            if not cont_text:
                break

            # Stitch cleanly
            # Check if continuation starts with same word that ended partial
            words_curr = current_text.split()
            words_cont = cont_text.split()
            if words_curr and words_cont and words_curr[-1].lower() == words_cont[0].lower():
                cont_text = " ".join(words_cont[1:])

            # Join with newline or space depending on structure
            if current_text.endswith("\n") or cont_text.startswith("#") or cont_text.startswith("-") or cont_text.startswith("```"):
                current_text = f"{current_text}\n{cont_text}"
            else:
                current_text = f"{current_text} {cont_text}"

            # Re-validate stitched text
            report = ResponseCompletionValidator.validate(current_text, finish_reason=cont_resp.finish_reason)
        except Exception:
            # If continuation fails, keep existing partial response
            break

    # If code fence is still unclosed after continuation attempt, safely seal it rather than leaving broken markdown
    if report.has_unclosed_fence and current_text.count("```") % 2 != 0:
        current_text += "\n```\n"
        report = ResponseCompletionValidator.validate(current_text, finish_reason="stop")

    return current_text, report.is_complete, report, total_tokens

