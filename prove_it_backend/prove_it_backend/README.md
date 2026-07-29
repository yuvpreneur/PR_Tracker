# Prove IT Catalysts — Python Backend

Complete FastAPI backend for the Prove IT Catalysts Project & Financial Tracker.

## Stack
- **Framework**: FastAPI
- **Database**: MongoDB (Atlas or self-hosted) via PyMongo — see `app/core/database.py`
- **Auth**: JWT Bearer tokens (OAuth2 password flow)
- **Validation**: Pydantic v2

---

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Copy the env template and fill in real values
cp .env.example .env

# 3. Run the server (auto-seeds demo data on first boot, dev-only — see below)
uvicorn main:app --reload --port 8000

# 4. Open interactive API docs
http://localhost:8000/docs
```

### Environment variables (see `.env.example`)

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | Yes | Atlas/MongoDB connection string |
| `MONGODB_DB_NAME` | No (defaults to `prove_it`) | Database name |
| `SECRET_KEY` | Yes | JWT signing key — generate a real random value, never reuse the example |
| `ENVIRONMENT` | No (defaults to `development`) | `development` seeds demo data and enables the frontend's dev-only role-switcher; any other value disables both |
| `CORS_ALLOWED_ORIGINS` | No (defaults to `http://localhost:5173`) | Comma-separated list of origins allowed to call this API |

---

## Default Credentials (development only)

Only seeded when `ENVIRONMENT=development` (the default) **and** the `users` collection is empty. Never applies to a database that already has users, and never runs at all when `ENVIRONMENT` is set to anything else — so a real production database is never auto-seeded with these.

| Username | Password   | Role         |
|----------|------------|--------------|
| admin    | admin123   | Admin        |
| rohan    | rohan123   | Manager      |
| priya    | priya123   | Finance User |
| ravi     | ravi123    | Employee     |
| viewer   | viewer123  | Viewer       |

---

## API Modules & Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login (returns JWT) |
| GET  | `/api/auth/me` | Current user info |

### Users (Admin only)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users/` | List all users |
| POST | `/api/users/` | Create user |
| PATCH | `/api/users/{id}` | Update user |
| POST | `/api/users/{id}/change-password` | Reset password |
| DELETE | `/api/users/{id}` | Delete user |

### Projects
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects/` | List (filter: status, search) |
| GET | `/api/projects/summary` | Aggregated KPIs |
| POST | `/api/projects/` | Create |
| GET | `/api/projects/{id}` | Get by ID |
| PATCH | `/api/projects/{id}` | Update |
| DELETE | `/api/projects/{id}` | Delete |

### Project Codes → `/api/project-codes/`
### Billing Codes → `/api/billing-codes/`
### Employees → `/api/employees/`
### Hourly Costs → `/api/hourly-costs/`

### Timesheets
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/timesheets/` | List (filter: emp_id, project_id, status) |
| GET | `/api/timesheets/summary` | Hours summary |
| POST | `/api/timesheets/` | Submit hours |
| PATCH | `/api/timesheets/{id}` | Edit (Pending only) |
| POST | `/api/timesheets/{id}/approve` | Approve (Manager/Admin) |
| POST | `/api/timesheets/{id}/reject` | Reject with reason |
| DELETE | `/api/timesheets/{id}` | Delete |

### Expenses → `/api/expenses/` (same approve/reject pattern)
### Receivables → `/api/receivables/`

### Service Desk Tickets
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tickets/` | List (filter: status, queue, priority) |
| GET | `/api/tickets/stats` | Open/resolved/cancelled counts |
| POST | `/api/tickets/` | Create ticket |
| PATCH | `/api/tickets/{id}` | Update |
| POST | `/api/tickets/{id}/resolve` | Mark resolved |
| POST | `/api/tickets/{id}/close` | Close (after resolved) |
| POST | `/api/tickets/{id}/cancel` | Cancel with reason + audit |

### Approvals
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/approvals/pending` | All pending items across modules |

### Access Control
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/access-control/pages/{emp_id}` | Get page permissions |
| POST | `/api/access-control/pages` | Set page permissions |
| GET | `/api/access-control/projects/{emp_id}` | Get project permissions |
| POST | `/api/access-control/projects` | Set project permissions |
| GET | `/api/access-control/requests` | List access requests |
| POST | `/api/access-control/requests` | Submit access request |
| POST | `/api/access-control/requests/{id}/approve` | Approve |
| POST | `/api/access-control/requests/{id}/reject` | Reject |

### Reports (Admin / Manager / Finance)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reports/dashboard` | Top-level KPIs |
| GET | `/api/reports/project-profitability` | Revenue vs cost per project |
| GET | `/api/reports/employee-utilization` | Billable hour utilization |
| GET | `/api/reports/receivables-aging` | Aging buckets (0-30, 31-60…) |
| GET | `/api/reports/monthly-revenue` | Monthly rev/cost/profit |

### Audit Log (Admin only)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/audit-log/` | Paginated log (filter: module, action, user) |

---

## Role Permissions Summary

The dynamic Roles & Permissions matrix (`app/core/permissions.py`'s `DEFAULT_PERMS`, editable per-role by an Admin via the Roles & Permissions UI) is the source of truth — read that file directly for the exact current view/create/edit/delete/approve/export flags per role and module. Broad shape: Admin has full access everywhere; Manager runs delivery (projects, people, billing codes, timesheets/expenses approval, service desk) but never deletes; Finance User owns money-side config (billing codes, hourly costs, receivables, expense approval) and financial reports only; Employee is self-service only (own timesheets/leave/tickets while pending, reference-data viewing, no delete ever); Viewer is read-only across the board with no write path anywhere, including no self-service bypass.

---

## Production Notes
- `SECRET_KEY`, `CORS_ALLOWED_ORIGINS`, and `ENVIRONMENT` are all read from the environment (see table above) — set real values via your hosting platform's env var mechanism, not a committed `.env`
- Add HTTPS / a reverse proxy (nginx, or your platform's built-in TLS termination) in front of uvicorn
- Run uvicorn without `--reload` in production (e.g. `uvicorn main:app --host 0.0.0.0 --port 8000`), typically behind a process manager or the platform's own process supervision
