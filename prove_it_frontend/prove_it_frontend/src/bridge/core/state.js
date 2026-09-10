// Shared mutable state — imported by all modules that need cross-module data
export const state = {
  currentUser: null,
  permissions: {},
  // Explicit per-employee Page Access grants/denials from GET /api/auth/me's
  // page_overrides — keyed by module name, wins over both the role matrix and the
  // self-service nav bypass when a module key is present (see canViewPage()).
  pageOverrides: {},
  blockedPageId: null,

  pf: {},

  PAGE_PARAM_OVERRIDES: {
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
    'all employees':     'emp_id',
    'all queues':        'queue',
    'all priorities':    'priority',
    'all modules':       'module',
    'all users':         'user',
  },
};

// ── Row caches ───────────────────────────────────────────────────────────────
// The legacy bridge calls .map()/.filter()/.find() on these directly, with no local
// guard — bridge/pages/employees.js, timesheets.js, projects.js and
// bridge/shared/filters.js between them hold ~10 such call sites. A single non-array
// write therefore takes down the whole page with "state.employees.map is not a
// function" rather than degrading one dropdown.
//
// Writes come from ~15 places, and many still use `rows || []`, which only catches
// null/undefined — an object `{}` (an error body, or a 2xx whose payload failed to
// parse as JSON) passes straight through it. Rather than trust every present and
// future writer to guard correctly, the invariant is enforced once, here: these keys
// are ALWAYS arrays, whatever anyone assigns to them.
const LIST_KEYS = [
  'companies', 'projects', 'employees', 'pcodes', 'bcodes', 'tickets',
  'hourlyCosts', 'timesheets', 'expenses', 'invoices', 'receivables',
  'users', 'auditLogs', 'currentProjectRows', 'approvalsAll',
];

const _lists = Object.fromEntries(LIST_KEYS.map(k => [k, []]));

for (const key of LIST_KEYS) {
  Object.defineProperty(state, key, {
    get: () => _lists[key],
    set: value => { _lists[key] = Array.isArray(value) ? value : []; },
    enumerable: true,
    configurable: true,
  });
}
