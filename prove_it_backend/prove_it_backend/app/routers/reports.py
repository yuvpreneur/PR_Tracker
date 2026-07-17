from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from typing import Optional
from datetime import date, timedelta
from app.core import collections
from app.core.database import get_db
from app.core.security import require_permission, get_current_user

router = APIRouter()


def _period_range(period: Optional[str]):
    today = date.today()
    if period == "last_month":
        last = today.replace(day=1) - timedelta(days=1)
        return last.replace(day=1), last
    if period == "q1_2026":
        return date(2026, 1, 1), date(2026, 3, 31)
    if period == "fy_2025_26":
        return date(2025, 4, 1), date(2026, 3, 31)
    # default: this_month
    return today.replace(day=1), today


@router.get("/dashboard", dependencies=[Depends(require_permission("Reports", "view"))])
def dashboard_summary(
    period: Optional[str] = Query(None, description="this_month|last_month|q1_2026|fy_2025_26"),
    db: Database = Depends(get_db),
):
    """Top-level KPIs for the dashboard, filtered by period."""
    start, end = _period_range(period)
    start_s, end_s = start.isoformat(), end.isoformat()

    projects = list(db[collections.PROJECTS].find())
    ts_all   = list(db[collections.TIMESHEETS].find({"status": "Approved"}))

    # Period-filtered financials
    recvs_period = list(db[collections.RECEIVABLES].find({
        "invoice_date": {"$gte": start_s, "$lte": end_s},
    }))
    expenses_period = list(db[collections.EXPENSES].find({
        "status": "Approved",
        "expense_date": {"$gte": start_s, "$lte": end_s},
    }))

    total_received = sum(r["received_amount"] for r in recvs_period)
    total_expenses = sum(e["amount"] for e in expenses_period)

    # Outstanding across ALL receivables (not period-filtered)
    all_recvs = list(db[collections.RECEIVABLES].find())
    outstanding = sum(r["invoice_amount"] - r["received_amount"] for r in all_recvs if r["status"] != "Paid")

    # Pending approvals count
    pending_ts     = db[collections.TIMESHEETS].count_documents({"status": "Pending"})
    pending_exp    = db[collections.EXPENSES].count_documents({"status": "Pending"})
    pending_att    = db[collections.ATTENDANCE].count_documents({"approval_status": "Pending"})
    pending_access = db[collections.ACCESS_REQUESTS].count_documents({"status": "Pending"})
    pending_total  = pending_ts + pending_exp + pending_att + pending_access

    billable_hrs = sum(t["hours"] for t in ts_all if t["billable"])
    total_hrs    = sum(t["hours"] for t in ts_all)

    return {
        "period": period or "this_month",
        "period_start": start_s,
        "period_end": end_s,
        "projects": {
            "total": len(projects),
            "in_progress": sum(1 for p in projects if p["status"] == "In Progress"),
            "on_hold": sum(1 for p in projects if p["status"] == "On Hold"),
            "completed": sum(1 for p in projects if p["status"] == "Completed"),
        },
        "financials": {
            "total_revenue_billed": sum(r["invoice_amount"] for r in recvs_period),
            "total_revenue_received": total_received,
            "outstanding": outstanding,
            "total_approved_expenses": total_expenses,
            "net_profit": total_received - total_expenses,
        },
        "timesheets": {
            "approved_hours": total_hrs,
            "billable_hours": billable_hrs,
            "pending": pending_ts,
        },
        "pending_approvals": pending_total,
    }


@router.get("/project-profitability", dependencies=[Depends(require_permission("Reports", "view"))])
def project_profitability(
    project_id: Optional[str] = Query(None),
    period: Optional[str] = Query(None, description="this_month|last_month|q1_2026|fy_2025_26"),
    db: Database = Depends(get_db),
):
    """Revenue vs cost per project."""
    date_filter = None
    if period:
        start, end = _period_range(period)
        date_filter = {"$gte": start.isoformat(), "$lte": end.isoformat()}

    proj_query = {"id": project_id} if project_id else {}
    projects = list(db[collections.PROJECTS].find(proj_query))
    rows = []
    for p in projects:
        ts_query = {"project_id": p["id"], "status": "Approved"}
        exp_query = {"project_id": p["id"], "status": "Approved"}
        recv_query = {"project_id": p["id"]}
        if date_filter:
            ts_query["entry_date"] = date_filter
            exp_query["expense_date"] = date_filter
            recv_query["invoice_date"] = date_filter
        ts = list(db[collections.TIMESHEETS].find(ts_query))
        exps = list(db[collections.EXPENSES].find(exp_query))
        recvs = list(db[collections.RECEIVABLES].find(recv_query))

        # Employee cost = hours × hourly cost
        total_emp_cost = 0
        for t in ts:
            hc = db[collections.HOURLY_COSTS].find_one({"emp_id": t["emp_id"]}, sort=[("effective_from", -1)])
            total_emp_cost += t["hours"] * (hc["hourly_cost"] if hc else 0)

        total_expense = sum(e["amount"] for e in exps)
        total_cost = total_emp_cost + total_expense
        total_revenue = sum(r["received_amount"] for r in recvs)
        rows.append({
            "project_id": p["id"],
            "project_name": p["name"],
            "client": p["client"],
            "status": p["status"],
            "total_hours": sum(t["hours"] for t in ts),
            "employee_cost": round(total_emp_cost, 2),
            "direct_expenses": round(total_expense, 2),
            "total_cost": round(total_cost, 2),
            "revenue_received": round(total_revenue, 2),
            "gross_profit": round(total_revenue - total_cost, 2),
            "margin_pct": round(((total_revenue - total_cost) / total_revenue * 100) if total_revenue else 0, 2),
        })
    return rows


@router.get("/billing-code-summary", dependencies=[Depends(require_permission("Reports", "view"))])
def billing_code_summary(
    project_id: Optional[str] = Query(None),
    period: Optional[str] = Query(None, description="this_month|last_month|q1_2026|fy_2025_26"),
    db: Database = Depends(get_db),
):
    """Hours, expenses and revenue grouped by billing code."""
    date_filter = None
    if period:
        start, end = _period_range(period)
        date_filter = {"$gte": start.isoformat(), "$lte": end.isoformat()}

    bc_query = {"project_id": project_id} if project_id else {}
    codes = list(db[collections.BILLING_CODES].find(bc_query))
    rows = []
    for b in codes:
        code = b["code"]
        ts_query = {"billing_code_id": code, "status": "Approved"}
        exp_query = {"billing_code_id": code, "status": "Approved"}
        recv_query = {"billing_code_id": code}
        if date_filter:
            ts_query["entry_date"] = date_filter
            exp_query["expense_date"] = date_filter
            recv_query["invoice_date"] = date_filter
        ts = list(db[collections.TIMESHEETS].find(ts_query))
        exps = list(db[collections.EXPENSES].find(exp_query))
        recvs = list(db[collections.RECEIVABLES].find(recv_query))
        rows.append({
            "code": code,
            "project_id": b["project_id"],
            "client": b["client"],
            "billing_type": b["billing_type"],
            "rate": b["rate"],
            "status": b["status"],
            "total_hours": sum(t["hours"] for t in ts),
            "direct_expenses": round(sum(e["amount"] for e in exps), 2),
            "total_billed": round(sum(r["invoice_amount"] for r in recvs), 2),
            "total_received": round(sum(r["received_amount"] for r in recvs), 2),
        })
    return rows


@router.get("/employee-utilization", dependencies=[Depends(require_permission("Reports", "view"))])
def employee_utilization(
    emp_id: Optional[str] = Query(None),
    period: Optional[str] = Query(None, description="this_month|last_month|q1_2026|fy_2025_26"),
    db: Database = Depends(get_db),
    cu=Depends(get_current_user),
):
    # Per-employee utilization %/hourly cost is HR-flavored data outside Finance User's
    # money-side remit (billing/receivables/expenses) — everyone else with Reports:view
    # (Admin, Manager) still gets it via the same endpoint.
    if cu.role == "Finance User":
        raise HTTPException(403, "Employee utilization reports are not available to this role")
    date_filter = None
    if period:
        start, end = _period_range(period)
        date_filter = {"$gte": start.isoformat(), "$lte": end.isoformat()}

    emp_query = {"status": "Active"}
    if emp_id:
        emp_query["emp_id"] = emp_id
    employees = list(db[collections.EMPLOYEES].find(emp_query))
    rows = []
    for e in employees:
        ts_query = {"emp_id": e["emp_id"], "status": "Approved"}
        if date_filter:
            ts_query["entry_date"] = date_filter
        ts = list(db[collections.TIMESHEETS].find(ts_query))
        billable   = sum(t["hours"] for t in ts if t["billable"])
        total      = sum(t["hours"] for t in ts)
        hc = db[collections.HOURLY_COSTS].find_one({"emp_id": e["emp_id"]}, sort=[("effective_from", -1)])
        hourly_cost = hc["hourly_cost"] if hc else 0
        rows.append({
            "emp_id": e["emp_id"],
            "name": e["name"],
            "department": e["department"],
            "total_hours": total,
            "billable_hours": billable,
            "non_billable_hours": total - billable,
            "utilization_pct": round((billable / total * 100) if total else 0, 2),
            "hourly_cost": hourly_cost,
            "total_cost": round(total * hourly_cost, 2),
        })
    return sorted(rows, key=lambda x: x["utilization_pct"], reverse=True)


@router.get("/receivables-aging", dependencies=[Depends(require_permission("Reports", "view"))])
def receivables_aging(project_id: Optional[str] = Query(None), db: Database = Depends(get_db)):
    today = date.today()
    query = {"status": {"$ne": "Paid"}}
    if project_id:
        query["project_id"] = project_id
    recvs = list(db[collections.RECEIVABLES].find(query))
    buckets = {"0-30": 0, "31-60": 0, "61-90": 0, "90+": 0}
    for r in recvs:
        if not r["due_date"]: continue
        days_overdue = (today - date.fromisoformat(r["due_date"])).days
        bal = r["invoice_amount"] - r["received_amount"]
        if days_overdue <= 30:   buckets["0-30"] += bal
        elif days_overdue <= 60: buckets["31-60"] += bal
        elif days_overdue <= 90: buckets["61-90"] += bal
        else:                    buckets["90+"] += bal
    return {"aging_buckets": buckets, "total_outstanding": sum(buckets.values())}


@router.get("/monthly-revenue", dependencies=[Depends(require_permission("Reports", "view"))])
def monthly_revenue(
    period: Optional[str] = Query(None, description="this_month|last_month|q1_2026|fy_2025_26"),
    year: int = Query(2026),
    db: Database = Depends(get_db),
):
    """Monthly breakdown of receivables received and expenses, over the given period (or full calendar year if no period given)."""
    if period:
        start, end = _period_range(period)
    else:
        start, end = date(year, 1, 1), date(year, 12, 31)

    months = []
    cursor = date(start.year, start.month, 1)
    while cursor <= end:
        months.append((cursor.year, cursor.month))
        cursor = date(cursor.year + 1, 1, 1) if cursor.month == 12 else date(cursor.year, cursor.month + 1, 1)

    recvs = list(db[collections.RECEIVABLES].find())
    exps  = list(db[collections.EXPENSES].find({"status": "Approved"}))
    data = []
    for y, m in months:
        rev = sum(
            r["received_amount"] for r in recvs
            if r["invoice_date"] and date.fromisoformat(r["invoice_date"]).year == y and date.fromisoformat(r["invoice_date"]).month == m
        )
        cost = sum(
            e["amount"] for e in exps
            if e["expense_date"] and date.fromisoformat(e["expense_date"]).year == y and date.fromisoformat(e["expense_date"]).month == m
        )
        data.append({"month": m, "year": y, "revenue": rev, "cost": cost, "profit": rev - cost})
    return data
