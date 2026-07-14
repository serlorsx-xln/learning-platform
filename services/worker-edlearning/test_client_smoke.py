#!/usr/bin/env python3
"""Optional smoke test — requires EDLEARNING_USERNAME and EDLEARNING_PASSWORD in env."""

import os
import sys

from app.client import EdClient


def main():
    username = os.environ.get("EDLEARNING_USERNAME")
    password = os.environ.get("EDLEARNING_PASSWORD")
    school = os.environ.get("EDLEARNING_SCHOOL", "ru")
    education_id = os.environ.get("EDLEARNING_EDUCATION_ID", "ed22")

    if not username or not password:
        print("Set EDLEARNING_USERNAME and EDLEARNING_PASSWORD to run smoke test.")
        sys.exit(1)

    client = EdClient(school, education_id)
    if not client.login(username, password):
        print("Login failed")
        sys.exit(1)

    modules = client.get_course_tree()
    print(f"Login OK — {len(modules)} modules")
    if modules:
        first_id = modules[0]["NodeId"]
        print(f"Running pipeline for module {first_id} (tasks only, 0 minutes)")
        summary = client.run_module_pipeline([first_id], minutes_to_add=0, on_event=print)
        print("Summary:", summary)


if __name__ == "__main__":
    main()
