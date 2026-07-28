import httpx


def post_event(callback_url: str, callback_key: str, payload: dict):
    try:
        httpx.patch(
            callback_url,
            json=payload,
            headers={"X-Internal-Key": callback_key, "Content-Type": "application/json"},
            timeout=30.0,
        )
    except Exception as exc:
        print(f"callback failed: {exc}", flush=True)


def emit(callback_url: str, callback_key: str, message: str, level: str = "info", **extra):
    post_event(callback_url, callback_key, {"message": message, "level": level, **extra})
