from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from pymongo.database import Database

from app.core import collections
from app.core.audit import log_action
from app.core.database import get_db
from app.core.security import get_current_user, require_platform_permission

router = APIRouter()

router_deps = [Depends(require_platform_permission("settings"))]

# Single fixed document — there is exactly one platform, not one per org (contrast
# with app/routers/settings.py's per-org sections, keyed by org_id).
_DOC_ID = "platform"

DEFAULTS = {
    "default_currency": "INR",
    "default_financial_year_start": "April (India)",
    "session_timeout_minutes": 720,
}


class PlatformSettingsUpdate(BaseModel):
    default_currency: Optional[str] = None
    default_financial_year_start: Optional[str] = None
    session_timeout_minutes: Optional[int] = None


def _settings_out(db: Database) -> dict:
    doc = db[collections.PLATFORM_SETTINGS].find_one({"_id": _DOC_ID})
    if not doc:
        return dict(DEFAULTS)
    return {k: doc.get(k, v) for k, v in DEFAULTS.items()}


@router.get("/", dependencies=router_deps)
def get_platform_settings(db: Database = Depends(get_db)):
    return _settings_out(db)


@router.patch("/", dependencies=router_deps)
def save_platform_settings(payload: PlatformSettingsUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    patch = payload.dict(exclude_none=True)
    if patch:
        db[collections.PLATFORM_SETTINGS].update_one({"_id": _DOC_ID}, {"$set": patch}, upsert=True)
    log_action(db, user=cu.name, action="UPDATE", module="Platform Settings", org_id=None, record_id=_DOC_ID,
               detail="Platform settings updated")
    return _settings_out(db)
