from fastapi import APIRouter, Depends, Query
from pymongo.database import Database
from typing import Optional

from app.core import collections
from app.core.database import get_db
from app.core.security import get_current_user, require_permission
from app.core.permissions import my_emp_ids
from app.core.reporting import period_date_filter

router = APIRouter()

# ── Admin / Manager cards ─────────────────────────────────────────────────────
# Each endpoint here is deliberately a standalone query rather than sharing one
# bundled response — the frontend fetches every card independently (see
# useDashboardData.js) so any one card can load, fail, or get cached on its own.


@router.get("/admin/total-revenue", dependencies=[Depends(require_permission("Reports", "view"))])
def total_revenue(period: Optional[str] = Query(None), db: Database = Depends(get_db)):
    date_filter = period_date_filter(period)
    query = {"invoice_date": date_filter} if date_filter else {}
    recvs = list(db[collections.RECEIVABLES].find(query))
    active_projects = db[collections.PROJECTS].count_documents({"status": "In Progress"})
    return {
        "total_revenue": sum(r["received_amount"] for r in recvs),
        "active_projects": active_projects,
    }


@router.get("/admin/total-expenses", dependencies=[Depends(require_permission("Reports", "view"))])
def total_expenses(period: Optional[str] = Query(None), db: Database = Depends(get_db)):
    date_filter = period_date_filter(period)
    query = {"status": "Approved"}
    if date_filter:
        query["expense_date"] = date_filter
    exps = list(db[collections.EXPENSES].find(query))
    active_projects = db[collections.PROJECTS].count_documents({"status": "In Progress"})
    return {
        "total_expenses": sum(e["amount"] for e in exps),
        "active_projects": active_projects,
    }


@router.get("/admin/net-profit", dependencies=[Depends(require_permission("Reports", "view"))])
def net_profit(period: Optional[str] = Query(None), db: Database = Depends(get_db)):
    date_filter = period_date_filter(period)
    recv_query = {"invoice_date": date_filter} if date_filter else {}
    exp_query = {"status": "Approved"}
    if date_filter:
        exp_query["expense_date"] = date_filter
    received = sum(r["received_amount"] for r in db[collections.RECEIVABLES].find(recv_query))
    expenses = sum(e["amount"] for e in db[collections.EXPENSES].find(exp_query))
    net = received - expenses
    margin = round((net / received) * 100, 1) if received > 0 else 0.0
    return {"net_profit": net, "margin_pct": margin, "is_loss": net < 0}


@router.get("/admin/pending-approvals", dependencies=[Depends(require_permission("Reports", "view"))])
def pending_approvals_card(db: Database = Depends(get_db)):
    pending_ts = db[collections.TIMESHEETS].count_documents({"status": "Pending"})
    pending_exp = db[collections.EXPENSES].count_documents({"status": {"$in": ["Pending", "Pending Finance"]}})
    pending_access = db[collections.ACCESS_REQUESTS].count_documents({"status": "Pending"})
    return {
        "pending_approvals": pending_ts + pending_exp + pending_access,
        "pending_timesheets": pending_ts,
    }


@router.get("/admin/billable-hours", dependencies=[Depends(require_permission("Reports", "view"))])
def billable_hours(period: Optional[str] = Query(None), db: Database = Depends(get_db)):
    date_filter = period_date_filter(period)
    query = {"status": "Approved"}
    if date_filter:
        query["entry_date"] = date_filter
    ts = list(db[collections.TIMESHEETS].find(query))
    billable = sum(t["hours"] for t in ts if t["billable"])
    total = sum(t["hours"] for t in ts)
    non_billable = max(0, total - billable)
    return {
        "billable_hours": billable,
        "non_billable_hours": non_billable,
        "billable_pct": round((billable / total) * 100) if total > 0 else 0,
    }


# ── Finance cards ──────────────────────────────────────────────────────────────


@router.get("/finance/total-billed", dependencies=[Depends(require_permission("Reports", "view"))])
def total_billed(period: Optional[str] = Query(None), db: Database = Depends(get_db)):
    date_filter = period_date_filter(period)
    query = {"invoice_date": date_filter} if date_filter else {}
    recvs = list(db[collections.RECEIVABLES].find(query))
    return {"total_billed": sum(r["invoice_amount"] for r in recvs)}


@router.get("/finance/total-received", dependencies=[Depends(require_permission("Reports", "view"))])
def total_received(period: Optional[str] = Query(None), db: Database = Depends(get_db)):
    date_filter = period_date_filter(period)
    query = {"invoice_date": date_filter} if date_filter else {}
    recvs = list(db[collections.RECEIVABLES].find(query))
    return {"total_received": sum(r["received_amount"] for r in recvs)}


@router.get("/finance/outstanding", dependencies=[Depends(require_permission("Reports", "view"))])
def outstanding(db: Database = Depends(get_db)):
    # Deliberately unfiltered by period, matching the original bundled endpoint —
    # outstanding balance is a point-in-time total, not something scoped to a range.
    recvs = list(db[collections.RECEIVABLES].find())
    total = sum(r["invoice_amount"] - r["received_amount"] for r in recvs if r["status"] != "Paid")
    return {"outstanding": total}


@router.get("/finance/total-expenses", dependencies=[Depends(require_permission("Reports", "view"))])
def finance_total_expenses(period: Optional[str] = Query(None), db: Database = Depends(get_db)):
    date_filter = period_date_filter(period)
    query = {"status": "Approved"}
    if date_filter:
        query["expense_date"] = date_filter
    exps = list(db[collections.EXPENSES].find(query))
    return {"total_expenses": sum(e["amount"] for e in exps)}


# ── Employee cards ─────────────────────────────────────────────────────────────
# Self-scoped to the caller — Employee's DEFAULT_PERMS has Reports:view=False (this
# is HR/self data, not a Reports-module concern), so these gate on identity alone,
# the same way GET /api/timesheets|expenses|tickets already self-scope for Employee.


@router.get("/employee/my-hours")
def my_hours(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    emp_ids = list(my_emp_ids(db, cu))
    ts = list(db[collections.TIMESHEETS].find({"emp_id": {"$in": emp_ids}}))
    return {
        "hours": sum(t["hours"] for t in ts),
        "billable_hours": sum(t["hours"] for t in ts if t["billable"]),
    }


@router.get("/employee/my-expenses")
def my_expenses(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    exps = list(db[collections.EXPENSES].find({"submitted_by": cu.name}))
    return {"amount": sum(e["amount"] for e in exps), "count": len(exps)}


@router.get("/employee/pending-timesheets")
def my_pending_timesheets(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    emp_ids = list(my_emp_ids(db, cu))
    count = db[collections.TIMESHEETS].count_documents({"emp_id": {"$in": emp_ids}, "status": "Pending"})
    return {"count": count}


@router.get("/employee/my-tickets")
def my_tickets(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    tickets = list(db[collections.TICKETS].find({"requester": cu.name}))
    open_count = sum(1 for t in tickets if t["status"] in ("Open", "In Progress"))
    return {"open": open_count, "total": len(tickets)}


@router.get("/employee/my-recent-timesheets")
def my_recent_timesheets(limit: int = Query(6, le=50), db: Database = Depends(get_db), cu=Depends(get_current_user)):
    emp_ids = list(my_emp_ids(db, cu))
    rows = db[collections.TIMESHEETS].find({"emp_id": {"$in": emp_ids}}).sort("entry_date", -1).limit(limit)
    return [
        {
            "entry_date": str(r["entry_date"]) if r["entry_date"] else None,
            "project_id": r["project_id"],
            "hours": r["hours"],
            "status": r["status"],
        }
        for r in rows
    ]


@router.get("/employee/my-recent-expenses")
def my_recent_expenses(limit: int = Query(6, le=50), db: Database = Depends(get_db), cu=Depends(get_current_user)):
    rows = db[collections.EXPENSES].find({"submitted_by": cu.name}).sort("expense_date", -1).limit(limit)
    return [
        {
            "expense_date": str(r["expense_date"]) if r["expense_date"] else None,
            "category": r["category"],
            "amount": r["amount"],
            "status": r["status"],
        }
        for r in rows
    ]
