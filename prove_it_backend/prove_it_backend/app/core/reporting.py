from typing import Optional
from datetime import date, timedelta

from pymongo.database import Database

from app.core import collections


def period_range(period: Optional[str]):
    today = date.today()
    if period == "last_month":
        last = today.replace(day=1) - timedelta(days=1)
        return last.replace(day=1), last
    if period == "q1_2026":
        return date(2026, 1, 1), date(2026, 3, 31)
    if period == "fy_2025_26":
        return date(2025, 4, 1), date(2026, 3, 31)
    # default: this_month
    return today.replace(day=1), today


def period_date_filter(period: Optional[str]) -> Optional[dict]:
    """$gte/$lte filter for the given period, or None if no period was requested."""
    if not period:
        return None
    start, end = period_range(period)
    return {"$gte": start.isoformat(), "$lte": end.isoformat()}


def group_by(docs, key: str) -> dict:
    """Groups an already-fetched cursor/list of docs by a field, for O(1) per-parent
    lookup instead of a fresh query per parent (project, employee, ...)."""
    groups: dict = {}
    for d in docs:
        groups.setdefault(d[key], []).append(d)
    return groups


def latest_hourly_costs(db: Database, org_id) -> dict:
    """emp_id → most recent hourly_cost, computed with a single query instead of a
    find_one-per-employee/timesheet-row inside a loop."""
    latest: dict = {}
    for hc in db[collections.HOURLY_COSTS].find({"org_id": org_id}).sort("effective_from", -1):
        latest.setdefault(hc["emp_id"], hc["hourly_cost"])
    return latest
