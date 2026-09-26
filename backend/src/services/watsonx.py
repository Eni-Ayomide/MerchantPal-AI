import os

from ibm_watsonx_ai import APIClient, Credentials
from ibm_watsonx_ai.foundation_models import ModelInference


MODEL_ID = os.getenv("WATSONX_MODEL_ID", "llama-3-3-70b-instruct")
WATSONX_URL = os.getenv("WATSONX_URL", "https://eu-gb.ml.cloud.ibm.com")
PROJECT_ID = os.getenv("WATSONX_PROJECT_ID")


def get_watsonx_model() -> ModelInference:
    api_key = os.getenv("WATSONX_API_KEY")

    if not api_key:
        raise RuntimeError("WATSONX_API_KEY is not configured")

    if not PROJECT_ID:
        raise RuntimeError("WATSONX_PROJECT_ID is not configured")

    credentials = Credentials(
        url=WATSONX_URL,
        api_key=api_key,
    )

    client = APIClient(credentials)

    return ModelInference(
        model_id=MODEL_ID,
        api_client=client,
        project_id=PROJECT_ID,
    )