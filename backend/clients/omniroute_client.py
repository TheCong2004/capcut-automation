from __future__ import annotations

import httpx
import os
from urllib.parse import urlparse


def base_url() -> str:
    url = os.environ.get(
        "OMNIROUTE_BASE_URL",
        os.environ.get("LLM_BASE_URL", "http://127.0.0.1:20128"),
    ).rstrip("/")
    parsed = urlparse(url)
    if parsed.scheme == "http" and parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise RuntimeError("Plain HTTP OmniRoute URLs must use a loopback host")
    return url


def endpoint_key() -> str:
    return os.environ.get(
        "OMNIROUTE_ENDPOINT_KEY",
        os.environ.get("OMNIROUTE_API_KEY", ""),
    )


def runtime_headers() -> dict[str, str]:
    headers = {
        "Content-Type": "application/json",
    }

    if endpoint_key():
        headers["Authorization"] = f"Bearer {endpoint_key()}"

    return headers


async def get_models():
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{base_url()}/v1/models",
            headers=runtime_headers(),
        )

        response.raise_for_status()

        return response.json()


async def chat_completion(payload: dict):
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{base_url()}/v1/chat/completions",
            headers=runtime_headers(),
            json=payload,
        )

        response.raise_for_status()

        return response.json()


async def health():
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{base_url()}/api/health/ping",
                headers=runtime_headers(),
            )

        if response.is_success:
            status = "ready"
        elif response.status_code in (401, 403):
            status = "not_configured"
        else:
            status = "error"

        return {
            "status": status,
            "status_code": response.status_code,
        }

    except (httpx.HTTPError, OSError, RuntimeError):
        return {
            "status": "offline",
            "error": {
                "code": "OMNIROUTE_UNAVAILABLE",
                "message": "OmniRoute is unavailable",
                "service": "omniroute",
            },
        }
