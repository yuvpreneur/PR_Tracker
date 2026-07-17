// Shared mutable state — imported by all modules that need cross-module data
export const state = {
  currentUser: null,
  permissions: {},
  // Explicit per-employee Page Access grants/denials from GET /api/auth/me's
  // page_overrides — keyed by module name, wins over both the role matrix and the
  // self-service nav bypass when a module key is present (see canViewPage()).
  pageOverrides: {},
  blockedPageId: null,

  companies: [],
  projects: [],
  employees: [],
  pcodes: [],
  bcodes: [],
  leads: [],
  tickets: [],
  hourlyCosts: [],
  attendance: [],
  timesheets: [],
  expenses: [],
  invoices: [],
  receivables: [],
  users: [],
  auditLogs: [],
  currentProjectRows: [],
  approvalsAll: [],
  pf: {},

  PAGE_PARAM_OVERRIDES: {
    'page-attendance': { status: 'att_status' },
    'page-users':      { status: 'is_active' },
  },

  PARAM_MAP: {
    'all industries':    'industry',
    'all status':        'status',
    'all projects':      'project_id',
    'all clients':       'client',
    'all depts':         'department',
    'all categories':    'category',
    'all types':         'billing_type',
    'all roles':         'role',
    'all billing codes': 'billing_code_id',
    'all stages':        'stage',
    'all owners':        'owner',
    'all employees':     'emp_id',
    'all queues':        'queue',
    'all priorities':    'priority',
    'all modules':       'module',
    'all users':         'user',
  },
};
