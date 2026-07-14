import os
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, BackgroundTasks
from pydantic import BaseModel

from .client import EdClient
from .callbacks import emit

app = FastAPI(title="EdLearning Worker")
MAX_CONCURRENT = int(os.environ.get("MAX_CONCURRENT_JOBS", "5"))
_running = 0


class Credentials(BaseModel):
    username: str
    password: str
    school: str = "ru"
    educationId: str = "ed22"


class RunRequest(BaseModel):
    jobId: str
    credentials: dict
    config: dict
    callbackUrl: str
    callbackKey: str


def verify_key(key: str | None):
    expected = os.environ.get("INTERNAL_API_KEY", "")
    if not expected or key != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health():
    return {"status": "ok", "service": "worker-edlearning", "running": _running}


@app.post("/internal/modules")
def internal_modules(payload: Credentials, x_internal_key: Optional[str] = Header(default=None)):
    verify_key(x_internal_key)
    client = EdClient(payload.school, payload.educationId)
    if not client.login(payload.username, payload.password):
        raise HTTPException(status_code=401, detail="Login failed")
    modules = client.get_course_tree()
    analyzed = [client.analyze_module(m) for m in modules]
    pending = [m for m in analyzed if not m["isComplete"]]
    complete = [m for m in analyzed if m["isComplete"]]
    return {
        "modules": analyzed,
        "pendingModules": pending,
        "completeModules": complete,
        "summary": {
            "total": len(analyzed),
            "pending": len(pending),
            "complete": len(complete),
        },
    }


def run_job(payload: RunRequest):
    global _running
    creds = payload.credentials
    config = payload.config
    cb = payload.callbackUrl
    key = payload.callbackKey

    client = EdClient(creds.get("school", "ru"), creds.get("educationId", "ed22"))
    emit(cb, key, "Logging in to EdLearning", status="running")

    if not client.login(creds.get("username"), creds.get("password")):
        emit(cb, key, "Login failed", level="error", status="failed")
        return

    name = f"{client.info.get('FName', '')} {client.info.get('LName', '')}".strip()
    emit(cb, key, f"Authenticated as {name or creds.get('username')}")

    module_ids = config.get("moduleIds", [])
    minutes = int(config.get("minutesToAdd", 0) or 0)
    mode = config.get("mode", "full")

    def on_event(message: str):
        emit(cb, key, message)

    summary = client.run_module_pipeline(
        module_ids,
        minutes_to_add=minutes,
        mode=mode,
        on_event=on_event,
    )
    emit(cb, key, "Pipeline complete", status="success", summary=summary)


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
