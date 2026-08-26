"""
Prove IT Catalysts — Project & Financial Tracker
Complete FastAPI Backend
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import client, ensure_indexes
from app.routers import (
    auth,
    users,
    organizations,
    subscriptions,
    sub_admins,
    platform_settings,
    platform_overview,
    operations,
    companies,
    projects,
    project_codes,
    billing_codes,
    employees,
    hourly_costs,
    timesheets,
    expenses,
    receivables,
    invoices,
    leave,
    tickets,
    approvals,
    access_control,
    role_permissions,
    reports,
    dashboard,
    audit_log,
    settings,
    notifications,
    holidays,
    payroll,
    payslips,
    integrations,
)

@asynccontextmanager
async def lifespan(_app: FastAPI):
    client.admin.command("ping")  # fail fast if Atlas is unreachable
    ensure_indexes()
    yield
    client.close()

app = FastAPI(
    title="Prove IT Catalysts API",
    description="Complete backend for Project & Financial Tracker",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Without this, browsers only expose a small default set of response headers to
    # cross-origin fetch() calls — Content-Disposition isn't one of them, so JS-driven
    # downloads (payslips, the Settings backup export) can read the bytes fine but
    # silently can't see the real filename and fall back to a generic one.
    expose_headers=["Content-Disposition"],
)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router,           prefix="/api/auth",           tags=["Auth"])
app.include_router(users.router,          prefix="/api/users",          tags=["Users"])
app.include_router(organizations.router,  prefix="/api/organizations",  tags=["Organizations"])
app.include_router(subscriptions.router,  prefix="/api/subscriptions",  tags=["Subscriptions"])
app.include_router(sub_admins.router,     prefix="/api/sub-admins",     tags=["Sub Admins"])
app.include_router(platform_settings.router, prefix="/api/platform-settings", tags=["Platform Settings"])
app.include_router(platform_overview.router, prefix="/api/platform-overview", tags=["Platform Overview"])
app.include_router(operations.router,     prefix="/api/operations",     tags=["Operations"])
app.include_router(companies.router,      prefix="/api/companies",      tags=["Companies"])
app.include_router(projects.router,       prefix="/api/projects",       tags=["Projects"])
app.include_router(project_codes.router,  prefix="/api/project-codes",  tags=["Project Codes"])
app.include_router(billing_codes.router,  prefix="/api/billing-codes",  tags=["Billing Codes"])
app.include_router(employees.router,      prefix="/api/employees",       tags=["Employees"])
app.include_router(hourly_costs.router,   prefix="/api/hourly-costs",   tags=["Hourly Costs"])
app.include_router(timesheets.router,     prefix="/api/timesheets",     tags=["Timesheets"])
app.include_router(expenses.router,       prefix="/api/expenses",       tags=["Expenses"])
app.include_router(receivables.router,    prefix="/api/receivables",    tags=["Receivables"])
app.include_router(invoices.router,       prefix="/api/invoices",       tags=["Invoices"])
app.include_router(leave.router,          prefix="/api/leave",          tags=["Leave"])
app.include_router(tickets.router,        prefix="/api/tickets",        tags=["Service Desk"])
app.include_router(approvals.router,      prefix="/api/approvals",      tags=["Approvals"])
app.include_router(access_control.router, prefix="/api/access-control", tags=["Access Control"])
app.include_router(role_permissions.router, prefix="/api/role-permissions", tags=["Roles & Permissions"])
app.include_router(reports.router,        prefix="/api/reports",        tags=["Reports"])
app.include_router(dashboard.router,      prefix="/api/dashboard",      tags=["Dashboard"])
app.include_router(audit_log.router,      prefix="/api/audit-log",      tags=["Audit Log"])
app.include_router(settings.router,       prefix="/api/settings",       tags=["Settings"])
app.include_router(notifications.router,  prefix="/api/notifications",  tags=["Notifications"])
app.include_router(holidays.router,       prefix="/api/holidays",       tags=["Payroll"])
app.include_router(payroll.router,        prefix="/api/payroll",        tags=["Payroll"])
app.include_router(payslips.router,       prefix="/api/payslips",       tags=["Payroll"])
app.include_router(integrations.router,   prefix="/api/integrations/prmanager", tags=["PR Manager Sync"])


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "app": "Prove IT Catalysts API", "version": "1.0.0"}
