// Mirrors app/core/pay_register_schema.py's BANK_STATUTORY_FIELDS — manually-entered,
// directly-editable Employee fields (not derived from the Pay Register upload, since
// this data barely changes month to month). Keep in sync if a field is ever added/renamed.

export const BANK_STATUTORY_FIELDS = [
  { key: 'pay_mode', label: 'Pay Mode' },
  { key: 'bank_name', label: 'Bank Name' },
  { key: 'bank_branch', label: 'Bank Branch' },
  { key: 'ifsc', label: 'IFSC' },
  { key: 'bank_ref_no', label: 'Bank Ref No' },
  { key: 'cheque_no', label: 'Cheque No.' },
  { key: 'cheque_date', label: 'Cheque Date' },
  { key: 'account_no', label: 'A/c No' },
  { key: 'name_as_per_account', label: 'Name as per A/c' },
  { key: 'aadhaar', label: 'Aadhaar' },
  { key: 'pf_no', label: 'PF No' },
  { key: 'pf_date', label: 'PF Date' },
  { key: 'uan', label: 'UAN' },
  { key: 'esi_no', label: 'ESI No' },
  { key: 'esi_date', label: 'ESI Date' },
  { key: 'esi_office', label: 'ESI Office' },
];
