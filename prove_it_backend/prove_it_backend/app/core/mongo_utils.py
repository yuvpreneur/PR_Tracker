import re

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
