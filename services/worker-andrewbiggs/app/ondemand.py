import logging
from httpx import Client
from bs4 import BeautifulSoup
from re import sub
from json import dumps, loads
from time import time, sleep
from random import gauss, uniform
from math import floor

logger = logging.getLogger("ondemand")

class Ondemand(Client):
    def __init__(self):
        super().__init__(
            default_encoding="utf-8",
            base_url="https://ondemand.andrewbiggs.com",
            follow_redirects=True
        )

        self.headers.update({
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "accept-language": "en-US,en;q=0.9",
            "cache-control": "max-age=0",
            "content-type": "application/x-www-form-urlencoded",
            "priority": "u=0, i",
            "sec-ch-ua": "\"Chromium\";v=\"146\", \"Not-A.Brand\";v=\"24\", \"Google Chrome\";v=\"146\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"macOS\"",
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "same-origin",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1",
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
        })

    def login(self, username: str, password: str):
        try:
            logger.info("[AUTH] Attempting login for: %s", username)
            request = self.post("/wp-login.php", data="log=%s&pwd=%s&wp-submit=Log+In" % (username, password))
            if "wp-login.php" not in str(request.url):
                logger.info("[AUTH] Login successful for: %s", username)
                return True
            logger.warning("[AUTH] Login failed for: %s (Invalid credentials)", username)
            return False
        except Exception as e:
            logger.error("[ERROR] Connection error during login for %s: %s", username, str(e))
            return False
    
    def get_profile_name(self):
        try:
            request = self.get("/my-account/")
            soup = BeautifulSoup(request.text, "html.parser")
            desc_tag = soup.find("meta", {"property": "og:description"})
            if not desc_tag:
                return "Unknown User"
            description = desc_tag["content"]
            return description.split("Hello ")[1].split(" ")[0]
        except Exception as e:
            logger.error("[ERROR] Failed to parse profile name: %s", str(e))
            return "Unknown User"

    def get_course_content(self, url: str):
        try:
            request = self.get(url)
            soup = BeautifulSoup(request.text, "html.parser")
            items = soup.find_all("div", {"class": "ld-item-list-item-preview"})
            for item in items:
                yield item.find("a", {"class": "ld-item-name"})["href"]
        except Exception as e:
            logger.error("[ERROR] Failed to fetch course content from %s: %s", url, str(e))

    def get_enrolled_courses(self) -> list[dict]:
        courses: list[dict] = []
        seen: set[str] = set()
        for path in ["/my-account/", "/courses/"]:
            try:
                request = self.get(path)
                soup = BeautifulSoup(request.text, "html.parser")
                for anchor in soup.find_all("a", href=True):
                    href = anchor["href"]
                    if "/courses/" not in href:
                        continue
                    full = href if href.startswith("http") else f"{self.base_url.rstrip('/')}{href}" if href.startswith("/") else href
                    if full in seen:
                        continue
                    parts = [p for p in full.split("/") if p]
                    if len(parts) < 4:
                        continue
                    seen.add(full)
                    title = anchor.get_text(strip=True) or parts[-2].replace("-", " ")
                    courses.append({"url": full, "title": title})
            except Exception as e:
                logger.error("[ERROR] Failed to list courses from %s: %s", path, str(e))
        return courses

    def inspect_course(self, url: str) -> dict:
        request = self.get(url)
        soup = BeautifulSoup(request.text, "html.parser")
        title_tag = soup.find("h1")
        lessons = []
        items = soup.find_all("div", class_=lambda c: c and "ld-item-list-item" in c)
        for item in items:
            link = item.find("a", class_="ld-item-name")
            if not link or not link.get("href"):
                continue
            href = link["href"]
            full_url = href if href.startswith("http") else f"{self.base_url.rstrip('/')}{href}" if href.startswith("/") else href
            classes = " ".join(item.get("class", []))
            is_complete = "learndash-complete" in classes or "ld-status-complete" in classes
            lessons.append({
                "url": full_url,
                "title": link.get_text(strip=True) or full_url,
                "isComplete": is_complete,
            })
        complete = sum(1 for lesson in lessons if lesson["isComplete"])
        total = len(lessons)
        return {
            "url": url,
            "title": title_tag.get_text(strip=True) if title_tag else url,
            "lessons": lessons,
            "totalLessons": total,
            "completeLessons": complete,
            "incompleteLessons": total - complete,
            "isComplete": total > 0 and complete == total,
            "status": "complete" if total > 0 and complete == total else ("in_progress" if complete > 0 else "not_started"),
        }

    def get_quiz_data(self, url: str):
        try:
            lesson_resp = self.get(url)
            lesson_soup = BeautifulSoup(lesson_resp.text, "html.parser")
            quiz_url = None
            topic_list = lesson_soup.find("div", class_="ld-lesson-topic-list")
            if topic_list:
                for a in topic_list.find_all("a"):
                    href = a.get("href", "")
                    if "/quizzes/" in href:
                        quiz_url = href
                        break
                        
            if not quiz_url:
                quizzes_url = url.replace("/lessons/", "/quizzes/")
                quiz_url = sub(r'episode-\d+-', 'quiz-', quizzes_url)

            request = self.get(quiz_url)

            soup = BeautifulSoup(request.text, "html.parser")
            script = soup.find("script", string=lambda s: s and "wpProQuizFront" in s)
            if (script is None):
                return None, None, None, None, None, None, None, None
            
            script_str = script.string
            quiz_id = script_str.split("quizId: ")[1].split(",")[0]
            quiz_nonce = script_str.split("quiz_nonce: '")[1].split("'")[0]
            quiz_post_id = script_str.split("quiz: ")[1].split(",")[0]
            course_id = script_str.split("course_id: ")[1].split(",")[0]
            lesson_id_from_script = script_str.split("lesson_id: ")[1].split(",")[0].strip() if "lesson_id: " in script_str else "0"
            topic_id = script_str.split("topic_id: ")[1].split(",")[0].strip() if "topic_id: " in script_str else "0"

            questions = []
            list_items = soup.find_all("li", {"class": "wpProQuiz_listItem"})
            for item in list_items:
                meta_str = item.get("data-question-meta")
                if meta_str:
                    meta = loads(meta_str)
                    options = item.find_all("li", {"class": "wpProQuiz_questionListItem"})
                    meta['option_count'] = len(options)
                    questions.append(meta)

            return quiz_id, quiz_nonce, course_id, quiz_post_id, questions, lesson_id_from_script, topic_id, quiz_url

        except Exception as e:
            logger.error("[ERROR] Exception in get_quiz_data for URL %s: %s", url, str(e))
            return None, None, None, None, None, None, None, None

    def solve_quiz(self, url: str):
        try:
            result = self._solve_quiz_internal(url)
            if result["status"] == "success":
                logger.info("[SUCCESS] Quiz solved and progress updated: %s", url)
            else:
                logger.error("[ERROR] Could not complete lesson %s: %s", url, result.get("error"))
            return result
        except Exception as e:
            logger.error("[FATAL] Unhandled Exception solving %s: %s", url, str(e))
            return {"status": "error", "error": "System Error: %s" % str(e), "url": url}

    def _solve_quiz_internal(self, url: str):
        quiz_id, quiz_nonce, course_id, quiz_post_id, questions, lesson_id, topic_id, quiz_url = self.get_quiz_data(url)
        if not quiz_id or not questions:
            return {"status": "skipped", "error": "No quiz found on page", "url": url}

        self.post("/wp-admin/admin-ajax.php", data={
            "action": "wp_pro_quiz_load_quiz_data",
            "quizId": quiz_id,
            "quiz_nonce": quiz_nonce,
            "quiz": quiz_post_id,
            "course_id": course_id
        })

        dummy_responses = {}
        for q in questions:
            q_id = str(q['question_pro_id'])
            resp_dict = {str(i): (True if i == 0 else False) for i in range(q['option_count'])}
            dummy_responses[q_id] = {
                "response": resp_dict,
                "question_pro_id": q['question_pro_id'],
                "question_post_id": q['question_post_id']
            }

        dummy_request = self.post("/wp-admin/admin-ajax.php", data={
            "action": "ld_adv_quiz_pro_ajax",
            "func": "checkAnswers",
            "data[quizId]": quiz_id,
            "data[quiz]": quiz_post_id,
            "data[course_id]": course_id,
            "data[quiz_nonce]": quiz_nonce,
            "data[responses]": dumps(dummy_responses)
        })

        if dummy_request.status_code != 200:
            return {"status": "error", "error": "Phase 1 Failed. HTTP %s" % dummy_request.status_code, "url": url}

        quiz_id, quiz_nonce, course_id, quiz_post_id, questions, lesson_id, topic_id, quiz_url = self.get_quiz_data(url)

        self.post("/wp-admin/admin-ajax.php", data={
            "action": "wp_pro_quiz_load_quiz_data",
            "quizId": quiz_id,
            "quiz_nonce": quiz_nonce,
            "quiz": quiz_post_id,
            "course_id": course_id
        })

        question_times = [max(120, min(1200, floor(gauss(300, 120)))) for _ in questions]
        total_quiz_time = sum(question_times) + floor(uniform(180, 600))

        try:
            answers_data = loads(dummy_request.text)
        except Exception as e:
            return {"status": "error", "error": "JSON Parser Error: %s" % str(e), "url": url}

        if not isinstance(answers_data, dict):
            return {"status": "error", "error": "Invalid response structure", "url": url}
        
        correct_responses = {}
        final_results = {}
        
        for idx, (q_pro_id, details) in enumerate(answers_data.items()):
            correct_mask = details['e']['c']
            resp_obj = {str(i): bool(val) for i, val in enumerate(correct_mask)}
            correct_responses[q_pro_id] = {
                "response": resp_obj,
                "question_pro_id": int(q_pro_id),
                "question_post_id": details.get('question_post_id', 0)
            }
            q_time = question_times[idx] if idx < len(question_times) else 60
            final_results[q_pro_id] = {
                "time": q_time,
                "points": 1,
                "p_nonce": details['p_nonce'],
                "correct": 1,
                "data": {str(i): (1 if val else 0) for i, val in enumerate(correct_mask)},
                "a_nonce": details['a_nonce'],
                "possiblePoints": 1
            }

        phase3_request = self.post("/wp-admin/admin-ajax.php", data={
            "action": "ld_adv_quiz_pro_ajax",
            "func": "checkAnswers",
            "data[quizId]": quiz_id,
            "data[quiz]": quiz_post_id,
            "data[course_id]": course_id,
            "data[quiz_nonce]": quiz_nonce,
            "data[responses]": dumps(correct_responses)
        })

        try:
            phase3_data = loads(phase3_request.text)
            if isinstance(phase3_data, dict):
                for q_pro_id, details in phase3_data.items():
                    if q_pro_id in final_results:
                        final_results[q_pro_id]['a_nonce'] = details.get('a_nonce', final_results[q_pro_id]['a_nonce'])
                        final_results[q_pro_id]['p_nonce'] = details.get('p_nonce', final_results[q_pro_id]['p_nonce'])
        except Exception:
            pass

        quiz_end_ts = int(time() * 1000)
        quiz_start_ts = quiz_end_ts - (total_quiz_time * 1000)

        final_results["comp"] = {
            "points": len(question_times),
            "correctQuestions": len(question_times),
            "quizTime": total_quiz_time,
            "quizEndTimestamp": quiz_end_ts,
            "quizStartTimestamp": quiz_start_ts,
            "result": 100,
            "cats": {"0": 100}
        }

        complete_request = self.post("/wp-admin/admin-ajax.php", data={
            "action": "wp_pro_quiz_completed_quiz",
            "course_id": course_id,
            "lesson_id": lesson_id,
            "topic_id": topic_id,
            "quiz": quiz_post_id,
            "quizId": quiz_id,
            "results": dumps(final_results),
            "timespent": total_quiz_time,
            "quiz_nonce": quiz_nonce
        })

        if complete_request.status_code != 200:
            return {"status": "error", "error": "Phase 4 Failed. HTTP %s" % complete_request.status_code, "url": url}

        redirect_url = "%s?quiz_redirect=1&quiz_id=%s" % (quiz_url, quiz_post_id)
        self.get(redirect_url)

        return {"status": "success", "url": url}

