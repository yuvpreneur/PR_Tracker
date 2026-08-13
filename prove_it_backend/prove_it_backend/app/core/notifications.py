from datetime import datetime, timezone
from typing import Any

from app.core import collections
from app.core.mongo_utils import next_id


def notify(db: Any, *, recipient: str, module: str, record_id, status: str, message: str, org_id):
    """In-app notification for `recipient` (matched by Users.name, same identity
    convention as is_own_record()/log_action()) about a decision made on a request they
    submitted. Distinct from the Admin/Manager "pending approvals" bell, which is derived
    live from each module's own status field (see app/routers/approvals.py) rather than
    persisted — that side needs no read/unread state since "still Pending" already means
    "still needs action" and disappears the moment someone acts on it. This one does need
    persisted state: nothing else records whether the requester has seen the decision yet.
    No-ops if recipient can't be resolved (e.g. an orphaned request with no linked user).
    org_id is required (not defaulted) — recipient is matched by name, so a missed org_id
    here is a direct cross-org notification leak, same reasoning as log_action()."""
    if not recipient:
        return
    nid = next_id(db, collections.NOTIFICATIONS)
    db[collections.NOTIFICATIONS].insert_one({
        "_id": nid, "id": nid,
        "recipient": recipient,
        "module": module,
        "record_id": str(record_id),
        "status": status,
        "message": message,
        "is_read": False,
        "org_id": org_id,
        "created_at": datetime.now(timezone.utc),
    })
