import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from time import sleep
from threading import Lock

from fastapi import FastAPI, Header, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional

from .ondemand import Ondemand
from .callbacks import emit

app = FastAPI(title="AndrewBiggs Worker")
MAX_CONCURRENT = int(os.environ.get("MAX_CONCURRENT_JOBS", "5"))
_running = 0
_lock = Lock()


class RunRequest(BaseModel):
    jobId: str
    credentials: dict
    config: dict
    callbackUrl: str
    callbackKey: str


class Credentials(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None
    password: str


class CoursesRequest(Credentials):
    courseUrls: Optional[List[str]] = None


def verify_key(key: str | None):
    expected = os.environ.get("INTERNAL_API_KEY", "")
    if not expected or key != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health():
    return {"status": "ok", "service": "worker-andrewbiggs", "running": _running}


@app.post("/internal/courses")
def internal_courses(payload: CoursesRequest, x_internal_key: Optional[str] = Header(default=None)):
    verify_key(x_internal_key)
    username = payload.email or payload.username
    if not username:
        raise HTTPException(status_code=400, detail="email or username required")

    bot = Ondemand()
    if not bot.login(username, payload.password):
        raise HTTPException(status_code=401, detail="Login failed")

    enrolled = bot.get_enrolled_courses()
    extra_urls = payload.courseUrls or []
    seen = {c["url"] for c in enrolled}
    for url in extra_urls:
        if url and url not in seen:
            enrolled.append({"url": url, "title": url.split("/")[-2].replace("-", " ")})

    courses = [bot.inspect_course(c["url"]) for c in enrolled]
    pending = [c for c in courses if not c["isComplete"]]
    complete = [c for c in courses if c["isComplete"]]
    return {
        "courses": courses,
        "pendingCourses": pending,
        "completeCourses": complete,
        "summary": {
            "total": len(courses),
            "pending": len(pending),
            "complete": len(complete),
        },
    }


def run_job(payload: RunRequest):
    global _running
    cb = payload.callbackUrl
    key = payload.callbackKey

    username = payload.credentials.get("email") or payload.credentials.get("username")
    password = payload.credentials.get("password")
    courses = payload.config.get("courses", [])
    delay = float(payload.config.get("delay", 0.5))

    emit(cb, key, "Starting Andrew Biggs automation", status="running")

    bot = Ondemand()
    if not bot.login(username, password):
        emit(cb, key, "Login failed", level="error", status="failed", summary={"error": "auth"})
        return

    profile = bot.get_profile_name()
    emit(cb, key, f"Authenticated as {profile}")

    all_lessons = []
    for course_url in courses:
        try:
            inspection = bot.inspect_course(course_url)
            incomplete = [l["url"] for l in inspection.get("lessons", []) if not l.get("isComplete")]
            if incomplete:
                all_lessons.extend(incomplete)
                emit(cb, key, f"Found {len(incomplete)} incomplete lessons in course", payload={"course": course_url, "complete": inspection.get("completeLessons", 0), "total": inspection.get("totalLessons", 0)})
            else:
                emit(cb, key, f"Course already complete — skipped", payload={"course": course_url})
        except Exception as e:
            emit(cb, key, f"Failed to read course: {e}", level="warn")

    if not all_lessons:
        emit(cb, key, "No lessons found", level="warn", status="failed")
        return

    emit(cb, key, f"Solving {len(all_lessons)} lessons")
    results = []

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {}
        for idx, lesson_url in enumerate(all_lessons):
            if idx > 0 and delay > 0:
                sleep(delay)
            future = executor.submit(bot.solve_quiz, lesson_url)
            futures[future] = lesson_url

        for future in as_completed(futures):
            try:
                result = future.result()
                results.append(result)
                status = result.get("status")
                if status == "success":
                    emit(cb, key, f"Completed lesson", payload={"url": result.get("url")})
                elif status == "error":
                    emit(cb, key, result.get("error", "Lesson error"), level="error", payload=result)
            except Exception as e:
                emit(cb, key, str(e), level="error")

    success = sum(1 for r in results if r.get("status") == "success")
    errors = sum(1 for r in results if r.get("status") == "error")
    skipped = sum(1 for r in results if r.get("status") == "skipped")

    summary = {
        "success": success,
        "errors": errors,
        "skipped": skipped,
        "total": len(results),
    }

    final_status = "success" if errors == 0 else "partial"
    emit(
        cb,
        key,
        f"Finished: {success} success, {errors} errors, {skipped} skipped",
        status=final_status,
        summary=summary,
    )


@app.post("/internal/run")
def internal_run(
    payload: RunRequest,
    background_tasks: BackgroundTasks,
    x_internal_key: Optional[str] = Header(default=None),
):
    verify_key(x_internal_key)

    global _running
    with _lock:
        if _running >= MAX_CONCURRENT:
            raise HTTPException(status_code=429, detail="Too many concurrent jobs")
        _running += 1

    def wrapped():
        global _running
        try:
            run_job(payload)
        finally:
            with _lock:
                _running -= 1

    background_tasks.add_task(wrapped)
    return {"accepted": True, "jobId": payload.jobId}
