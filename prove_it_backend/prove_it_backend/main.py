"""
Prove IT Catalysts — Project & Financial Tracker
Complete FastAPI Backend
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import client
from app.routers import (
    auth,
    users,
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
    audit_log,
    settings,
    notifications,
)

@asynccontextmanager
async def lifespan(_app: FastAPI):
    client.admin.command("ping")  # fail fast if Atlas is unreachable
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
)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth.router,           prefix="/api/auth",           tags=["Auth"])
app.include_router(users.router,          prefix="/api/users",          tags=["Users"])
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
app.include_router(audit_log.router,      prefix="/api/audit-log",      tags=["Audit Log"])
app.include_router(settings.router,       prefix="/api/settings",       tags=["Settings"])
app.include_router(notifications.router,  prefix="/api/notifications",  tags=["Notifications"])


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "app": "Prove IT Catalysts API", "version": "1.0.0"}
