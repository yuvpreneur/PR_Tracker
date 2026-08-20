"""
One-time seed for the three default paid Subscription Plans (Basic / Professional /
Enterprise), created alongside the existing "Full Access (legacy)" free plan (see
app/scripts/backfill_full_access_plan.py) rather than replacing it — orgs already
assigned to the legacy plan are untouched.

Idempotent — matched by name, so re-running only creates each plan once and leaves
any since-edited copy (price/features changed via the Plans admin UI) alone.

Usage:
    python -m app.scripts.seed_default_plans --dry-run
    python -m app.scripts.seed_default_plans
"""

import argparse
import uuid
from datetime import datetime, timezone

from app.core import collections
from app.core.database import db

# Ordered to match MODULES in app/core/permissions.py — each tier's feature list
# below is a prefix-ish subset of that list, not an arbitrary pick.
PLANS = [
    {
        "name": "Basic",
        "description": "Core day-to-day modules for a small team getting started.",
        "price_monthly": 19,
        "sort_order": 1,
        "features": ["Companies", "Projects", "Employees", "Timesheets", "Expenses", "Leave"],
    },
    {
        "name": "Professional",
        "description": "Adds financial and operational modules for growing organizations.",
        "price_monthly": 49,
        "sort_order": 2,
        "features": [
            "Companies", "Projects", "Employees", "Timesheets", "Expenses", "Leave",
            "Project Codes", "Billing Codes", "Service Desk", "Receivables", "Invoices",
            "Reports", "Approvals",
        ],
    },
    {
        "name": "Enterprise",
        "description": "Full platform access, including Payroll and Hourly Costs.",
        "price_monthly": 99,
        "sort_order": 3,
        "features": [
            "Companies", "Projects", "Employees", "Timesheets", "Expenses", "Leave",
            "Project Codes", "Billing Codes", "Service Desk", "Receivables", "Invoices",
            "Reports", "Approvals", "Hourly Costs", "Payroll",
        ],
    },
]


def run(dry_run: bool = False):
    existing_names = {p["name"] for p in db[collections.SUBSCRIPTION_PLANS].find({}, {"name": 1})}
    for plan in PLANS:
        if plan["name"] in existing_names:
            print(f"Skipping '{plan['name']}' — a plan with that name already exists.")
            continue
        if dry_run:
            print(f"[dry-run] would create plan '{plan['name']}' (${plan['price_monthly']}/mo, "
                  f"{len(plan['features'])} features)")
            continue
        plan_id = uuid.uuid4().hex
        db[collections.SUBSCRIPTION_PLANS].insert_one({
            "_id": plan_id, "id": plan_id,
            "name": plan["name"],
            "description": plan["description"],
            "price_monthly": plan["price_monthly"],
            "is_free": False,
            "is_active": True,
            "sort_order": plan["sort_order"],
            "features": plan["features"],
            "created_at": datetime.now(timezone.utc),
            "created_by": "system-seed",
        })
        print(f"Created plan '{plan['name']}' ({plan_id}) — ${plan['price_monthly']}/mo, "
              f"{len(plan['features'])} features")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Report what would change, no writes")
    args = parser.parse_args()
    run(dry_run=args.dry_run)
