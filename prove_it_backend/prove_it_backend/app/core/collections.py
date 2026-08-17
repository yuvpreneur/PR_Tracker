USERS = "users"
COMPANIES = "companies"
PROJECTS = "projects"
PROJECT_CODES = "project_codes"
BILLING_CODES = "billing_codes"
EMPLOYEES = "employees"
HOURLY_COSTS = "hourly_costs"
TIMESHEETS = "timesheets"
EXPENSES = "expenses"
EXPENSE_ATTACHMENTS = "expense_attachments"
RECEIVABLES = "receivables"
INVOICES = "invoices"
LEAVE = "leave"
TICKETS = "tickets"
PAGE_PERMISSIONS = "page_permissions"
PROJECT_PERMISSIONS = "project_permissions"
ROLE_PERMISSIONS = "role_permissions"
ACCESS_REQUESTS = "access_requests"
AUDIT_LOG = "audit_log"
SETTINGS = "settings"
NOTIFICATIONS = "notifications"
PASSWORD_RESET_TOKENS = "password_reset_tokens"
ORGANIZATIONS = "organizations"
ORG_LOGOS = "org_logos"
HOLIDAYS = "holidays"
PAYROLL_REGISTERS = "payroll_registers"

# Every collection that a full database backup/restore should cover (app/routers/settings.py).
# Deliberately excludes "counters" (handled as its own top-level key since it has no constant here)
# and "password_reset_tokens" (ephemeral security material, not app data worth backing up).
ALL_COLLECTIONS = [
    USERS, COMPANIES, PROJECTS, PROJECT_CODES, BILLING_CODES, EMPLOYEES, HOURLY_COSTS,
    TIMESHEETS, EXPENSES, EXPENSE_ATTACHMENTS, RECEIVABLES, INVOICES, LEAVE, TICKETS,
    PAGE_PERMISSIONS, PROJECT_PERMISSIONS, ROLE_PERMISSIONS, ACCESS_REQUESTS, AUDIT_LOG,
    SETTINGS, NOTIFICATIONS, HOLIDAYS, PAYROLL_REGISTERS,
]
