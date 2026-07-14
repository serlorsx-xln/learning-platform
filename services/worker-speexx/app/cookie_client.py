from httpx import Client
from bs4 import BeautifulSoup
from threading import Thread
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
            a = self._handle_login(true_username, password)
            print(a)
    def is_logged_in(self):
        if ('AUTHENTICATION_TOKEN' in self.cookies or 'AUTH_CMRU' in self.cookies):
            return True
        return False
    
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

    def get_exercise(self, article_id, packet, folder_id, exercise_id):
        return self.get('/articles/%s/%s/folders/%s/exercises/%s' % (article_id, packet, folder_id, exercise_id)).json()

    def submit_exercise(self, article_id, packet, folder_id, exercise_id, rsa):
        return self.put('/articles/%s/%s/folders/%s/exercises/%s' % (article_id, packet, folder_id, exercise_id), json={'rsa': rsa}).json()

    def submit_certificate(self, article_id, exercise_id, rsa):
        return self.put('/articles/%s/level-test/exercises/%s' % (article_id, exercise_id), json={'rsa': rsa}).json()

    def refresh_packets(self, article_id):
        self.get('/articles/%s/subscription-packets?&_=%s' % (article_id, (time() * 1000)))
        self.get('/articles/%s/get-progress-and-average' % (article_id))

    def get_exam_exercises_folder(self, article_id):
        return self.get('/articles/%s/level-test' % (article_id)).text
    
    def get_exam_exercise(self, article_id, exercise_id):
        return self.get('/articles/%s/level-test/exercises/%s' % (article_id, exercise_id)).json()

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
    
    def next_level(self, article_id):
        return self.post('/articles/%s/next-level' % (article_id)).json()

    def start(self, article_id, target_percent=100, delay_per_folder=0):
        target_percent = max(1, min(100, int(target_percent)))
        
        target_count = max(1, int(96 * target_percent / 100))
        exercise_completed = []

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
                            exercise_result = {
                                'elapsed':randint(10, 20), 
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


def start_with_thread(profile):
    cookies = profile['cookies']

    print('Login with cookies: %s' % (cookies))

    objects = speexx(cookies=cookies)
    if (objects.is_logged_in()):
        article_id = objects.get_article_id()

        if (profile['do_activity'] is True):
            objects.start(article_id, profile['target_percent'], profile['delay_per_folder'])
        
        if (profile['test'] is True):
            objects.start_certificate(article_id)

        print('Completed all activities and certificate for article ID: %s' % (article_id))

    else:
        print('Login failed, please check your credentials.')
