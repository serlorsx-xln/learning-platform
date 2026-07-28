"""EdLearning client — ported from edlearning/main.go for worker use."""

from __future__ import annotations

import json
import os
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Callable
from urllib.parse import quote

import httpx

MAX_RETRY = int(os.environ.get("MAX_RETRY", "10000"))
MAX_CONCURRENT = int(os.environ.get("MAX_CONCURRENT", "100"))
PING_INTERVAL = int(os.environ.get("PING_INTERVAL", "60"))


def parse_cookie(value: str) -> dict[str, str]:
    result: dict[str, str] = {}
    if not value:
        return result
    for part in value.split("^"):
        if "*" in part:
            key, val = part.split("*", 1)
            result[key] = val
    return result


class EdClient:
    def __init__(self, school: str, education_id: str):
        self.school = school
        self.education_id = education_id
        self.base_url = "https://edwebservices2.engdis.com/api"
        # httpx.Client is not thread-safe; keep a main client + per-thread clones.
        self._main = httpx.Client(timeout=30.0, follow_redirects=True)
        self._tls = threading.local()
        self.tab = str(uuid.uuid4())
        self.token = ""
        self.info: dict[str, Any] = {}
        self.course_id = 0

    def _http(self) -> httpx.Client:
        client = getattr(self._tls, "client", None)
        if client is None:
            client = httpx.Client(timeout=30.0, follow_redirects=True)
            client.cookies.update(self._main.cookies)
            self._tls.client = client
        return client

    def _headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "Origin": f"https://{self.education_id}.engdis.com",
            "Referer": f"https://{self.education_id}.engdis.com/",
            "User-Agent": "Mozilla/5.0",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def login(self, username: str, password: str) -> bool:
        domain = f"{self.education_id}.engdis.com/{self.school}"
        resp = self._main.get(f"https://{domain}")
        community_value = ""
        for cookie in resp.cookies.jar:
            if cookie.name == "Community":
                community_value = cookie.value
                break
        comm = parse_cookie(community_value)

        login_body = {
            "CommunityVersion": comm.get("CommunityVersion"),
            "InstitutionId": comm.get("IID"),
            "Password": password,
            "UserName": username,
            "needOptIn": True,
            "cannonicalDomain": domain,
        }
        url = (
            f"{self.base_url}/Auth/ForceLogin/?CommunityVersion={comm.get('CommunityVersion')}"
            f"&needOptIn=true&cannonicalDomain={quote(domain, safe='')}"
        )
        resp = self._main.post(url, json=login_body, headers=self._headers())
        if resp.status_code != 200:
            return False
        data = resp.json()
        self.info = data.get("UserInfo", {})
        self.token = self.info.get("Token", "")
        return bool(self.token)

    def get_course_tree(self) -> list[dict[str, Any]]:
        resp = self._http().get(
            f"{self.base_url}/CourseTree/GetDefaultCourseProgress",
            headers=self._headers(),
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        tree = data.get("CourseProgressTree", {})
        self.course_id = tree.get("NodeId") or data.get("CourseId") or 0
        return tree.get("Children", [])

    def analyze_module(self, module: dict[str, Any]) -> dict[str, Any]:
        progress = float(module.get("Progress", 0) or 0)
        children = self.get_user_node_progress(module["NodeId"])
        total_lessons = len(children)
        complete_lessons = sum(1 for c in children if float(c.get("Progress", 0) or 0) >= 1.0)
        incomplete_lessons = total_lessons - complete_lessons
        is_complete = progress >= 1.0 or (total_lessons > 0 and incomplete_lessons == 0)

        if is_complete:
            status = "complete"
        elif progress > 0 or complete_lessons > 0:
            status = "in_progress"
        else:
            status = "not_started"

        return {
            "nodeId": module.get("NodeId"),
            "name": module.get("Name"),
            "progress": progress,
            "lessonCount": total_lessons,
            "completeLessons": complete_lessons,
            "incompleteLessons": incomplete_lessons,
            "isComplete": is_complete,
            "status": status,
        }

    def get_user_node_progress(self, particle_id: int) -> list[dict[str, Any]]:
        url = f"{self.base_url}/CourseTree/GetUserNodeProgress/{self.course_id}"
        body = [{
            "ParticleId": particle_id,
            "NodeType": 2,
            "LockedNodes": None,
            "particleHasProgress": True,
            "lowestNodeType": 5,
        }]
        resp = self._http().post(url, json=body, headers=self._headers())
        if resp.status_code != 200:
            return []
        data = resp.json()
        if data and isinstance(data, list):
            return data[0].get("Children", [])
        return []

    def set_progress_per_task(self, item_id: int) -> bool:
        url = f"{self.base_url}/Progress/SetProgressPerTask"
        body = {"CourseId": self.course_id, "ItemId": item_id}
        for attempt in range(MAX_RETRY):
            try:
                resp = self._http().post(url, json=body, headers=self._headers())
                if resp.status_code == 201:
                    return True
            except httpx.HTTPError:
                if attempt + 1 >= MAX_RETRY:
                    return False
                time.sleep(0.05)
                continue
        return False

    def start_lesson(self, lesson_id: int, session_id: str) -> bool:
        url = f"{self.base_url}/Progress/SetTimeOnLesson/"
        body = {
            "StudentId": self.info.get("StudentID"),
            "LessonId": lesson_id,
            "CourseId": self.course_id,
            "UserSessionId": self.info.get("SessionID"),
            "TimeStamp": int(time.time() * 1000),
            "TabId": self.tab,
            "LessonSessionId": session_id,
            "Status": "S",
        }
        resp = self._http().post(url, json=body, headers=self._headers())
        return resp.status_code == 201

    def ping(self, session_id: str) -> bool:
        url = f"{self.base_url}/Ping/Ping?lessonSessionId={session_id}"
        resp = self._http().put(url, headers=self._headers())
        return resp.status_code == 200

    def update_progress(self, lesson_id: int, unit_id: int, session_id: str) -> bool:
        url = f"{self.base_url}/Progress/SetUserCourseUnitComponentProgress"
        body = {
            "CourseId": self.course_id,
            "UnitId": unit_id,
            "ComponentId": str(lesson_id),
            "lessonSessionId": session_id,
        }
        resp = self._http().put(url, json=body, headers=self._headers())
        return resp.status_code == 201

    def get_lesson_data(self, lesson_code: str) -> dict[str, Any] | None:
        url = f"https://static.engdis.com/edprod01/edprod//Runtime/Lessons/{lesson_code}.js"
        resp = self._http().get(url, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200:
            return None
        content = resp.text
        for pattern in ("var lesson = ", "var lesson="):
            idx = content.find(pattern)
            if idx == -1:
                continue
            start = idx + len(pattern)
            while start < len(content) and content[start] in " \n\r\t":
                start += 1
            depth = 0
            for i in range(start, len(content)):
                if content[i] == "{":
                    depth += 1
                elif content[i] == "}":
                    depth -= 1
                    if depth == 0:
                        return json.loads(content[start : i + 1])
        return None

    def get_test_item_from_static(self, res_path: str, item_code: str) -> dict[str, Any] | None:
        parts = res_path.split("/")
        content_type = parts[1] if len(parts) >= 2 else "Vocabulary"

        lesson_code_base = item_code
        if len(item_code) >= 6:
            for i in range(6, len(item_code)):
                if item_code[i].isdigit():
                    lesson_code_base = item_code[: i - 1]
                    break
            if lesson_code_base == item_code and len(item_code) > 6:
                lesson_code_base = item_code[:6]

        url = (
            f"https://static.engdis.com/edprod01/edprod//Runtime/Content/"
            f"{content_type}/{lesson_code_base}/{item_code}.js"
        )
        resp = self._http().get(
            url,
            headers={
                "User-Agent": "Mozilla/5.0",
                "Referer": f"https://{self.education_id}.engdis.com/",
            },
        )
        if resp.status_code != 200:
            return None
        return resp.json()

    def save_user_test(self, unit_id: int, lesson_id: int, items: list[dict], time_ms: int = 30000):
        url = f"{self.base_url}/UserTestV1/SaveUserTest/{unit_id}/{lesson_id}/true"
        resp = self._http().post(url, json={"a": items, "t": time_ms}, headers=self._headers())
        if resp.status_code != 200:
            return None
        return resp.json()

    @staticmethod
    def get_code(node: dict[str, Any]) -> str:
        meta = node.get("Metadata") or {}
        return meta.get("Code", "")

    @staticmethod
    def has_test_without_grade(node: dict[str, Any]) -> bool:
        for child in node.get("Children", []):
            if child.get("CourseNodeType") == 4 and child.get("Name") == "Test":
                if child.get("Grade") is None:
                    return True
        return False

    @staticmethod
    def collect_leaves(nodes: list[dict], unit_id: int, out: list[dict]):
        for node in nodes:
            if node.get("Progress", 0) >= 1.0:
                continue
            if not node.get("Children"):
                out.append({"nodeId": node["NodeId"], "unitId": unit_id, "name": node.get("Name", "")})
            else:
                EdClient.collect_leaves(node["Children"], unit_id, out)

    @staticmethod
    def get_test_items(lesson: dict[str, Any]) -> list[dict]:
        items = []
        for step in lesson.get("steps", []):
            if step.get("type") == "3" or step.get("Name") == "Test":
                for task in step.get("tasks", []):
                    items.append({"itemId": task["id"], "itemCode": task["code"], "itemType": task["type"]})
        return items

    @staticmethod
    def build_correct_answers(static_item: dict, item_id: str, item_code: str, item_type: str) -> dict:
        answers = []
        all_ids = [int(d["id"]) for d in static_item.get("d", []) if "id" in d]
        for q in static_item.get("q", []):
            for al in q.get("al", []):
                if not al.get("a"):
                    continue
                for a in al["a"]:
                    all_ids.append(int(a["id"]))
        first = True
        for q in static_item.get("q", []):
            for al in q.get("al", []):
                if not al.get("a"):
                    continue
                correct = int(al["a"][0]["id"])
                for a in al["a"]:
                    if a.get("c") == "1":
                        correct = int(a["id"])
                        break
                ua = {"qId": int(q["id"]), "aId": [[int(al["id"]), correct]], "bId": all_ids if first else []}
                first = False
                answers.append(ua)
        return {"iId": item_id, "iCode": item_code, "iType": item_type, "ua": answers}

    def find_res_path(self, lesson_data: dict[str, Any]) -> str:
        for res in lesson_data.get("Resources", []):
            if res.get("type") == "0" and str(res.get("resPath", "")).endswith(".js"):
                return res["resPath"]

        res_sets = lesson_data.get("resSets") or {}
        for step in lesson_data.get("steps", []):
            if step.get("type") == "3" or step.get("Name") == "Test":
                for task in step.get("tasks", []):
                    for link in task.get("resLink", []):
                        res_set = res_sets.get(link)
                        if res_set:
                            for res in res_set.get("Resources", []):
                                if res.get("type") == "0" and str(res.get("resPath", "")).endswith(".js"):
                                    return res["resPath"]

        for res_set in res_sets.values():
            for res in res_set.get("Resources", []):
                if res.get("type") == "0" and str(res.get("resPath", "")).endswith(".js"):
                    return res["resPath"]

        return ""

    def _fetch_submit_item(self, res_path: str, test_item: dict) -> dict | None:
        static = self.get_test_item_from_static(res_path, test_item["itemCode"])
        if not static:
            return None
        return self.build_correct_answers(
            static, test_item["itemId"], test_item["itemCode"], test_item["itemType"]
        )

    def run_module_pipeline(
        self,
        module_ids: list[int],
        minutes_to_add: int = 0,
        mode: str = "full",
        on_event: Callable[[str], None] | None = None,
    ) -> dict[str, Any]:
        def emit(message: str):
            if on_event:
                on_event(message)

        modules = self.get_course_tree()
        if mode == "time_only":
            selected = modules
            if minutes_to_add <= 0:
                emit("No minutes requested - skipped")
                return {
                    "mode": "time_only",
                    "tasksSubmitted": 0,
                    "tasksTotal": 0,
                    "testsSubmitted": 0,
                    "averageTestScore": 0,
                    "minutesAdded": 0,
                }
            emit(f"Time-only mode - pinging lessons across {len(selected)} modules")
            minutes_added = self._run_time_phase(selected, {}, minutes_to_add, emit)
            return {
                "mode": "time_only",
                "tasksSubmitted": 0,
                "tasksTotal": 0,
                "testsSubmitted": 0,
                "averageTestScore": 0,
                "minutesAdded": minutes_added,
            }

        selected = [m for m in modules if m.get("NodeId") in module_ids]
        module_cache: dict[int, list[dict]] = {}
        all_tasks: list[dict] = []

        for mod in selected:
            children = self.get_user_node_progress(mod["NodeId"])
            module_cache[mod["NodeId"]] = children
            self.collect_leaves(children, mod["NodeId"], all_tasks)

        emit(f"Phase 1: submitting {len(all_tasks)} tasks (max {MAX_CONCURRENT} concurrent)")

        task_ok = 0
        with ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as pool:
            futures = {pool.submit(self.set_progress_per_task, t["nodeId"]): t for t in all_tasks}
            for future in as_completed(futures):
                try:
                    if future.result():
                        task_ok += 1
                except Exception as exc:
                    emit(f"Task submit error: {exc}")

        emit(f"Tasks complete: {task_ok}/{len(all_tasks)}")

        tests_submitted = 0
        total_score = 0
        lessons_for_tests: list[tuple[int, dict, dict, list[dict], str]] = []

        for unit_id, children in module_cache.items():
            for lesson in children:
                code = self.get_code(lesson)
                if not code:
                    continue
                needs = lesson.get("Progress", 0) < 1.0 or self.has_test_without_grade(lesson)
                if not needs:
                    continue
                lesson_data = self.get_lesson_data(code)
                if not lesson_data:
                    continue
                test_items = self.get_test_items(lesson_data)
                res_path = self.find_res_path(lesson_data)
                if not test_items or not res_path:
                    continue
                lessons_for_tests.append((unit_id, lesson, lesson_data, test_items, res_path))

        emit(f"Phase 2: auto-submitting tests for {len(lessons_for_tests)} lessons")

        for unit_id, lesson, lesson_data, test_items, res_path in lessons_for_tests:
            emit(f"Fetching answers for {lesson.get('Name')} ({len(test_items)} items)")

            submit_items: list[dict] = []
            with ThreadPoolExecutor(max_workers=min(MAX_CONCURRENT, len(test_items) or 1)) as pool:
                futures = [
                    pool.submit(self._fetch_submit_item, res_path, ti) for ti in test_items
                ]
                for future in as_completed(futures):
                    try:
                        item = future.result()
                    except Exception as exc:
                        emit(f"Answer fetch error: {exc}")
                        continue
                    if item:
                        submit_items.append(item)

            if not submit_items:
                emit(f"No answers fetched for {lesson.get('Name')}",)
                continue

            lesson_id_raw = lesson_data.get("id")
            try:
                lesson_id = int(lesson_id_raw)
            except (TypeError, ValueError):
                lesson_id = lesson["NodeId"]

            result = self.save_user_test(unit_id, lesson_id, submit_items)
            if result:
                tests_submitted += 1
                total_score += result.get("finalMark", 0)
                emit(f"Test submitted: {lesson.get('Name')} - {result.get('finalMark')}%")

        minutes_added = 0
        if minutes_to_add > 0:
            time_cache = dict(module_cache)
            for mod in modules:
                if mod["NodeId"] not in time_cache:
                    time_cache[mod["NodeId"]] = self.get_user_node_progress(mod["NodeId"])
            emit(f"Adding time across all {len(modules)} modules in course")
            minutes_added = self._run_time_phase(modules, time_cache, minutes_to_add, emit)

        return {
            "mode": "full",
            "tasksSubmitted": task_ok,
            "tasksTotal": len(all_tasks),
            "testsSubmitted": tests_submitted,
            "averageTestScore": (total_score // tests_submitted) if tests_submitted else 0,
            "minutesAdded": minutes_added,
        }

    def _run_time_phase(
        self,
        selected: list[dict[str, Any]],
        module_cache: dict[int, list[dict]],
        minutes_to_add: int,
        emit: Callable[[str], None],
    ) -> int:
        emit(f"Phase 3: adding {minutes_to_add} study minutes")
        lessons: list[dict] = []
        for mod in selected:
            children = module_cache.get(mod["NodeId"])
            if children is None:
                children = self.get_user_node_progress(mod["NodeId"])
            parent_id = mod["NodeId"]
            if children:
                parent_id = children[0].get("ParentNodeId") or mod["NodeId"]
                if parent_id == 0:
                    parent_id = mod["NodeId"]
            for lesson in children or []:
                lessons.append({
                    "nodeId": lesson["NodeId"],
                    "parentId": parent_id,
                    "name": lesson.get("Name"),
                })

        n_all = len(lessons)
        if not n_all:
            emit("No lessons available for time ping")
            return 0

        n_rounds = (minutes_to_add + n_all - 1) // n_all
        n_needed = n_all if minutes_to_add >= n_all else minutes_to_add
        sessions = [
            {
                "lessonId": lessons[i]["nodeId"],
                "unitId": lessons[i]["parentId"],
                "id": str(uuid.uuid4()),
                "name": lessons[i]["name"],
            }
            for i in range(n_needed)
        ]

        started = 0
        for s in sessions:
            if self.start_lesson(s["lessonId"], s["id"]):
                started += 1
        emit(f"Started {started}/{len(sessions)} lesson sessions for time ping")

        minutes_added = 0
        remaining = minutes_to_add
        for round_idx in range(n_rounds):
            n = remaining if remaining < n_needed else n_needed
            time.sleep(PING_INTERVAL)
            ping_ok = 0
            for i in range(n):
                if self.ping(sessions[i]["id"]):
                    ping_ok += 1
            minutes_added += ping_ok
            remaining -= n
            emit(
                f"Ping round {round_idx + 1}/{n_rounds}: +{ping_ok} | total {minutes_added}/{minutes_to_add}"
            )

        updated = 0
        for s in sessions:
            if self.update_progress(s["lessonId"], s["unitId"], s["id"]):
                updated += 1
        emit(f"Updated progress for {updated}/{len(sessions)} sessions")
        return minutes_added
