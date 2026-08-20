import os
from datetime import datetime

from fastapi import APIRouter, Depends
from pymongo.database import Database
from pymongo.errors import PyMongoError

from app.core import collections
from app.core.database import client, get_db
from app.core.security import require_platform_permission

router = APIRouter()

router_deps = [Depends(require_platform_permission("overview"))]

# Super Admin/Sub Admin accounts aren't "customers" of the platform, so they're
# excluded from the user headcount below.
PLATFORM_TIER_ROLES = ("Super Admin", "Sub Admin")

MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _shift_month(dt: datetime, n: int) -> datetime:
    """First-of-month `n` months from dt's month (n may be negative) — stdlib has no
    built-in month arithmetic, and pulling in dateutil for this one calculation isn't
    worth the new dependency."""
    zero_based = dt.month - 1 + n
    year = dt.year + zero_based // 12
    month = zero_based % 12 + 1
    return dt.replace(year=year, month=month, day=1, hour=0, minute=0, second=0, microsecond=0)


def _database_status() -> str:
    # Ping on demand rather than reusing main.py's startup ping (that one is meant
    # to crash the process fast if Atlas is unreachable, not report status) — this
    # call must degrade to "Offline" instead of raising, since a health panel that
    # 500s on a DB outage defeats its own purpose.
    try:
        client.admin.command("ping")
        return "Online"
    except PyMongoError:
        return "Offline"


@router.get("/", dependencies=router_deps)
def get_platform_overview(db: Database = Depends(get_db)):
    # Naive UTC, not timezone.now(timezone.utc) — PyMongo hands back naive datetimes
    # for BSON dates by default (even though organizations.py writes them tz-aware),
    # so an aware "now" here would blow up comparing against created_at below.
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    orgs = list(db[collections.ORGANIZATIONS].find({}, {"created_at": 1}))
    total_orgs = len(orgs)
    new_orgs_this_month = sum(1 for o in orgs if o.get("created_at") and o["created_at"] >= month_start)

    total_users = db[collections.USERS].count_documents({"role": {"$nin": list(PLATFORM_TIER_ROLES)}})

    plans = {p["_id"]: p for p in db[collections.SUBSCRIPTION_PLANS].find()}
    active_subs = list(db[collections.SUBSCRIPTIONS].find({"is_active": True, "plan_id": {"$ne": None}}))

    active_paid = 0
    mrr = 0.0
    plan_counts = {}
    org_paid_mrr = {}  # org_id -> its current plan's price_monthly, for orgs counted as paid below
    for s in active_subs:
        plan = plans.get(s.get("plan_id"))
        if not plan:
            continue
        plan_counts[plan["_id"]] = plan_counts.get(plan["_id"], 0) + 1
        # A free-access grant (see app/routers/subscriptions.py) doesn't count as
        # revenue even when it points at a normally-paid plan — only a plan that's
        # both marked free=False AND wasn't specially granted counts toward MRR.
        if not plan.get("is_free") and not s.get("is_free_grant"):
            active_paid += 1
            mrr += plan.get("price_monthly", 0)
            org_paid_mrr[s["org_id"]] = plan.get("price_monthly", 0)

    plan_distribution = sorted(
        (
            {"plan_id": pid, "name": plans[pid]["name"], "org_count": count}
            for pid, count in plan_counts.items()
        ),
        key=lambda row: -row["org_count"],
    )

    # No billing history is tracked (see app/routers/subscriptions.py — price_monthly
    # is informational, there's no Stripe/payment ledger), so real month-over-month MRR
    # doesn't exist. This approximates it from two things that ARE real: each org's
    # actual signup date, and its CURRENT plan — i.e. "what MRR would have been each
    # month if every org had always been on the plan it's on today." An org only
    # contributes once it's actually signed up; it's excluded from every earlier month.
    revenue_growth = []
    for i in range(5, -1, -1):
        cutoff = _shift_month(now, -i + 1)  # first day of the month AFTER the one being computed
        month_label = MONTH_LABELS[_shift_month(now, -i).month - 1]
        month_mrr = sum(
            org_paid_mrr.get(o["_id"], 0)
            for o in orgs
            if o.get("created_at") and o["created_at"] < cutoff
        )
        revenue_growth.append({"month": month_label, "mrr": month_mrr})

    return {
        "organizations": {"total": total_orgs, "new_this_month": new_orgs_this_month},
        "users": {"total": total_users},
        "subscriptions": {"active_paid": active_paid, "free_or_trial": len(active_subs) - active_paid},
        "mrr": mrr,
        "revenue_growth": revenue_growth,
        "plan_distribution": plan_distribution,
        "system_health": {
            "api": "Online",
            "database": _database_status(),
            "environment": os.environ.get("ENVIRONMENT", "development"),
        },
    }
