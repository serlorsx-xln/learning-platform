import os
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, BackgroundTasks
from pydantic import BaseModel

from .speexx_client import speexx
from .callbacks import emit

app = FastAPI(title="Speexx Worker")
MAX_CONCURRENT = int(os.environ.get("MAX_CONCURRENT_JOBS", "5"))
_running = 0


class RunRequest(BaseModel):
    jobId: str
    credentials: dict
    config: dict
    callbackUrl: str
    callbackKey: str


class ActivitiesRequest(BaseModel):
    authMode: str = "password"
    email: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    cookies: Optional[dict] = None


def verify_key(key: str | None):
    expected = os.environ.get("INTERNAL_API_KEY", "")
    if not expected or key != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health():
    return {"status": "ok", "service": "worker-speexx", "running": _running}


def _client_from_payload(payload: ActivitiesRequest):
    if payload.authMode == "cookie":
        client = speexx(cookies=payload.cookies or {})
        if not client.is_logged_in():
            raise HTTPException(status_code=401, detail="Invalid cookie session")
        return client

    email = payload.email or payload.username
    if not email or not payload.password:
        raise HTTPException(status_code=400, detail="email and password required")
    client = speexx()
    client.login(email, payload.password)
    if not client.is_logged_in():
        raise HTTPException(status_code=401, detail="Login failed")
    return client


@app.post("/internal/activities")
def internal_activities(payload: ActivitiesRequest, x_internal_key: Optional[str] = Header(default=None)):
    verify_key(x_internal_key)
    client = _client_from_payload(payload)
    article_id = client.get_article_id()
    return client.list_activities_status(article_id)


def run_job(payload: RunRequest):
    global _running
    creds = payload.credentials
    config = payload.config
    cb = payload.callbackUrl
    key = payload.callbackKey

    auth_mode = config.get("authMode", "password")
    do_activity = config.get("doActivity", True)
    test = config.get("test", False)
    target_percent = int(config.get("targetPercent", 100))
    delay_per_folder = int(config.get("delayPerFolder", 0))

    emit(cb, key, "Starting Speexx automation", status="running")

    if auth_mode == "cookie":
        client = speexx(cookies=creds.get("cookies"))
        if not client.is_logged_in():
            emit(cb, key, "Invalid cookie session", level="error", status="failed")
            return
        label = "cookie-session"
    else:
        email = creds.get("email") or creds.get("username")
        password = creds.get("password")
        client = speexx()
        client.login(email, password)
        if not client.is_logged_in():
            emit(cb, key, "Login failed", level="error", status="failed")
            return
        label = email

    article_id = client.get_article_id()
    emit(cb, key, f"Authenticated - article {article_id}", payload={"account": label})

    if do_activity:
        emit(cb, key, f"Running activities ({target_percent}%)")
        client.start(article_id, target_percent, delay_per_folder)
        emit(cb, key, "Activities complete")

    if test:
        emit(cb, key, "Running certificate test")
        client.start_certificate(article_id)
        emit(cb, key, "Certificate test complete")

    emit(
        cb,
        key,
        "Speexx job finished",
        status="success",
        summary={
            "articleId": article_id,
            "doActivity": do_activity,
            "test": test,
            "targetPercent": target_percent,
        },
    )


@app.post("/internal/run")
def internal_run(
    payload: RunRequest,
    background_tasks: BackgroundTasks,
    x_internal_key: Optional[str] = Header(default=None),
):
    verify_key(x_internal_key)
    global _running
    if _running >= MAX_CONCURRENT:
        raise HTTPException(status_code=429, detail="Too many concurrent jobs")
    _running += 1

    def wrapped():
        global _running
        try:
            run_job(payload)
        finally:
            _running -= 1

    background_tasks.add_task(wrapped)
    return {"accepted": True, "jobId": payload.jobId}
