"""LLM-based implementation of the AI step using IBM watsonx.ai.

Falls back to the rule-based parser automatically if the IBM API call
fails for any reason.
"""

import json
import logging
from decimal import Decimal

from pydantic import BaseModel

from src.models.transaction import TransactionType
from src.services.transcript_parser import ParsedTransaction, parse_transcript
from src.services.watsonx import get_watsonx_model

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "You turn a shopkeeper's spoken note into a structured transaction "
    "record. Classify it as a sale (money coming in from a customer), a "
    "purchase (restocking inventory from a supplier), or an expense (a cost "
    "with no goods received, e.g. rent, fuel, transport). Extract the item/"
    "description, quantity (default 1 if not stated), the total amount as a "
    "plain number, and the counterparty (customer/supplier name, or \"N/A\" "
    "for an expense). Set matched=false only if you cannot find any amount "
    "at all.\n\n"
    "Return ONLY one valid JSON object with exactly these fields: "
    "type, item, quantity, total, counterparty, matched. "
    "Do not include markdown, explanations, examples, or additional text."
)


class _LLMTransaction(BaseModel):
    type: TransactionType
    item: str
    quantity: int
    total: float
    counterparty: str
    matched: bool


def parse_transcript_with_llm(transcript: str) -> ParsedTransaction:
    try:
        model = get_watsonx_model()

        response = model.chat(
            messages=[
                {
                    "role": "system",
                    "content": _SYSTEM_PROMPT,
                },
                {
                    "role": "user",
                    "content": transcript,
                },
            ],
            params={
                "max_tokens": 200,
                "temperature": 0,
            },
        )

        content = response["choices"][0]["message"]["content"].strip()

        

        parsed_json = json.loads(content)
        parsed = _LLMTransaction.model_validate(parsed_json)

        return ParsedTransaction(
            type=parsed.type,
            item=parsed.item,
            quantity=parsed.quantity,
            total=Decimal(str(parsed.total)),
            counterparty=parsed.counterparty,
            matched=parsed.matched,
        )

    except Exception:
        logger.warning(
            "IBM watsonx transcript parsing unavailable, "
            "falling back to the rule-based parser",
            exc_info=True,
        )
        return parse_transcript(transcript)