from fastapi import APIRouter, Depends, HTTPException, Response
from pymongo.database import Database

from app.core import collections
from app.core.database import get_db
from app.core.payslip_pdf import build_payslip_pdf
from app.core.permissions import own_emp_id
from app.core.security import get_current_user

router = APIRouter()

# Self-service only, deliberately with no require_permission gate — every role (Employee,
# Manager, Admin, Finance User) can hit these, but own_emp_id() means the response can
# only ever be the CALLER's own payslip, never anyone else's, so there's no broader
# "view all payslips" capability here to restrict in the first place.


@router.get("/periods")
def list_my_payslip_periods(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    emp_id = own_emp_id(db, cu)
    if not emp_id:
        return []
    periods = [
        d["period"] for d in
        db[collections.PAYROLL_REGISTERS].find({"org_id": cu.org_id}, {"period": 1, "employees.code": 1})
        if any(e.get("code") == emp_id for e in d.get("employees", []))
    ]
    return sorted(periods, reverse=True)


@router.get("/{period}")
def get_my_payslip(period: str, db: Database = Depends(get_db), cu=Depends(get_current_user)):
    emp_id = own_emp_id(db, cu)
    if not emp_id:
        raise HTTPException(404, "No Employee record is linked to your account, so there's no payslip to show")

    doc = db[collections.PAYROLL_REGISTERS].find_one({"org_id": cu.org_id, "period": period})
    if not doc:
        raise HTTPException(404, "No Pay Register found for this period")
    row = next((e for e in doc.get("employees", []) if e.get("code") == emp_id), None)
    if not row:
        raise HTTPException(404, "No payslip found for you in this period")

    employee_doc = db[collections.EMPLOYEES].find_one({"_id": emp_id, "org_id": cu.org_id})

    # Mirrors settings.py's weekly_off section storage ({org_id}:weekly_off), inlined
    # here rather than importing that router's private helpers — [6] (Sunday-only)
    # matches WeeklyOffSettings' own default.
    weekly_off_doc = db[collections.SETTINGS].find_one({"_id": f"{cu.org_id}:weekly_off"})
    weekly_off_days = weekly_off_doc.get("weekdays", [6]) if weekly_off_doc else [6]

    logo_doc = db[collections.ORG_LOGOS].find_one({"_id": cu.org_id})
    logo_bytes = bytes(logo_doc["data"]) if logo_doc else None

    pdf_bytes = build_payslip_pdf(
        company_name=doc.get("company_name"),
        company_address=doc.get("company_address"),
        logo_bytes=logo_bytes,
        period=period,
        row=row,
        employee_doc=employee_doc,
        weekly_off_days=weekly_off_days,
    )
    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="Payslip-{emp_id}-{period}.pdf"'},
    )
