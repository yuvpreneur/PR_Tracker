"""
Prove IT Catalysts — Project & Financial Tracker
Complete FastAPI Backend
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from starlette.datastructures import MutableHeaders

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
    allow_origins=os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5174").split(","),
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


# ── Trailing-slash normalisation ─────────────────────────────────────────────
# Every list endpoint is declared `@router.get("/")`, so its real path carries a
# trailing slash (`/api/employees/`) while the frontend calls `/api/employees`.
# Starlette would paper over that with a 307, but the redirect is fatal here: the Vite
# dev server proxies /api from :5174, and Starlette builds an absolute Location from the
# proxied Host, so the browser is bounced to http://localhost:8000/... — a different
# origin. Browsers strip the Authorization header across an origin change, so the
# followed request arrives unauthenticated and every data fetch 401s.
#
# Rewriting the path in place keeps the request same-origin (no redirect, no preflight,
# token intact) and lets both spellings route directly.
# Derived from the OpenAPI schema rather than app.routes: FastAPI keeps included
# routers as nested objects, so a flat walk of app.routes sees none of their paths.
_API_SLASH_PATHS = {
    path
    for path in app.openapi()["paths"]
    if path.startswith("/api/") and path.endswith("/")
}


class TrailingSlashRewrite:
    """Pure-ASGI so FileResponse/streaming responses pass through untouched."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if not path.endswith("/") and path + "/" in _API_SLASH_PATHS:
            scope = dict(scope, path=path + "/")
            # raw_path would otherwise still hold the un-rewritten bytes.
            scope.pop("raw_path", None)

        if not (path == "/api" or path.startswith("/api/")):
            await self.app(scope, receive, send)
            return

        # Mark every API response uncacheable. This is not just hygiene for an
        # authenticated JSON API: while the SPA catch-all bug was live, `/api/...` was
        # answered with index.html at status 200, and a FileResponse carries
        # last-modified/etag but no Cache-Control — so browsers applied heuristic
        # caching and stored that HTML under the API URL. The bug is fixed, but a
        # browser that cached a response back then keeps serving it from disk without
        # ever hitting the network, so every module silently renders empty and no
        # request shows up in the Network tab. no-store makes that unrepeatable.
        async def _send(message):
            if message["type"] == "http.response.start":
                MutableHeaders(scope=message)["cache-control"] = "no-store"
            await send(message)

        await self.app(scope, receive, _send)


# Added last, so it sits outermost and rewrites before routing and CORS.
app.add_middleware(TrailingSlashRewrite)


@app.get("/api/health", tags=["Health"])
def health():
    return {"status": "ok", "app": "Prove IT Catalysts API", "version": "1.0.0"}


# ── Static Files & SPA Fallback ──────────────────────────────────────────────
frontend_dist = (Path(__file__).parent.parent.parent / "prove_it_frontend" / "prove_it_frontend" / "dist").resolve()

# Mount static assets (images, css, js)
if (frontend_dist / "assets").exists():
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")


# The SPA fallback is a 404 handler rather than a catch-all `@app.get("/{path:path}")`
# route on purpose. Starlette matches routes before it applies its trailing-slash
# redirect, so a catch-all shadowed every `/api/...` request the frontend makes without
# the trailing slash the routers declare (`@router.get("/")`) — `/api/employees` was
# answered with index.html at status 200 instead of redirecting to `/api/employees/`,
# so every hook's `r.json()` fell through to `{}` and each page died on
# `rows.map is not a function`. Reaching the app through a 404 instead leaves normal
# routing (that redirect included) untouched; only genuinely unmatched paths land here.
@app.exception_handler(404)
async def spa_fallback(request: Request, exc: HTTPException):
    # API 404s are real 404s — never answer a data request with HTML.
    path = request.url.path
    if path == "/api" or path.startswith("/api/"):
        return JSONResponse({"detail": exc.detail or "Not found"}, status_code=404)

    # Serve a real file when the path names one, staying inside dist/ so a crafted
    # path (`/../../secrets`) can't escape the directory. Browsers normalise `..`
    # away, but a non-browser client can send it verbatim.
    candidate = (frontend_dist / path.lstrip("/")).resolve()
    if candidate.is_relative_to(frontend_dist) and candidate.is_file():
        return FileResponse(candidate)

    # Otherwise hand back index.html so client-side routing can take over.
    index_path = frontend_dist / "index.html"
    if index_path.is_file():
        return FileResponse(index_path)
    return JSONResponse({"detail": "Not found"}, status_code=404)
