import os
import httpx

INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "")


def post_event(callback_url: str, callback_key: str, payload: dict):
    try:
        httpx.patch(
            callback_url,
            json=payload,
            headers={"X-Internal-Key": callback_key, "Content-Type": "application/json"},
            timeout=30.0,
        )
    except Exception:
        pass


def emit(callback_url: str, callback_key: str, message: str, level: str = "info", **extra):
    post_event(callback_url, callback_key, {"message": message, "level": level, **extra})
