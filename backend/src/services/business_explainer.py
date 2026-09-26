import json
import logging
from typing import Any

from src.services.watsonx import get_watsonx_model

logger = logging.getLogger(__name__)


def explain_business_facts(
    question: str, intent: str, facts: dict[str, Any], fallback: str
) -> str:
    """Turn verified facts into natural language without allowing recalculation."""
    try:
        model = get_watsonx_model()

        response = model.chat(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Explain the business answer in plain language. "
                        "Use only the supplied facts. "
                        "Do not calculate, estimate, infer, or change any number. "
"Preserve all numbers exactly as supplied, and do not add a currency symbol "
"or currency name unless it is explicitly present in the supplied facts. "
                        "Do not invent information. "
                        "If the facts are empty, say that the records do not contain an answer. "
                        "Return only the explanation."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "question": question,
                            "intent": intent,
                            "facts": facts,
                        },
                        default=str,
                    ),
                },
            ],
            params={
                "max_tokens": 300,
                "temperature": 0,
            },
        )

        text = response["choices"][0]["message"]["content"].strip()
        return text or fallback

    except Exception:
        logger.debug(
            "IBM watsonx business explanation unavailable; "
            "using deterministic explanation",
            exc_info=True,
        )
        return fallback