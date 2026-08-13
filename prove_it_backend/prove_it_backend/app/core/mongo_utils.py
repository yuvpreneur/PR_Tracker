import re

from fastapi import HTTPException
from pymongo.collection import ReturnDocument
from pymongo.database import Database


def next_id(db: Database, counter_name: str) -> int:
    doc = db["counters"].find_one_and_update(
        {"_id": counter_name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return doc["seq"]


def like(value: str) -> dict:
    return {"$regex": re.escape(value), "$options": "i"}


def get_or_404(db: Database, collection: str, doc_id, org_id, detail: str = "Not found") -> dict:
    """Fetch-by-id-or-404, scoped to the caller's org — the one line in this whole
    codebase where a missing org_id filter is a direct cross-tenant IDOR rather than a
    graceful degradation, so it's centralized here instead of hand-written per router."""
    doc = db[collection].find_one({"_id": doc_id, "org_id": org_id})
    if not doc:
        raise HTTPException(404, detail)
    return doc
