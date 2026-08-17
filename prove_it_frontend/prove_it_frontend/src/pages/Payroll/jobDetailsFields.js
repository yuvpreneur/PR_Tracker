// Mirrors app/core/pay_register_schema.py's JOB_DETAILS_FIELDS — manually-entered,
// directly-editable Employee fields (not derived from the Pay Register upload, since this
// data barely changes month to month). Keep in sync if a field is ever added/renamed.
//
// designation/department/phone are the exact same field the Employees page already
// manages — shown here read-only for full-fidelity display (see JobDetailsTab.jsx's
// readOnlyKeys), not editable from this tab.

export const JOB_DETAILS_FIELDS = [
  { key: 'branch_code', label: 'Branch Code' },
  { key: 'branch', label: 'Branch' },
  { key: 'category', label: 'Category' },
  { key: 'designation', label: 'Designation' },
  { key: 'department', label: 'Department' },
  { key: 'scale', label: 'Scale' },
  { key: 'shift', label: 'Shift' },
  { key: 'work_location', label: 'Work Location' },
  { key: 'phone', label: 'Phone' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'internal_id', label: 'Internal ID' },
  { key: 'address_permanent', label: 'Address (Perm.)' },
  { key: 'address_correspondence', label: 'Address (Corres.)' },
];
