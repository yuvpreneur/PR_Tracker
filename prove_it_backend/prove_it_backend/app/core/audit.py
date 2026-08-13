from datetime import datetime, timezone

from typing import Any

from app.core import collections
from app.core.mongo_utils import next_id


def log_action(
    db: Any,
    *,
    user: str,
    action: str,
    module: str,
    org_id,
    record_id: str = None,
    detail: str = None,
):
    # org_id is required, not defaulted: a missed call site should fail loudly (surfaced
    # the first time that code path runs) rather than silently logging a cross-tenant-
    # unscoped audit entry that never gets noticed. Pass org_id=None only for the two
    # pre-org bootstrap accounts (auth.py's register()/register_super_admin()).
    entry_id = next_id(db, collections.AUDIT_LOG)
    db[collections.AUDIT_LOG].insert_one({
        "_id": entry_id,
        "id": entry_id,
        "user": user,
        "action": action,
        "module": module,
        "record_id": record_id,
        "detail": detail,
        "org_id": org_id,
        "timestamp": datetime.now(timezone.utc),
    })
