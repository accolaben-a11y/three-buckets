#!/usr/bin/env python3
"""Nightly push notification for tomorrow's Poplar Bridge Elementary lunch entree.

See school-lunch-push/README.md for the two GUIDs below and where they came from.
"""

import os
import sys
import time
from datetime import datetime, timedelta

import requests

try:
    from zoneinfo import ZoneInfo
except ImportError:  # Python < 3.9
    from backports.zoneinfo import ZoneInfo

# TODO: replace with the real GUIDs pulled from DevTools per README.md ("Getting
# the two GUIDs" section). These are not secret, just not yet filled in.
BUILDING_ID = "REPLACE_ME_BUILDING_ID"
DISTRICT_ID = "REPLACE_ME_DISTRICT_ID"

LINQ_URL = "https://api.linqconnect.com/api/FamilyMenu"
PUSHOVER_URL = "https://api.pushover.net/1/messages.json"
TIMEZONE = ZoneInfo("America/Chicago")

LINQ_MAX_ATTEMPTS = 3
LINQ_RETRY_DELAY_SECONDS = 30


def get_target_date():
    return (datetime.now(TIMEZONE) + timedelta(days=1)).date()


def format_linq_date(date):
    # api.linqconnect.com wants M-D-YYYY with no zero padding (e.g. 9-8-2026,
    # not 09-08-2026). Getting this wrong returns an empty result, not an error.
    return f"{date.month}-{date.day}-{date.year}"


def fetch_menu(date_str):
    params = {
        "buildingId": BUILDING_ID,
        "districtId": DISTRICT_ID,
        "startDate": date_str,
        "endDate": date_str,
    }

    last_error = None
    for attempt in range(1, LINQ_MAX_ATTEMPTS + 1):
        try:
            response = requests.get(LINQ_URL, params=params, timeout=10)
            if response.status_code == 200:
                return response.json()
            last_error = f"HTTP {response.status_code}: {response.text[:500]}"
        except requests.RequestException as exc:
            last_error = str(exc)

        print(f"[attempt {attempt}/{LINQ_MAX_ATTEMPTS}] LINQ request failed: {last_error}")
        if attempt < LINQ_MAX_ATTEMPTS:
            time.sleep(LINQ_RETRY_DELAY_SECONDS)

    print("ERROR: exhausted retries fetching LINQ menu", file=sys.stderr)
    sys.exit(1)


def is_entree_category(category_name):
    name = (category_name or "").lower()
    return "entree" in name or "entrée" in name


def extract_entrees(menu_json, target_date):
    """Return a list of entree recipe names for target_date's Lunch session.

    Returns an empty list for any missing/unexpected shape rather than raising,
    per spec section 5.6/9: no school tomorrow must not look like a failure.
    """
    try:
        sessions = menu_json.get("FamilyMenuSessions") or []
        for session in sessions:
            if (session.get("ServingSession") or "").strip().lower() != "lunch":
                continue

            for plan in session.get("MenuPlans") or []:
                for day in plan.get("Days") or []:
                    day_date_raw = day.get("Date") or ""
                    if not _same_date(day_date_raw, target_date):
                        continue

                    entrees = []
                    for meal in day.get("MenuMeals") or []:
                        for category in meal.get("RecipeCategories") or []:
                            if not is_entree_category(category.get("Name")):
                                continue
                            for recipe in category.get("Recipes") or []:
                                recipe_name = recipe.get("RecipeName")
                                if recipe_name:
                                    entrees.append(recipe_name)
                    return entrees
    except (AttributeError, TypeError) as exc:
        print(f"PARSE FAILURE: {exc}")
        print(f"Raw response body: {menu_json}")
        return []

    return []


def _same_date(date_str, target_date):
    # LINQ has been seen returning both "9/8/2026" and "2026-09-08T00:00:00".
    date_str = date_str.split("T")[0]
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(date_str, fmt).date() == target_date
        except ValueError:
            continue
    return False


def send_push(title, body):
    token = os.environ["PUSHOVER_TOKEN"]
    user = os.environ["PUSHOVER_USER"]

    response = requests.post(
        PUSHOVER_URL,
        data={
            "token": token,
            "user": user,
            "title": title,
            "message": body,
            "priority": 0,
        },
        timeout=10,
    )

    if response.status_code != 200:
        print(f"ERROR: Pushover returned HTTP {response.status_code}: {response.text}", file=sys.stderr)
        sys.exit(1)


def main():
    if BUILDING_ID.startswith("REPLACE_ME") or DISTRICT_ID.startswith("REPLACE_ME"):
        print("ERROR: BUILDING_ID/DISTRICT_ID are still placeholders. See README.md.", file=sys.stderr)
        sys.exit(1)

    target_date = get_target_date()
    date_str = format_linq_date(target_date)

    print(f"Fetching lunch menu for {date_str} (buildingId={BUILDING_ID})")
    menu_json = fetch_menu(date_str)

    entrees = extract_entrees(menu_json, target_date)
    if not entrees:
        print(f"No lunch entree found for {date_str}. Assuming no school / no menu published. Exiting quietly.")
        sys.exit(0)

    title = f"Lunch {target_date.strftime('%A')}"
    body = ", ".join(entrees)
    print(f"Sending push: {title} — {body}")
    send_push(title, body)
    print("Push sent.")


if __name__ == "__main__":
    main()
