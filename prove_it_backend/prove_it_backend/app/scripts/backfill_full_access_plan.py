"""
One-time backfill for the plan-based feature-gating rollout (app/core/permissions.py's
get_org_plan_features()): creates a single "Full Access (legacy)" Subscription Plan
granting every module, then assigns it as an active subscription to every Organization
that doesn't already have an active subscription with a plan.

Must run BEFORE the feature-gating enforcement change in app/core/permissions.py is
deployed — enforcement fails closed (no plan = zero access to every module), so without
this backfill, every existing organization loses access to everything the instant
enforcement goes live. See the plan file for the full rationale.

Idempotent — re-running only creates the legacy plan once (matched by
is_legacy_full_access=True, not by name, so renaming it later doesn't break re-runs) and
only touches orgs that still have no active, plan-having subscription.

Usage:
    python -m app.scripts.backfill_full_access_plan --dry-run
    python -m app.scripts.backfill_full_access_plan
    python -m app.scripts.backfill_full_access_plan --check
"""

import argparse
import uuid
from datetime import datetime, timezone

from app.core import collections
from app.core.database import db
from app.core.permissions import MODULES

LEGACY_PLAN_NAME = "Full Access (legacy)"


def _get_or_create_legacy_plan(dry_run: bool) -> str:
    existing = db[collections.SUBSCRIPTION_PLANS].find_one({"is_legacy_full_access": True})
    if existing:
        return existing["_id"]
    if dry_run:
        print(f"[dry-run] would create plan '{LEGACY_PLAN_NAME}' with all {len(MODULES)} features")
        return "<dry-run-legacy-plan-id>"
    plan_id = uuid.uuid4().hex
    db[collections.SUBSCRIPTION_PLANS].insert_one({
        "_id": plan_id, "id": plan_id,
        "name": LEGACY_PLAN_NAME,
        "description": "Auto-assigned during the plan-feature-gating rollout so no organization already using the app lost access.",
        "price_monthly": 0, "is_free": True, "is_active": True, "sort_order": 0,
        "features": list(MODULES),
        "is_legacy_full_access": True,
        "created_at": datetime.now(timezone.utc), "created_by": "system-migration",
    })
    print(f"Created plan '{LEGACY_PLAN_NAME}' ({plan_id}) with all {len(MODULES)} features")
    return plan_id


def _orgs_needing_backfill():
    orgs = list(db[collections.ORGANIZATIONS].find({}, {"_id": 1, "name": 1}))
    subs = {s["_id"]: s for s in db[collections.SUBSCRIPTIONS].find()}
    needing = []
    for o in orgs:
        sub = subs.get(o["_id"])
        if not sub or not sub.get("is_active") or not sub.get("plan_id"):
            needing.append(o)
    return needing


def run(dry_run: bool = False):
    plan_id = _get_or_create_legacy_plan(dry_run)
    needing = _orgs_needing_backfill()
    if not needing:
        print("No organizations need backfilling — every org already has an active subscription with a plan.")
        return
    for org in needing:
        if dry_run:
            print(f"[dry-run] would assign '{LEGACY_PLAN_NAME}' to {org['name']} ({org['_id']})")
            continue
        db[collections.SUBSCRIPTIONS].update_one(
            {"_id": org["_id"]},
            {"$set": {
                "org_id": org["_id"], "plan_id": plan_id, "is_active": True,
                "note": "Auto-assigned during the plan-feature-gating rollout.",
                "updated_at": datetime.now(timezone.utc), "updated_by": "system-migration",
            }},
            upsert=True,
        )
        print(f"Assigned '{LEGACY_PLAN_NAME}' to {org['name']} ({org['_id']})")


def check():
    needing = _orgs_needing_backfill()
    if needing:
        for org in needing:
            print(f"{org['name']} ({org['_id']}): NO active subscription with a plan")
        raise SystemExit(1)
    print("Every organization has an active subscription with a plan assigned.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Report what would change, no writes")
    parser.add_argument("--check", action="store_true", help="Verify every org has an active plan-having subscription")
    args = parser.parse_args()

    if args.check:
        check()
    else:
        run(dry_run=args.dry_run)
