from datetime import datetime

from bson import json_util
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pymongo.database import Database

from app.core import collections
from app.core.audit import log_action
from app.core.database import get_db
from app.core.security import get_current_user, require_platform_permission

router = APIRouter()

router_deps = [Depends(require_platform_permission("operations"))]

# Same collections settings.py's per-org export covers, plus the platform-owned
# collections that export deliberately excludes (organizations/org_logos/plans/
# subscriptions aren't any one org's data, so they never appear in a per-org backup).
_PLATFORM_ONLY_COLLECTIONS = [
    collections.ORGANIZATIONS, collections.ORG_LOGOS,
    collections.SUBSCRIPTION_PLANS, collections.SUBSCRIPTIONS,
]


@router.get("/backup/export", dependencies=router_deps)
def export_platform_backup(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    """Every organization's data at once, unfiltered — export only (no matching
    restore). A platform-wide restore could corrupt every organization's data in one
    request, which is a much bigger blast radius than settings.py's per-org restore
    (which only ever touches the acting Admin's own org_id); it isn't built here."""
    names = collections.ALL_COLLECTIONS + _PLATFORM_ONLY_COLLECTIONS
    data = {name: list(db[name].find()) for name in names}

    payload = {
        "exported_at": datetime.utcnow().isoformat(),
        "db_name": db.name,
        "collections": data,
    }
    log_action(db, user=cu.name, action="EXPORT", module="Operations", org_id=None,
               detail="Platform-wide database backup exported")

    body = json_util.dumps(payload, indent=2)
    filename = f"prove_it_platform_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
