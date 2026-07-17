import os

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.database import Database

load_dotenv()

MONGODB_URI = os.environ["MONGODB_URI"]
MONGODB_DB_NAME = os.environ.get("MONGODB_DB_NAME", "prove_it")

client = MongoClient(MONGODB_URI)
db: Database = client[MONGODB_DB_NAME]


def get_db() -> Database:
    return db
