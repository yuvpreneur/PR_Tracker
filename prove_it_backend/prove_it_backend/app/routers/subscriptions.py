import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pymongo import ASCENDING
from pymongo.database import Database

from app.core import collections
from app.core.audit import log_action
from app.core.database import get_db
from app.core.permissions import MODULES
from app.core.security import get_current_user, require_platform_permission


def _valid_features(features: List[str]) -> List[str]:
    bad = [f for f in features if f not in MODULES]
    if bad:
        raise HTTPException(400, f"Unknown feature(s): {bad}. Choose from: {MODULES}")
    return features

router = APIRouter()

# Plans and per-org subscription assignment are two distinct platform permissions —
# a Sub Admin might be granted one without the other — so each gets its own
# dependency list rather than sharing one router-wide gate. Super Admin always
# passes both. See app/core/security.py's require_platform_permission().
plans_deps = [Depends(require_platform_permission("plans"))]
subs_deps = [Depends(require_platform_permission("subscriptions"))]


# ── Plans ────────────────────────────────────────────────────────────────────
# Registered ahead of the "/" and "/{org_id}" subscription routes below so
# GET /plans isn't swallowed by GET /{org_id} matching org_id="plans" first
# (same ordering concern organizations.py calls out for its own "/me" route).

class PlanCreate(BaseModel):
    name: str
    description: str = ""
    price_monthly: float = 0
    is_free: bool = False
    sort_order: int = 0
    features: List[str] = []


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_monthly: Optional[float] = None
    is_free: Optional[bool] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    features: Optional[List[str]] = None


def _plan_out(p: dict) -> dict:
    return {
        "id": p["id"],
        "name": p["name"],
        "description": p.get("description", ""),
        "price_monthly": p.get("price_monthly", 0),
        "is_free": p.get("is_free", False),
        "is_active": p.get("is_active", True),
        "sort_order": p.get("sort_order", 0),
        # Modules from app.core.permissions.MODULES this plan grants — enforced in
        # get_effective_permissions() (app/core/permissions.py), not just descriptive.
        "features": p.get("features", []),
        "created_at": p["created_at"].isoformat() if p.get("created_at") else None,
        "created_by": p.get("created_by"),
    }


@router.get("/plans", dependencies=plans_deps)
def list_plans(db: Database = Depends(get_db)):
    rows = db[collections.SUBSCRIPTION_PLANS].find().sort("sort_order", ASCENDING)
    return [_plan_out(p) for p in rows]


@router.get("/available-plans", dependencies=[Depends(get_current_user)])
def list_available_plans(db: Database = Depends(get_db)):
    """Public list of active subscription plans — accessible to all authenticated users.
    Used by customer-facing Subscription page to display available plans.
    Excludes legacy/internal plans (identified by is_legacy_full_access flag)."""
    rows = db[collections.SUBSCRIPTION_PLANS].find({
        "is_active": True,
        "is_legacy_full_access": {"$ne": True}  # Exclude legacy full access plan
    }).sort("sort_order", ASCENDING)
    return [_plan_out(p) for p in rows]


@router.post("/plans", dependencies=plans_deps)
def create_plan(payload: PlanCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    _valid_features(payload.features)
    plan_id = uuid.uuid4().hex
    plan_doc = {
        "_id": plan_id, "id": plan_id,
        **payload.dict(),
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "created_by": cu.username,
    }
    db[collections.SUBSCRIPTION_PLANS].insert_one(plan_doc)
    # Plans are platform-wide, not tied to any one organization, so org_id=None
    # here is the honest value (mirrors the two pre-org bootstrap flows in
    # auth.py that also log with org_id=None) rather than Super Admin's own
    # (always-null) org_id.
    log_action(db, user=cu.name, action="CREATE", module="Subscription Plans", org_id=None, record_id=plan_id,
               detail=f"Created plan '{payload.name}'")
    return _plan_out(plan_doc)

# ── Free Access grants ───────────────────────────────────────────────────────
# A "grant" is just an org's normal Subscription doc (see below) with is_free_grant=True
# plus a granted_by/granted_at trail — there's no separate billing concept in this app
# (price_monthly is informational only, nothing here actually charges anyone), so
# "granting free access" and "assigning a plan" are the same underlying write. This
# section exists to give that action its own audited, filterable view rather than
# burying it in the full Subscriptions org list. Registered ahead of "/" and "/{org_id}"
# below for the same route-ordering reason "/plans" is — see the comment above.
free_access_deps = [Depends(require_platform_permission("free_access"))]


class FreeAccessGrant(BaseModel):
    org_id: str
    plan_id: str
    note: Optional[str] = None


def _grant_out(sub: dict, org_name: str, plan_name: str) -> dict:
    return {
        "org_id": sub["org_id"],
        "org_name": org_name,
        "plan_id": sub.get("plan_id"),
        "plan_name": plan_name,
        "note": sub.get("note"),
        "granted_by": sub.get("granted_by"),
        "granted_at": sub["granted_at"].isoformat() if sub.get("granted_at") else None,
    }


@router.get("/free-access", dependencies=free_access_deps)
def list_free_access_grants(db: Database = Depends(get_db)):
    subs = list(db[collections.SUBSCRIPTIONS].find({"is_free_grant": True, "is_active": True}))
    orgs = {o["_id"]: o["name"] for o in db[collections.ORGANIZATIONS].find({}, {"name": 1})}
    plans = {p["_id"]: p["name"] for p in db[collections.SUBSCRIPTION_PLANS].find({}, {"name": 1})}
    return [
        _grant_out(s, orgs.get(s["org_id"], "—"), plans.get(s.get("plan_id"), "—"))
        for s in subs
    ]


@router.post("/free-access", dependencies=free_access_deps)
def grant_free_access(payload: FreeAccessGrant, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    org = db[collections.ORGANIZATIONS].find_one({"_id": payload.org_id})
    if not org:
        raise HTTPException(404, "Organization not found")
    plan = db[collections.SUBSCRIPTION_PLANS].find_one({"_id": payload.plan_id})
    if not plan or not plan.get("is_active", True):
        raise HTTPException(400, "Plan not found or not active")

    now = datetime.now(timezone.utc)
    doc = {
        "org_id": payload.org_id,
        "plan_id": payload.plan_id,
        "is_active": True,
        "is_free_grant": True,
        "note": payload.note,
        "granted_by": cu.username,
        "granted_at": now,
        "updated_at": now,
        "updated_by": cu.username,
    }
    db[collections.SUBSCRIPTIONS].update_one({"_id": payload.org_id}, {"$set": doc}, upsert=True)
    log_action(db, user=cu.name, action="CREATE", module="Free Access", org_id=payload.org_id, record_id=payload.org_id,
               detail=f"Granted '{plan['name']}' free to {org['name']}")
    return _grant_out(doc, org["name"], plan["name"])


@router.post("/free-access/{org_id}/revoke", dependencies=free_access_deps)
def revoke_free_access(org_id: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    org = db[collections.ORGANIZATIONS].find_one({"_id": org_id})
    if not org:
        raise HTTPException(404, "Organization not found")
    fallback_plan = db[collections.SUBSCRIPTION_PLANS].find_one({"is_legacy_full_access": True})
    if not fallback_plan:
        raise HTTPException(400, "No fallback free plan configured — create one first.")

    now = datetime.now(timezone.utc)
    db[collections.SUBSCRIPTIONS].update_one(
        {"_id": org_id},
        {"$set": {
            "org_id": org_id, "plan_id": fallback_plan["_id"], "is_active": True, "is_free_grant": False,
            "note": None, "granted_by": None, "granted_at": None,
            "updated_at": now, "updated_by": cu.username,
        }},
        upsert=True,
    )
    log_action(db, user=cu.name, action="UPDATE", module="Free Access", org_id=org_id, record_id=org_id,
               detail=f"Revoked free access for {org['name']}, fell back to '{fallback_plan['name']}'")
    return {"org_id": org_id, "plan_id": fallback_plan["_id"], "plan_name": fallback_plan["name"]}


# ── Organization subscriptions (exactly one per org) ────────────────────────

class SubscriptionAssign(BaseModel):
    plan_id: Optional[str] = None
    is_active: bool = True
    note: Optional[str] = None


def _sub_out(org_id: str, s: Optional[dict]) -> dict:
    if not s:
        return {"org_id": org_id, "plan_id": None, "is_active": False, "note": None, "updated_at": None, "updated_by": None}
    return {
        "org_id": s["org_id"],
        "plan_id": s.get("plan_id"),
        "is_active": s.get("is_active", False),
        "note": s.get("note"),
        "updated_at": s["updated_at"].isoformat() if s.get("updated_at") else None,
        "updated_by": s.get("updated_by"),
    }


@router.get("/", dependencies=subs_deps)
def list_subscriptions(db: Database = Depends(get_db)):
    rows = db[collections.SUBSCRIPTIONS].find()
    return [_sub_out(s["org_id"], s) for s in rows]


@router.get("/me", dependencies=[Depends(get_current_user)])
def get_my_subscription(cu=Depends(get_current_user), db: Database = Depends(get_db)):
    """Public endpoint — any authenticated user can fetch their own org's subscription."""
    if not cu.org_id:
        raise HTTPException(404, "No organization")
    s = db[collections.SUBSCRIPTIONS].find_one({"_id": cu.org_id})
    return _sub_out(cu.org_id, s)


@router.get("/{org_id}", dependencies=subs_deps)
def get_subscription(org_id: str, db: Database = Depends(get_db)):
    # Get-or-default, no doc created on read — same idiom as settings.py's
    # _get_section() for sections that haven't been saved yet.
    s = db[collections.SUBSCRIPTIONS].find_one({"_id": org_id})
    return _sub_out(org_id, s)


@router.patch("/{org_id}", dependencies=subs_deps)
def assign_subscription(
    org_id: str, payload: SubscriptionAssign,
    db: Database = Depends(get_db), cu=Depends(get_current_user),
):
    org = db[collections.ORGANIZATIONS].find_one({"_id": org_id})
    if not org:
        raise HTTPException(404, "Organization not found")
    doc = {
        "org_id": org_id,
        "plan_id": payload.plan_id,
        "is_active": payload.is_active,
        "note": payload.note,
        "updated_at": datetime.now(timezone.utc),
        "updated_by": cu.username,
    }
    db[collections.SUBSCRIPTIONS].update_one({"_id": org_id}, {"$set": doc}, upsert=True)
    log_action(db, user=cu.name, action="UPDATE", module="Subscriptions", org_id=org_id, record_id=org_id,
               detail=f"Set subscription for {org['name']}")
    return _sub_out(org_id, doc)


# Parameterized plan route - moved to end to ensure /plans/available is matched first
@router.patch("/plans/{plan_id}", dependencies=plans_deps)
def update_plan(plan_id: str, payload: PlanUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    plan = db[collections.SUBSCRIPTION_PLANS].find_one({"_id": plan_id})
    if not plan:
        raise HTTPException(404, "Plan not found")
    patch = payload.dict(exclude_none=True)
    if "features" in patch:
        _valid_features(patch["features"])
    if patch:
        db[collections.SUBSCRIPTION_PLANS].update_one({"_id": plan_id}, {"$set": patch})
        plan = db[collections.SUBSCRIPTION_PLANS].find_one({"_id": plan_id})
    log_action(db, user=cu.name, action="UPDATE", module="Subscription Plans", org_id=None, record_id=plan_id,
               detail=f"Updated plan {plan['name']}")
    return _plan_out(plan)
