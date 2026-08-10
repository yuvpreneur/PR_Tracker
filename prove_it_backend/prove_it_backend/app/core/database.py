import os

from dotenv import load_dotenv
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.database import Database

from app.core import collections

load_dotenv()

MONGODB_URI = os.environ["MONGODB_URI"]
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "prove_it")

client = MongoClient(MONGODB_URI)
db: Database = client[MONGODB_DB_NAME]


def get_db() -> Database:
    return db


def ensure_indexes() -> None:
    """Creates the indexes the dashboard/reports queries rely on. create_index() is
    idempotent (a no-op if an equivalent index already exists), so this is safe to run
    on every startup rather than needing a one-off migration step."""
    db[collections.PROJECTS].create_index([("id", ASCENDING)])
    db[collections.PROJECTS].create_index([("status", ASCENDING)])

    db[collections.TIMESHEETS].create_index([("status", ASCENDING)])
    db[collections.TIMESHEETS].create_index([("project_id", ASCENDING)])
    db[collections.TIMESHEETS].create_index([("emp_id", ASCENDING)])
    db[collections.TIMESHEETS].create_index([("entry_date", ASCENDING)])

    db[collections.EXPENSES].create_index([("status", ASCENDING)])
    db[collections.EXPENSES].create_index([("project_id", ASCENDING)])
    db[collections.EXPENSES].create_index([("expense_date", ASCENDING)])
    db[collections.EXPENSES].create_index([("submitted_by", ASCENDING)])

    db[collections.RECEIVABLES].create_index([("project_id", ASCENDING)])
    db[collections.RECEIVABLES].create_index([("invoice_date", ASCENDING)])
    db[collections.RECEIVABLES].create_index([("status", ASCENDING)])

    db[collections.HOURLY_COSTS].create_index([("emp_id", ASCENDING), ("effective_from", DESCENDING)])

    db[collections.ACCESS_REQUESTS].create_index([("status", ASCENDING)])
    db[collections.LEAVE].create_index([("status", ASCENDING)])
    db[collections.EMPLOYEES].create_index([("emp_id", ASCENDING)])
    db[collections.EMPLOYEES].create_index([("status", ASCENDING)])
    db[collections.COMPANIES].create_index([("status", ASCENDING)])
    db[collections.TICKETS].create_index([("requester", ASCENDING)])
    db[collections.TICKETS].create_index([("status", ASCENDING)])

    db[collections.NOTIFICATIONS].create_index([("recipient", ASCENDING), ("is_read", ASCENDING)])
    db[collections.NOTIFICATIONS].create_index([("module", ASCENDING)])
