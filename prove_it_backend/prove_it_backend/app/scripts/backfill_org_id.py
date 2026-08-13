"""
One-time backfill for the multi-tenant migration: creates a single "Default
Organization" and stamps org_id onto every existing document that predates
multi-tenancy, across every collection in collections.ALL_COLLECTIONS.

Idempotent — every write only targets docs missing org_id ({"$exists": False}),
so re-running this is always safe and becomes a no-op once nothing is left to
stamp. Must run AFTER the multi-tenant backend code is deployed but BEFORE the
first Super Admin account is bootstrapped — the Super Admin doesn't exist yet
at that point, so this script never touches it, and it correctly ends up with
org_id=None (see app/routers/auth.py's register_super_admin).

Usage:
    python -m app.scripts.backfill_org_id --dry-run
    python -m app.scripts.backfill_org_id
    python -m app.scripts.backfill_org_id --check
"""

import argparse
from datetime import datetime, timezone
import uuid

from app.core import collections
from app.core.database import db

DEFAULT_ORG_NAME = "Default Organization"

# Everything ALL_COLLECTIONS already covers for backup/restore is exactly what
# needs an org_id stamped here too.
MIGRATION_COLLECTIONS = collections.ALL_COLLECTIONS


def _get_or_create_default_org(dry_run: bool) -> str:
    existing = db[collections.ORGANIZATIONS].find_one({"is_default": True})
    if existing:
        return existing["_id"]
    if dry_run:
        print("[dry-run] would create the Default Organization")
        return "<dry-run-default-org-id>"
    org_id = uuid.uuid4().hex
    db[collections.ORGANIZATIONS].insert_one({
        "_id": org_id, "id": org_id,
        "name": DEFAULT_ORG_NAME, "logo_url": None,
        "is_active": True, "is_default": True,
        "created_at": datetime.now(timezone.utc), "created_by": "system-migration",
    })
    print(f"Created Default Organization ({org_id})")
    return org_id


def run(dry_run: bool = False):
    default_org_id = _get_or_create_default_org(dry_run)
    for name in MIGRATION_COLLECTIONS:
        missing = db[name].count_documents({"org_id": {"$exists": False}})
        if dry_run:
            print(f"[dry-run] {name}: {missing} doc(s) would be stamped with org_id")
            continue
        if missing == 0:
            print(f"{name}: nothing to do")
            continue
        result = db[name].update_many(
            {"org_id": {"$exists": False}},
            {"$set": {"org_id": default_org_id}},
        )
        print(f"{name}: matched={result.matched_count} modified={result.modified_count}")


def check():
    all_ok = True
    for name in MIGRATION_COLLECTIONS:
        missing = db[name].count_documents({"org_id": {"$exists": False}})
        if missing:
            all_ok = False
        print(f"{name}: {missing} doc(s) without org_id [{'OK' if not missing else 'MISSING'}]")
    if not all_ok:
        raise SystemExit(1)
    print("All collections have org_id on every document.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Report counts only, no writes")
    parser.add_argument("--check", action="store_true", help="Verify no documents are missing org_id")
    args = parser.parse_args()

    if args.check:
        check()
    else:
        run(dry_run=args.dry_run)
