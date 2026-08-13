"""
One-time migration for the Settings collection's org-scoping retrofit: the 4 Settings
sections (profile, notifications, approval_workflow, backup_config) used to be global
singleton docs keyed by a fixed `_id` ("profile", etc.) — one of each for the entire
database, shared by every organization. app/routers/settings.py now keys them per-org
as f"{org_id}:{section}" instead.

Seeds a copy of each legacy singleton onto EVERY existing Organization (not just the
Default one) — since there was no isolation before this, every org has effectively been
sharing/seeing that one global doc already, so seeding only the Default org would
silently reset every other org's settings back to hardcoded defaults the moment the new
code ships. Each org can diverge independently after this runs.

Idempotent — skips an org that already has its own composite doc for a section (so a
newly-created Organization in between two runs isn't overwritten), and only deletes a
legacy doc after every existing org has been seeded from it.

Must run AFTER app/scripts/backfill_org_id.py (needs the Organizations collection
populated) and BEFORE the new app/routers/settings.py code is deployed (which expects
composite _ids and no longer reads/writes the legacy fixed _ids at all).

Usage:
    python -m app.scripts.migrate_settings_org_scoping --dry-run
    python -m app.scripts.migrate_settings_org_scoping
    python -m app.scripts.migrate_settings_org_scoping --check
"""

import argparse

from app.core import collections
from app.core.database import db

LEGACY_SECTION_IDS = ["profile", "notifications", "approval_workflow", "backup_config"]


def _section_id(org_id, section: str) -> str:
    return f"{org_id}:{section}"


def run(dry_run: bool = False):
    orgs = list(db[collections.ORGANIZATIONS].find())
    for section in LEGACY_SECTION_IDS:
        legacy_doc = db[collections.SETTINGS].find_one({"_id": section})
        if not legacy_doc:
            print(f"{section}: no legacy doc — nothing to migrate")
            continue

        seed = dict(legacy_doc)
        seed.pop("_id", None)
        seed.pop("org_id", None)

        seeded = 0
        for org in orgs:
            new_id = _section_id(org["_id"], section)
            if db[collections.SETTINGS].find_one({"_id": new_id}):
                continue  # already migrated (or already independently saved)
            if dry_run:
                print(f"[dry-run] would seed {new_id} from legacy '{section}' doc")
                continue
            db[collections.SETTINGS].insert_one({
                "_id": new_id, **seed, "org_id": org["_id"], "section": section,
            })
            seeded += 1

        if dry_run:
            continue
        print(f"{section}: seeded {seeded}/{len(orgs)} organization(s)")
        db[collections.SETTINGS].delete_one({"_id": section})
        print(f"{section}: removed legacy doc")


def check():
    all_ok = True
    for section in LEGACY_SECTION_IDS:
        remaining = db[collections.SETTINGS].count_documents({"_id": section})
        if remaining:
            all_ok = False
        print(f"{section}: legacy doc {'still present [MISSING]' if remaining else 'gone [OK]'}")
    if not all_ok:
        raise SystemExit(1)
    print("Settings org-scoping migration is complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Report what would happen, no writes")
    parser.add_argument("--check", action="store_true", help="Verify no legacy singleton docs remain")
    args = parser.parse_args()

    if args.check:
        check()
    else:
        run(dry_run=args.dry_run)
