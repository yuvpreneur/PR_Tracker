// Mirrors app/core/pay_register_schema.py's EMPLOYEE_DETAILS_EXTRA_FIELDS — manually-
// entered, directly-editable Employee fields (not derived from the Pay Register upload,
// since this data barely changes month to month). Keep in sync if a field is ever
// added/renamed.
//
// email is the exact same field the Employees page already manages — shown here
// read-only for full-fidelity display (see EmployeeDetailsTab.jsx's readOnlyKeys), not
// editable from this tab. dor is its own independent field (not the Employees page's
// validated `relieving_date`) since the source Excel stores it as free text, not a real
// date.

export const EMPLOYEE_DETAILS_EXTRA_FIELDS = [
  { key: 'dor', label: 'DOR' },
  { key: 'dob', label: 'DOB' },
  { key: 'notice_period', label: 'Notice Period' },
  { key: 'pan', label: 'PAN' },
  { key: 'email', label: 'EMail' },
];
