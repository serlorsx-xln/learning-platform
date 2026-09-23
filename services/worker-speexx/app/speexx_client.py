from httpx import Client
from bs4 import BeautifulSoup
from json import loads, dumps
from Crypto.Cipher import Blowfish
from Crypto.Util.Padding import pad
from base64 import b64encode
from time import time, sleep
from random import randint
import re


class speexx(Client):
    BASE_URL = 'https://portal.speexx.com'
    HEADERS = {
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'accept-language': 'th,en;q=0.9,en-GB;q=0.8,en-US;q=0.7',
        'sec-ch-ua': '\"Microsoft Edge\";v=\"130\", \"Not=A?Brand\";v=\"8\", \"Chromium\";v=\"130\"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '\"Windows\"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'x-requested-with': 'XMLHttpRequest',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0'
    }

    def __init__(self, cookies=None):
        super().__init__(
            base_url=self.BASE_URL,
            headers=self.HEADERS,
            cookies=cookies,
            timeout=None
        )

    def blowfish_encrypt(self, key, plaintext):
        cipher = Blowfish.new(key, Blowfish.MODE_ECB)
        padded_text = pad(plaintext.encode('utf-8'), Blowfish.block_size)
        encrypted_data = cipher.encrypt(padded_text)
        encrypted_data_b64 = b64encode(encrypted_data).decode('utf-8')
        
        return encrypted_data_b64

    def _parse_jv_data(self, content, key):
        soup = BeautifulSoup(content, 'html.parser')
        scripts = soup.find('script', attrs={'src': False})

        if (not scripts):
            return True

        if (scripts.string):
            match = re.search(r'jv\["%s"\]\s*=\s*("([^"]+)"|(\[.*?\])|(\{.*?\})|{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*});' % (key), scripts.string)
            if (match):
                return match.group(1)

    def _login_username_check(self, username):
        return self.get('/login/username-check?userName=%s' % (username)).json()

    def _handle_login(self, username, password):
        return self.post('/login', data={
            'password': password,
            'userName': username,
            'redirect': ''
        }).text
    
    def login(self, username, password):
        checked = self._login_username_check(username)
        true_username = checked.get('trueUserName')
        if (true_username):
            self._handle_login(true_username, password)
    
    def is_logged_in(self):
        # Any non-empty cookie map counts as a session; keys are user-defined.
        return bool(self.cookies)
    
    def get_article_id(self):
        return self.get('/', follow_redirects=True).url.path.split('/')[-1]
    
    def get_article(self, article_id):
        return self.get('/articles/%s' % (article_id), follow_redirects=True).text

    def get_article_results(self, article_id):
        return self.get('/articles/%s/results' % (article_id)).text
    
    def get_current_activity(self, results):
        currentLevelBean = self._parse_jv_data(results, 'currentLevelBean')
        current_id = loads(currentLevelBean).get('id')

        return current_id
    
    def get_article_activities(self, article_id):
        results = self.get_article_results(article_id)
        activity_id = self.get_current_activity(results)

        self.headers.update({
            'csrf': self._parse_jv_data(results, 'csrf').replace('"', '')
        })

        return self.get('/articles/%s/results/%s/activity' % (article_id, activity_id)).json()
    
    def get_activity_folder(self, article_id, packet):
        return self.get('/articles/%s/%s?goBackTo=/articles/%s/results' % (article_id, packet, article_id)).text

    def activity_folder_info(self, article_id, packet, folder_id):
        return self.get('/articles/%s/%s/folders/%s' % (article_id, packet, folder_id)).json()

    def submit_exercise(self, article_id, packet, folder_id, exercise_id, rsa):
        return self.put('/articles/%s/%s/folders/%s/exercises/%s' % (article_id, packet, folder_id, exercise_id), json={'rsa': rsa}).json()

    def submit_certificate(self, article_id, exercise_id, rsa):
        return self.put('/articles/%s/level-test/exercises/%s' % (article_id, exercise_id), json={'rsa': rsa}).json()

    def refresh_packets(self, article_id):
        self.get('/articles/%s/subscription-packets?&_=%s' % (article_id, (time() * 1000)))
        self.get('/articles/%s/get-progress-and-average' % (article_id))

    def get_exam_exercises_folder(self, article_id):
        return self.get('/articles/%s/level-test' % (article_id)).text

    def get_exercise(self, article_id, packet, folder_id, exercise_id):
        return self.get('/articles/%s/%s/folders/%s/exercises/%s' % (article_id, packet, folder_id, exercise_id)).json()

    def get_exam_exercise(self, article_id, exercise_id):
        return self.get('/articles/%s/level-test/exercises/%s' % (article_id, exercise_id)).json()

    def next_level(self, article_id):
        return self.post('/articles/%s/next-level' % (article_id)).json()

    def start_certificate(self, article_id):
        self.get_article_activities(article_id)

        exam_exercises_folder = self.get_exam_exercises_folder(article_id)
        exam_exercises = self._parse_jv_data(exam_exercises_folder, 'test')

        if (exam_exercises is not True):
            for exercise in loads(exam_exercises).get('exercises'):
                exercise_result = {
                    'elapsed': randint(20, 25),
                    'result': 100
                }

                result_encrypted = self.blowfish_encrypt(str(exercise.get('student')).encode(), dumps(exercise_result))
                certificate_result = self.submit_certificate(article_id, exercise.get('id'), result_encrypted)

                print(certificate_result)

    def list_activities_status(self, article_id):
        activities = self.get_article_activities(article_id)
        exercises = activities.get("exercises", []) or []
        items = []
        for exercise in exercises:
            result = exercise.get("result")
            is_complete = result == "100" or exercise.get("completed") is True
            items.append({
                "id": exercise.get("id"),
                "title": exercise.get("title") or exercise.get("link") or str(exercise.get("id")),
                "link": exercise.get("link"),
                "result": result,
                "elapsedTime": exercise.get("elapsedTime", 0),
                "elapsedTimeFormatted": exercise.get("elapsedTimeFormatted", ""),
                "isComplete": is_complete,
                "status": "complete" if is_complete else "pending",
            })
        pending = [i for i in items if not i["isComplete"]]
        complete = [i for i in items if i["isComplete"]]
        return {
            "articleId": article_id,
            "activities": items,
            "pendingActivities": pending,
            "completeActivities": complete,
            "summary": {
                "total": len(items),
                "pending": len(pending),
                "complete": len(complete),
            },
        }

    def _count_pending_sub_exercises(self, article_id, exercises):
        """Pre-scan all pending exercises to count total sub-exercises across folders."""
        total = 0
        folders = []
        for exercise in exercises:
            if exercise.get('result') == '100':
                continue
            packet = exercise.get('link')
            try:
                folder_html = self.get_activity_folder(article_id, packet)
                packets_raw = self._parse_jv_data(folder_html, 'packets')
                if packets_raw is True or packets_raw is None:
                    continue
                packets = loads(packets_raw)
                first_packet = packets[0]
                if first_packet.get('result') == '100':
                    continue
                folder_info = self.activity_folder_info(article_id, packet, first_packet.get('id'))
                sub_exercises = folder_info.get('exercises', [])
                total += len(sub_exercises)
                folders.append({
                    'exercise': exercise,
                    'packet': packet,
                    'folder_id': first_packet.get('id'),
                    'sub_exercises': sub_exercises,
                })
            except Exception:
                continue
        return total, folders

    def start(self, article_id, target_percent=100, delay_per_folder=0, target_elapsed_seconds=None):
        target_percent = max(1, min(100, int(target_percent)))

        exercise_completed = []

        # Determine target_count from the course's real exercise total, and
        # seed exercise_completed with exercises already done before this run
        # (so "50%" means 50% of the whole course, not 50% more on top of
        # whatever was already complete).
        self.get_article(article_id)
        pre_activities = self.get_article_activities(article_id)
        pre_exercises = pre_activities.get('exercises', [])
        total_exercises = len(pre_exercises)
        already_done = [ex.get('id') for ex in pre_exercises if ex.get('result') == '100']
        exercise_completed.extend(already_done)
        target_count = max(1, int(total_exercises * target_percent / 100))
        print('course has %d exercises, %d already complete — target %d%% = %d total' % (
            total_exercises, len(already_done), target_percent, target_count))

        # If target_elapsed_seconds is set, pre-scan to compute per-sub elapsed.
        # User supplies the total hours to add; we distribute across pending
        # sub-exercises with ±30% noise so it still looks human.
        # time_budget is a HARD CAP: every submitted second decrements it, and
        # once exhausted, remaining exercises fall back to default random
        # elapsed. This guarantees the total added time never exceeds the
        # user's target even when new exercises unlock mid-run (which would
        # otherwise each carry the full base_elapsed and balloon the total).
        base_elapsed = None
        time_budget = None
        if target_elapsed_seconds is not None and target_elapsed_seconds > 0:
            self.get_article(article_id)
            activities = self.get_article_activities(article_id)
            exercises = activities.get('exercises', [])
            total_sub, _ = self._count_pending_sub_exercises(article_id, exercises)
            if total_sub > 0:
                base_elapsed = target_elapsed_seconds / total_sub
                time_budget = target_elapsed_seconds
                print('target_elapsed_seconds=%s across %d sub-exercises (base=%.1fs each)' % (
                    target_elapsed_seconds, total_sub, base_elapsed))

        while (True):
            if (target_percent != 100 and len(exercise_completed) >= target_count):
                break

            self.get_article(article_id)

            activities = self.get_article_activities(article_id)
            exercises = activities.get('exercises')

            exercises_copy = exercises.copy()
            for exercise in exercises_copy:
                if exercise.get('result') == '100':
                    exercise['completed'] = True

                    if exercise.get('id') not in exercise_completed:
                        exercise_completed.append(exercise.get('id'))

            if (not all(exercise.get('completed') for exercise in exercises_copy)):
                for exercise in exercises_copy:
                    if  (target_percent != 100 and len(exercise_completed) >= target_count):
                        break

                    if (exercise.get('id') in exercise_completed):
                        continue

                    standart_packet = exercise.get('link')
                    folder = self.get_activity_folder(article_id, standart_packet)

                    packets = loads(self._parse_jv_data(folder, 'packets'))

                    if (packets[0].get('result') != '100'):
                        folder_info = self.activity_folder_info(article_id, standart_packet, packets[0].get('id'))
                        folder_id = folder_info.get('id')
                        exercises = folder_info.get('exercises')

                        print('%s (%s) - (%s / %s)' % (
                            folder_info.get('id'),
                            folder_info.get('title'),
                            len(exercise_completed),
                            target_count
                        ))
                        for folder_exercise in folder_info.get('exercises'):
                            if time_budget is not None and time_budget > 0:
                                # distribute target with ±30% noise, floor 30s,
                                # capped by remaining budget
                                noise = randint(-30, 30) / 100.0
                                elapsed = max(30, int(base_elapsed * (1 + noise)))
                                elapsed = min(elapsed, time_budget)
                                time_budget -= elapsed
                            elif time_budget is not None:
                                # budget exhausted — minimal elapsed so the
                                # total stays close to the user's target while
                                # still completing every exercise
                                elapsed = randint(1, 5)
                            else:
                                elapsed = randint(30, 40)

                            exercise_result = {
                                'elapsed': elapsed,
                                'result':100
                            }

                            result_encrypted = self.blowfish_encrypt(str(folder_exercise.get('student')).encode(), dumps(exercise_result))
                            exercise_result = self.submit_exercise(article_id, standart_packet, folder_id, folder_exercise.get('id'), result_encrypted)

                            print(exercise_result)

                        if (delay_per_folder > 0):
                            print('sleeping for %d seconds to mimic human behavior...' % (delay_per_folder))
                            sleep(delay_per_folder)

                        exercise['completed'] = True
                        if exercise.get('id') not in exercise_completed:
                            exercise_completed.append(exercise.get('id'))

                        if (len(exercises) != 0):
                            self.refresh_packets(article_id)
            else:
                break

    def get_level_info(self, article_id):
        results = self.get_article_results(article_id)

        current_raw = self._parse_jv_data(results, 'currentLevelBean')
        current = loads(current_raw) if current_raw and current_raw is not True else {}

        next_raw = self._parse_jv_data(results, 'nextLevels')
        next_levels = []
        if next_raw and next_raw is not True:
            for nl in loads(next_raw):
                lr = nl.get('levelRange', {})
                next_levels.append({
                    'id': lr.get('id'),
                    'name': lr.get('name'),
                    'achieved': nl.get('achieved'),
                    'current': nl.get('current'),
                })

        activities = self.get_article_activities(article_id)
        total_elapsed = sum(int(ex.get('elapsedTime', 0) or 0) for ex in activities.get('exercises', []))

        # Check if current level is achieved (certificate/level test passed)
        working_raw = self._parse_jv_data(results, 'workingLevelRangeBean')
        level_achieved = False
        if working_raw and working_raw is not True:
            level_achieved = loads(working_raw).get('achieved', False)

        # Check level-test exercise completion
        level_test_finished = 0
        level_test_total = 0
        try:
            r = self.get('/articles/%s/level-test' % (article_id))
            test_data = self._parse_jv_data(r.text, 'test')
            if test_data and test_data is not True:
                test = loads(test_data)
                test_exercises = test.get('exercises', [])
                level_test_total = len(test_exercises)
                level_test_finished = sum(1 for e in test_exercises if e.get('finished'))
        except Exception:
            pass

        return {
            'currentLevel': current,
            'nextLevels': next_levels,
            'totalElapsedSeconds': total_elapsed,
            'levelAchieved': level_achieved,
            'levelTestTotal': level_test_total,
            'levelTestFinished': level_test_finished,
        }

    def go_to_next_level(self, article_id, target_level_id):
        r = self.get('/articles/%s/level-test?levelRangeId=%s' % (article_id, target_level_id))

        test_data = self._parse_jv_data(r.text, 'test')
        if test_data is True or test_data is None:
            return {'success': False, 'message': 'No test data for this level'}

        test = loads(test_data)
        exercises = test.get('exercises', [])

        for exercise in exercises:
            exercise_result = {
                'elapsed': randint(20, 25),
                'result': 100
            }

            result_encrypted = self.blowfish_encrypt(str(exercise.get('student')).encode(), dumps(exercise_result))
            self.submit_certificate(article_id, exercise.get('id'), result_encrypted)

        # Advance to the next level via the official next-level endpoint
        next_result = None
        try:
            next_result = self.next_level(article_id)
        except Exception as e:
            print('next_level() failed: %s' % (e))

        return {
            'success': True,
            'submittedTests': len(exercises),
            'targetLevelId': target_level_id,
            'nextLevelResult': next_result,
        }

