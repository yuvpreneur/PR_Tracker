"""
One-time script: inserts attendance records for the last 30 days
(May 26 – June 25 2026) for all active employees, skipping weekends
and any date already present in the DB.
Run from:  prove_it_backend/prove_it_backend/
  python add_attendance.py
"""

import random
from datetime import date, timedelta
from app.core import collections
from app.core.database import db
from app.core.mongo_utils import next_id

random.seed(42)

EMPLOYEES = [
    ("EMP001", "Ravi Kumar"),
    ("EMP002", "Neha Singh"),
    ("EMP003", "Vikram Das"),
    ("EMP005", "Rohan Mehta"),
]

# Weighted status distribution per employee (status, weight)
EMP_PROFILE = {
    "EMP001": [("Present",4), ("WFH",2), ("Absent",1)],
    "EMP002": [("Present",5), ("WFH",2), ("Absent",1), ("Late",1)],
    "EMP003": [("Present",3), ("WFH",1), ("Absent",2), ("Late",1)],
    "EMP005": [("Present",5), ("WFH",3), ("Absent",1)],
}

CHECK_IN = {
    "Present": [("09:00",3),("09:05",3),("09:15",2),("09:30",1),("08:50",1)],
    "WFH":     [("09:00",4),("09:10",3),("09:30",2),("10:00",1)],
    "Late":    [("10:00",2),("10:30",2),("11:00",1)],
    "Absent":  None,
}
CHECK_OUT = {
    "Present": [("18:00",2),("18:30",3),("19:00",2),("17:45",1),("19:30",1)],
    "WFH":     [("17:30",3),("18:00",3),("18:30",2),("19:00",1)],
    "Late":    [("19:00",2),("19:30",2),("20:00",1)],
    "Absent":  None,
}

def _pick(weighted):
    items  = [v for v, w in weighted]
    weights= [w for v, w in weighted]
    return random.choices(items, weights=weights, k=1)[0]

def _hours(ci, co):
    if not ci or not co:
        return 0.0
    h1, m1 = map(int, ci.split(":"))
    h2, m2 = map(int, co.split(":"))
    return round((h2*60+m2 - h1*60-m1) / 60, 1)

def run():
    today    = date(2026, 6, 25)
    start    = date(2026, 5, 26)

    # Collect existing (emp_id, att_date) pairs to avoid duplicates
    existing = set(
        (r["emp_id"], r["att_date"])
        for r in db[collections.ATTENDANCE].find({}, {"emp_id": 1, "att_date": 1})
    )

    records = []
    d = start
    while d <= today:
        # Skip weekends
        if d.weekday() >= 5:
            d += timedelta(days=1)
            continue

        for emp_id, name in EMPLOYEES:
            if (emp_id, d.isoformat()) in existing:
                continue

            profile = EMP_PROFILE.get(emp_id, [("Present",4),("WFH",1),("Absent",1)])
            status  = _pick(profile)

            ci_opts = CHECK_IN.get(status)
            co_opts = CHECK_OUT.get(status)
            ci = _pick(ci_opts) if ci_opts else None
            co = _pick(co_opts) if co_opts else None
            hrs = _hours(ci, co)

            # approval_status logic
            if status == "Absent":
                appr = "N/A"
            elif d >= date(2026, 6, 20):
                appr = random.choice(["Pending", "Approved"])
            else:
                appr = random.choices(["Approved", "Pending"], weights=[8, 2], k=1)[0]

            aid = next_id(db, collections.ATTENDANCE)
            records.append({
                "_id": aid, "id": aid, "emp_id": emp_id, "name": name, "att_date": d.isoformat(),
                "check_in": ci, "check_out": co, "total_hours": hrs,
                "att_status": status, "approval_status": appr,
            })

        d += timedelta(days=1)

    if records:
        db[collections.ATTENDANCE].insert_many(records)
    print(f"[OK] Inserted {len(records)} attendance records.")

if __name__ == "__main__":
    run()
