from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database
from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import next_id, get_or_404
from app.core.security import get_current_user, require_permission
from app.core.audit import log_action

router = APIRouter()


class HolidayCreate(BaseModel):
    date: date
    name: str


class HolidayUpdate(BaseModel):
    date: Optional[date] = None
    name: Optional[str] = None


def _out(h: dict):
    return {"id": h["id"], "date": str(h["date"]), "name": h["name"]}


@router.get("/")
def list_holidays(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    # No permission gate on reads — every org member (including Employee) can see the
    # holiday calendar for their own leave planning, same as Invoices' unrestricted
    # list/get. Only create/edit/delete require Payroll:edit below.
    rows = list(db[collections.HOLIDAYS].find({"org_id": cu.org_id}).sort("date", 1))
    return [_out(h) for h in rows]


@router.post("/", dependencies=[Depends(require_permission("Payroll", "edit"))])
def create(payload: HolidayCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    hid = next_id(db, collections.HOLIDAYS)
    doc = {"_id": hid, "id": hid, "org_id": cu.org_id, "date": payload.date.isoformat(), "name": payload.name}
    db[collections.HOLIDAYS].insert_one(doc)
    log_action(db, user=cu.name, action="CREATE", module="Payroll", org_id=cu.org_id, record_id=str(hid), detail=f"Added holiday {doc['name']} ({doc['date']})")
    return _out(doc)


@router.patch("/{holiday_id}", dependencies=[Depends(require_permission("Payroll", "edit"))])
def update(holiday_id: int, payload: HolidayUpdate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    h = get_or_404(db, collections.HOLIDAYS, holiday_id, cu.org_id, "Holiday not found")
    patch = payload.dict(exclude_none=True)
    if "date" in patch: patch["date"] = patch["date"].isoformat()
    db[collections.HOLIDAYS].update_one({"_id": holiday_id, "org_id": cu.org_id}, {"$set": patch})
    h = db[collections.HOLIDAYS].find_one({"_id": holiday_id, "org_id": cu.org_id})
    log_action(db, user=cu.name, action="UPDATE", module="Payroll", org_id=cu.org_id, record_id=str(holiday_id))
    return _out(h)


@router.delete("/{holiday_id}", dependencies=[Depends(require_permission("Payroll", "edit"))])
def delete(holiday_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    get_or_404(db, collections.HOLIDAYS, holiday_id, cu.org_id, "Holiday not found")
    db[collections.HOLIDAYS].delete_one({"_id": holiday_id, "org_id": cu.org_id})
    log_action(db, user=cu.name, action="DELETE", module="Payroll", org_id=cu.org_id, record_id=str(holiday_id))
    return {"message": "Deleted"}
