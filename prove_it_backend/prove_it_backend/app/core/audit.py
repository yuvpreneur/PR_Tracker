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
    record_id: str = None,
    detail: str = None,
):
    entry_id = next_id(db, collections.AUDIT_LOG)
    db[collections.AUDIT_LOG].insert_one({
        "_id": entry_id,
        "id": entry_id,
        "user": user,
        "action": action,
        "module": module,
        "record_id": record_id,
        "detail": detail,
        "timestamp": datetime.now(timezone.utc),
    })
