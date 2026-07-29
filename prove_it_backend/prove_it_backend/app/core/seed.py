"""
Seed the database with sample data matching the frontend.
Runs once — skips if data already exists.
"""

from datetime import date, datetime

from app.core import collections
from app.core.database import db
from app.core.security import hash_password


def _d(value):
    """BSON has no bare-date type — store SQLAlchemy Date columns as ISO strings."""
    return value.isoformat() if value else None


def run():
    try:
        # Skip if already seeded
        if db[collections.USERS].find_one():
            return

        # ── Users ────────────────────────────────────────────────────────────
        def u(username, name, role, email, initials):
            uid = __import__("uuid").uuid4().hex
            return {
                "_id": uid, "id": uid, "username": username,
                "password_hash": hash_password(f"{username}123"),
                "name": name, "email": email, "role": role,
                "initials": initials, "is_active": True,
            }

        users = [
            u("admin",  "Admin User",   "Admin",        "admin@proveit.in",  "AU"),
            u("rohan",  "Rohan Mehta",  "Manager",      "rohan@proveit.in",  "RM"),
            u("priya",  "Priya Sharma", "Finance User", "priya@proveit.in",  "PS"),
            u("ravi",   "Ravi Kumar",   "Employee",     "ravi@co.in",        "RK"),
            u("viewer", "View Only",    "Viewer",       "viewer@proveit.in", "VO"),
        ]
        db[collections.USERS].insert_many(users)

        # ── Companies ────────────────────────────────────────────────────────
        def co(cid, name, industry, primary_contact, status):
            return {"_id": cid, "id": cid, "name": name, "industry": industry, "primary_contact": primary_contact, "status": status}

        companies = [
            co("CO001", "Infosys Ltd", "IT Services", "Rohan Mehta",  "Active"),
            co("CO002", "Zomato",      "Food Tech",   "Priya Sharma", "Active"),
            co("CO003", "HDFC Bank",   "Banking",     "Anil Gupta",   "Active"),
            co("CO004", "Flipkart",    "Retail",      "Sunita Rao",   "Onboarding"),
        ]
        db[collections.COMPANIES].insert_many(companies)
        db["counters"].update_one({"_id": collections.COMPANIES}, {"$set": {"seq": len(companies)}}, upsert=True)

        # ── Projects ─────────────────────────────────────────────────────────
        def p(pid, name, client, manager, start, end, status, budget, rev, exp):
            return {
                "_id": pid, "id": pid, "name": name, "client": client, "manager": manager,
                "start_date": _d(start), "end_date": _d(end), "status": status,
                "budget": budget, "est_revenue": rev, "est_expense": exp,
            }

        projects = [
            p("P001", "ERP Rollout",         "Infosys Ltd", "Rohan Mehta",  date(2026,1,1),  date(2026,12,31), "In Progress", 2000000, 3000000, 1200000),
            p("P002", "Mobile App v2",       "Zomato",      "Priya Sharma", date(2026,2,15), date(2026,8,15),  "In Progress", 800000,  1200000, 600000),
            p("P003", "Portal Redesign",     "HDFC Bank",   "Anil Gupta",   date(2026,3,1),  date(2026,6,30),  "On Hold",     500000,  750000,  300000),
            p("P004", "Data Migration",      "Flipkart",    "Sunita Rao",   date(2026,7,1),  date(2026,10,31), "Not Started", 1000000, 1500000, 700000),
            p("P005", "Analytics Dashboard", "Paytm",       "Rohan Mehta",  date(2026,5,1),  date(2026,11,30), "In Progress", 600000,  900000,  400000),
        ]
        db[collections.PROJECTS].insert_many(projects)

        # ── Project Codes ─────────────────────────────────────────────────────
        def pc(code, project_id, description, status):
            return {"_id": code, "code": code, "project_id": project_id, "description": description, "status": status}

        pcodes = [
            pc("PC-001", "P001", "Core Development", "Active"),
            pc("PC-002", "P001", "Testing & QA",      "Active"),
            pc("PC-003", "P002", "UI Development",    "Active"),
            pc("PC-004", "P003", "Design",            "Inactive"),
            pc("PC-005", "P004", "Data Analysis",     "Active"),
        ]
        db[collections.PROJECT_CODES].insert_many(pcodes)

        # ── Billing Codes ─────────────────────────────────────────────────────
        def bc(code, project_code_id, project_id, client, billing_type, rate, eff_from, eff_to, status):
            return {
                "_id": code, "code": code, "project_code_id": project_code_id, "project_id": project_id,
                "client": client, "billing_type": billing_type, "rate": rate,
                "effective_from": _d(eff_from), "effective_to": _d(eff_to), "status": status,
            }

        bcodes = [
            bc("BC-101", "PC-001", "P001", "Infosys Ltd", "T&M",   2500,   date(2026,1,1),  date(2026,12,31), "Active"),
            bc("BC-102", "PC-002", "P001", "Infosys Ltd", "Fixed", 800000, date(2026,1,1),  date(2026,6,30),  "Active"),
            bc("BC-201", "PC-003", "P002", "Zomato",      "T&M",   3000,   date(2026,2,15), date(2026,8,15),  "Active"),
            bc("BC-301", "PC-004", "P003", "HDFC Bank",   "Fixed", 200000, date(2026,3,1),  date(2026,6,30),  "Inactive"),
        ]
        db[collections.BILLING_CODES].insert_many(bcodes)

        # ── Employees ─────────────────────────────────────────────────────────
        def e(emp_id, name, department, designation, email, phone, joining, role, billable, status):
            return {
                "_id": emp_id, "emp_id": emp_id, "name": name, "department": department,
                "designation": designation, "email": email, "phone": phone,
                "joining_date": _d(joining), "role": role, "billable": billable, "status": status,
            }

        employees = [
            e("EMP001", "Ravi Kumar",  "Engineering", "Sr. Developer",  "ravi@co.in",       "+91 98765 43210", date(2023,1,10), "Employee",     True,  "Active"),
            e("EMP002", "Neha Singh",  "Design",      "UI Designer",    "neha@co.in",       "+91 98765 43211", date(2023,3,15), "Employee",     True,  "Active"),
            e("EMP003", "Vikram Das",  "QA",          "Test Engineer",  "vikram@co.in",     "+91 98765 43212", date(2023,6,1),  "Employee",     False, "Active"),
            e("EMP004", "Sonal Patel", "Finance",     "Finance Analyst","sonal@co.in",      "+91 98765 43213", date(2022,8,20), "Finance User", False, "Inactive"),
            e("EMP005", "Rohan Mehta", "Management",  "Project Manager","rohan@proveit.in", "+91 98765 43214", date(2021,4,5),  "Manager",      True,  "Active"),
        ]
        db[collections.EMPLOYEES].insert_many(employees)

        # ── Hourly Costs ──────────────────────────────────────────────────────
        def hc(emp_id, cost, eff_from, eff_to):
            cid = _next(collections.HOURLY_COSTS)
            return {"_id": cid, "id": cid, "emp_id": emp_id, "hourly_cost": cost, "effective_from": _d(eff_from), "effective_to": _d(eff_to)}

        costs = [
            hc("EMP001", 1200, date(2026,1,1),  None),
            hc("EMP002", 950,  date(2026,1,1),  None),
            hc("EMP003", 800,  date(2026,2,15), None),
            hc("EMP005", 1500, date(2026,1,1),  None),
        ]
        db[collections.HOURLY_COSTS].insert_many(costs)

        # ── Timesheets ────────────────────────────────────────────────────────
        def ts(emp_id, name, entry_date, project_id, billing_code_id, hours, billable, status, notes):
            tid = _next(collections.TIMESHEETS)
            return {
                "_id": tid, "id": tid, "emp_id": emp_id, "name": name, "entry_date": _d(entry_date),
                "project_id": project_id, "billing_code_id": billing_code_id, "hours": hours,
                "billable": billable, "status": status, "notes": notes, "approved_by": None,
            }

        sheets = [
            ts("EMP001", "Ravi Kumar",  date(2026,6,20), "P001", "BC-101", 8.0, True,  "Approved", "Feature development"),
            ts("EMP002", "Neha Singh",  date(2026,6,20), "P002", "BC-201", 7.5, True,  "Pending",  "UI screens"),
            ts("EMP003", "Vikram Das",  date(2026,6,19), "P001", "BC-102", 6.0, False, "Rejected", "Test cases"),
            ts("EMP005", "Rohan Mehta", date(2026,6,21), "P002", "BC-201", 4.0, True,  "Approved", "Client meeting"),
        ]
        db[collections.TIMESHEETS].insert_many(sheets)

        # ── Expenses ──────────────────────────────────────────────────────────
        def ex(project_id, project_code_id, billing_code_id, category, expense_date, amount, vendor, status, submitted_by):
            xid = _next(collections.EXPENSES)
            return {
                "_id": xid, "id": xid, "project_id": project_id, "project_code_id": project_code_id,
                "billing_code_id": billing_code_id, "category": category, "expense_date": _d(expense_date),
                "amount": amount, "vendor": vendor, "status": status, "submitted_by": submitted_by,
                "approved_by": None, "reject_reason": None, "receipt_url": None,
            }

        exps = [
            ex("P001", "PC-001", "BC-101", "Software", date(2026,6,15), 45000,  "Adobe Inc",  "Pending",  "EMP005"),
            ex("P002", "PC-003", "BC-201", "Travel",   date(2026,6,14), 8200,   "MakeMyTrip", "Approved", "EMP002"),
            ex("P001", "PC-001", "BC-102", "Vendor",   date(2026,6,10), 120000, "TechVendor", "Rejected", "EMP001"),
            ex("P004", "PC-005", None,     "Travel",   date(2026,6,18), 12500,  "OYO Rooms",  "Pending",  "EMP003"),
        ]
        db[collections.EXPENSES].insert_many(exps)

        # ── Receivables ───────────────────────────────────────────────────────
        def rv(project_id, billing_code_id, client, invoice_no, invoice_date, invoice_amount, received_amount, due_date, status):
            rid = _next(collections.RECEIVABLES)
            return {
                "_id": rid, "id": rid, "project_id": project_id, "billing_code_id": billing_code_id,
                "client": client, "invoice_no": invoice_no, "invoice_date": _d(invoice_date),
                "invoice_amount": invoice_amount, "received_amount": received_amount,
                "due_date": _d(due_date), "status": status,
            }

        recvs = [
            rv("P001", "BC-101", "Infosys Ltd", "INV-2026-001", date(2026,6,1),  500000, 250000, date(2026,6,30), "Partial"),
            rv("P002", "BC-201", "Zomato",      "INV-2026-002", date(2026,6,15), 300000, 300000, date(2026,6,30), "Paid"),
            rv("P003", "BC-301", "HDFC Bank",   "INV-2026-003", date(2026,5,1),  200000, 0,      date(2026,5,31), "Overdue"),
        ]
        db[collections.RECEIVABLES].insert_many(recvs)

        # ── Service Desk Tickets ──────────────────────────────────────────────
        def tk(ticket_no, subject, project_id, requester, queue, priority, status, sla_deadline, assigned_to, cancel_reason=None):
            tid = _next(collections.TICKETS)
            return {
                "_id": tid, "id": tid, "ticket_no": ticket_no, "subject": subject, "project_id": project_id,
                "requester": requester, "queue": queue, "priority": priority, "status": status,
                "sla_deadline": sla_deadline, "assigned_to": assigned_to, "resolution": None,
                "cancel_reason": cancel_reason, "created_at": None, "updated_at": None,
            }

        tickets = [
            tk("SN-10241", "New billing code required for ERP phase 2",  "P001", "Ravi Kumar",  "Finance Ops", "High",     "In Progress",      datetime(2026,6,22,18,20), "Sonal Patel"),
            tk("SN-10242", "Employee access to project timesheet module", "P002", "Neha Singh",  "Access",      "Critical", "Waiting Approval", datetime(2026,6,22,15,15), "Admin User"),
            tk("SN-10243", "Vendor invoice mismatch in receivables",      "P003", "Sonal Patel", "Billing",     "Medium",   "Resolved",         datetime(2026,6,21,12,0),  "Rohan Mehta"),
            tk("SN-10244", "Cancel unused software request",              "P004", "Vikram Das",  "IT Support",  "Low",      "Cancelled",        datetime(2026,6,20,10,0),  "Admin User", "Duplicate request; software already procured."),
        ]
        db[collections.TICKETS].insert_many(tickets)

        # ── Access Requests ───────────────────────────────────────────────────
        def areq(requester, page, project, status):
            rid = _next(collections.ACCESS_REQUESTS)
            return {"_id": rid, "id": rid, "requester": requester, "page": page, "project": project, "reason": None, "status": status}

        reqs = [
            areq("Ravi Kumar",  "Receivables",  "ERP Rollout",   "Pending"),
            areq("Neha Singh",  "Reports",      "Mobile App v2", "Pending"),
            areq("Vikram Das",  "Service Desk", "ERP Rollout",   "Approved"),
        ]
        db[collections.ACCESS_REQUESTS].insert_many(reqs)

        def pperm(emp_id, page, allowed):
            pid = _next(collections.PAGE_PERMISSIONS)
            return {"_id": pid, "id": pid, "emp_id": emp_id, "page": page, "allowed": allowed}

        perms = [
            pperm("EMP001", "Dashboard",    True),
            pperm("EMP001", "Projects",     True),
            pperm("EMP001", "Timesheets",   True),
            pperm("EMP001", "Expenses",     False),
            pperm("EMP001", "Receivables",  False),
            pperm("EMP001", "Service Desk", True),
            pperm("EMP001", "Reports",      False),
            pperm("EMP002", "Dashboard",    True),
            pperm("EMP002", "Projects",     True),
            pperm("EMP002", "Timesheets",   True),
            pperm("EMP002", "Expenses",     False),
        ]
        db[collections.PAGE_PERMISSIONS].insert_many(perms)

        def projperm(emp_id, project_id, allowed):
            pid = _next(collections.PROJECT_PERMISSIONS)
            return {"_id": pid, "id": pid, "emp_id": emp_id, "project_id": project_id, "allowed": allowed}

        proj_perms = [
            projperm("EMP001", "P001", True),
            projperm("EMP001", "P002", False),
            projperm("EMP002", "P001", True),
            projperm("EMP002", "P002", True),
        ]
        db[collections.PROJECT_PERMISSIONS].insert_many(proj_perms)

        # ── Audit Log ─────────────────────────────────────────────────────────
        def log(user, action, module, record_id, detail, timestamp):
            lid = _next(collections.AUDIT_LOG)
            return {
                "_id": lid, "id": lid, "user": user, "action": action, "module": module,
                "record_id": record_id, "detail": detail, "timestamp": timestamp,
            }

        logs = [
            log("Admin User",  "CREATE",  "Projects",     "P001",     "Created project ERP Rollout",      datetime(2026,1,1,9,0)),
            log("Sonal Patel", "APPROVE", "Expenses",     "2",        "Approved travel expense ₹8,200", datetime(2026,6,15,14,30)),
            log("Admin User",  "CANCEL",  "Service Desk", "SN-10244", "Ticket cancelled: duplicate request", datetime(2026,6,20,11,0)),
        ]
        db[collections.AUDIT_LOG].insert_many(logs)

        print("[OK]  Database seeded successfully.")

    except Exception as exc:
        print(f"[ERR]  Seed error: {exc}")
        raise


def _next(counter_name: str) -> int:
    from app.core.mongo_utils import next_id
    return next_id(db, counter_name)
