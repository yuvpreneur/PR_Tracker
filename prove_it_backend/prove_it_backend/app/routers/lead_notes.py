from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database
from pydantic import BaseModel
from datetime import datetime
from app.core import collections
from app.core.database import get_db
from app.core.mongo_utils import next_id
from app.core.security import get_current_user
from app.core.permissions import has_permission, is_own_record

router = APIRouter()


class NoteCreate(BaseModel):
    text: str


def _out(n: dict):
    return {"id": n["id"], "lead_id": n["lead_id"], "by": n["by"], "at": n["at"], "text": n["text"]}


@router.get("/{lead_id}/notes")
def list_notes(lead_id: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    lead = db[collections.LEADS].find_one({"_id": lead_id})
    if not lead: raise HTTPException(404, "Lead not found")
    notes = db[collections.LEAD_NOTES].find({"lead_id": lead_id}).sort("_id", -1)
    return [_out(n) for n in notes]


@router.post("/{lead_id}/notes")
def add_note(lead_id: str, payload: NoteCreate, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    lead = db[collections.LEADS].find_one({"_id": lead_id})
    if not lead: raise HTTPException(404, "Lead not found")
    # Mirrors update_lead()'s gate (leads.py) — same "can edit this lead" rule, so a Viewer
    # (or anyone who's neither the owner nor holds Lead Management:edit) can't write a note
    # onto a lead they can't otherwise touch. This endpoint previously had no gate at all.
    if not has_permission(db, cu, "Lead Management", "edit") and not is_own_record(cu, lead["owner"]):
        raise HTTPException(403, "You may only add notes to your own leads")
    ts = datetime.now().strftime("%d %b %Y, %I:%M %p")
    nid = next_id(db, collections.LEAD_NOTES)
    doc = {"_id": nid, "id": nid, "lead_id": lead_id, "by": cu.name, "at": ts, "text": payload.text}
    db[collections.LEAD_NOTES].insert_one(doc)
    return _out(doc)


@router.delete("/{lead_id}/notes/{note_id}")
def delete_note(lead_id: str, note_id: int, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    n = db[collections.LEAD_NOTES].find_one({"_id": note_id, "lead_id": lead_id})
    if not n: raise HTTPException(404, "Note not found")
    if n["by"] != cu.name and cu.role != "Admin":
        raise HTTPException(403, "Cannot delete another user's note")
    db[collections.LEAD_NOTES].delete_one({"_id": note_id})
    return {"message": "Note deleted"}
