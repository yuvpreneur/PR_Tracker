USERS = "users"
COMPANIES = "companies"
PROJECTS = "projects"
PROJECT_CODES = "project_codes"
BILLING_CODES = "billing_codes"
EMPLOYEES = "employees"
HOURLY_COSTS = "hourly_costs"
TIMESHEETS = "timesheets"
EXPENSES = "expenses"
RECEIVABLES = "receivables"
ATTENDANCE = "attendance"
LEADS = "leads"
LEAD_NOTES = "lead_notes"
LEAVE = "leave"
TICKETS = "tickets"
PAGE_PERMISSIONS = "page_permissions"
PROJECT_PERMISSIONS = "project_permissions"
ROLE_PERMISSIONS = "role_permissions"
ACCESS_REQUESTS = "access_requests"
AUDIT_LOG = "audit_log"
LEAD_PROJECT_SETTINGS = "lead_project_settings"
CUSTOM_PAGES = "custom_pages"
SETTINGS = "settings"

# Every collection that a full database backup/restore should cover (app/routers/settings.py).
# Deliberately excludes "counters" (handled as its own top-level key since it has no constant here).
ALL_COLLECTIONS = [
    USERS, COMPANIES, PROJECTS, PROJECT_CODES, BILLING_CODES, EMPLOYEES, HOURLY_COSTS,
    TIMESHEETS, EXPENSES, RECEIVABLES, ATTENDANCE, LEADS, LEAD_NOTES, LEAVE, TICKETS,
    PAGE_PERMISSIONS, PROJECT_PERMISSIONS, ROLE_PERMISSIONS, ACCESS_REQUESTS, AUDIT_LOG,
    LEAD_PROJECT_SETTINGS, CUSTOM_PAGES, SETTINGS,
]
