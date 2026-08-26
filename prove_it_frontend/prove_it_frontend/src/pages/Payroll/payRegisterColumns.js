// Mirrors app/core/pay_register_schema.py's COLUMNS/SECTIONS — every field the Pay
// Register actually stores/displays, in order, from the source Excel template (S.No
// through TOTAL CTC SALARY). Keep both in sync if a column is ever added/renamed; the
// `key`s must match exactly since they're also the field names the backend parser writes
// into each employee row.
//
// Bank & Statutory Details is NOT part of this list — that data barely changes month to
// month, so it's managed separately as manually-entered, editable Employee fields instead
// (see bankStatutoryFields.js + BankStatutoryTab.jsx), not re-derived from every upload.
// Job Details (Branch, Designation, Department, Work Location, ...) is also excluded —
// that's already Employee master data visible on the Employees page. DOR, DOB, Notice
// Period, PAN, and EMail are dropped from Employee Details too.

export const SECTIONS = [
  { key: 'employee', label: 'Employee Details' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'actual', label: 'Actual Salary (as paid)' },
  { key: 'earnings', label: 'Earnings' },
  { key: 'deductions', label: 'Deductions' },
  { key: 'company_contribution', label: 'Company Contribution' },
];

export const COLUMNS = [
  // Employee Details
  { key: 's_no', header: 'S.No', section: 'employee', type: 'number' },
  { key: 'code', header: 'Code', section: 'employee', type: 'text', align: 'center' },
  { key: 'name', header: 'Name', section: 'employee', type: 'text', align: 'center' },
  { key: 'father_husband_name', header: "Father's/Husband's Name", section: 'employee', type: 'text', align: 'center' },
  { key: 'gender', header: 'Gender', section: 'employee', type: 'text', align: 'center' },
  { key: 'doj', header: 'DOJ', section: 'employee', type: 'text', align: 'center' },

  // Attendance
  { key: 'total_days', header: 'Total Days', section: 'attendance', type: 'number', align: 'center' },
  { key: 'wk_off', header: 'Wk Off', section: 'attendance', type: 'number', align: 'center' },
  { key: 'holiday', header: 'Holiday', section: 'attendance', type: 'number', align: 'center' },
  { key: 'max_work_days', header: 'Max Work Days', section: 'attendance', type: 'number', align: 'center' },
  { key: 'max_payable_days', header: 'Max Payable Days', section: 'attendance', type: 'number', align: 'center' },
  { key: 'absent_lwp', header: 'Abs./LWP', section: 'attendance', type: 'number', align: 'center' },
  { key: 'net_paid_days', header: 'Net Paid Days', section: 'attendance', type: 'number', align: 'center' },
  { key: 'total_leaves', header: 'Total Lvs', section: 'attendance', type: 'number', align: 'center' },
  { key: 'present_days', header: 'Present Days', section: 'attendance', type: 'number', align: 'center' },

  // Actual Salary (as paid, before this run's earnings/deductions breakdown)
  { key: 'gross_salary_actual', header: 'Gross Salary', section: 'actual', type: 'number', align: 'center' },
  { key: 'basic_salary_actual', header: 'Basic Salary', section: 'actual', type: 'number', align: 'center' },
  { key: 'hra_actual', header: 'HRA', section: 'actual', type: 'number', align: 'center' },
  { key: 'cca_actual', header: 'CCA', section: 'actual', type: 'number', align: 'center' },
  { key: 'food_allowance_actual', header: 'Food Allowance', section: 'actual', type: 'number', align: 'center' },
  { key: 'transport_allowance_actual', header: 'Transport Allowance', section: 'actual', type: 'number', align: 'center' },
  { key: 'medical_allowances_actual', header: 'Medical Allowances', section: 'actual', type: 'number', align: 'center' },
  { key: 'monthly_bonus_actual', header: 'Monthly Bonus', section: 'actual', type: 'number', align: 'center' },
  { key: 'performance_incentive_actual', header: 'Performance Incentive', section: 'actual', type: 'number', align: 'center' },
  { key: 'arrears_actual', header: 'Arrears', section: 'actual', type: 'number', align: 'center' },
  { key: 'lta_ltc_actual', header: 'LTA/LTC', section: 'actual', type: 'number', align: 'center' },
  { key: 'professional_tax_actual', header: 'Professional Tax', section: 'actual', type: 'number', align: 'center' },
  { key: 'esi_actual', header: 'ESI', section: 'actual', type: 'number', align: 'center' },
  { key: 'provident_fund_actual', header: 'Provident Fund', section: 'actual', type: 'number', align: 'center' },
  { key: 'tds_actual', header: 'TDS', section: 'actual', type: 'number', align: 'center' },
  { key: 'medical_actual', header: 'Medical', section: 'actual', type: 'number', align: 'center' },
  { key: 'advance_actual', header: 'Advance', section: 'actual', type: 'number', align: 'center' },
  { key: 'net_salary_actual', header: 'Net Salary', section: 'actual', type: 'number', align: 'center' },
  { key: 'salary_for_hra_exempt_actual', header: 'Salary for HRA Exempt', section: 'actual', type: 'number', align: 'center' },
  { key: 'business_bonus_actual', header: 'Business Bonus', section: 'actual', type: 'number', align: 'center' },
  { key: 'gross_earning_actual', header: 'Gross Earning', section: 'actual', type: 'number', align: 'center' },

  // Earnings
  { key: 'basic_salary', header: 'Basic Salary', section: 'earnings', type: 'number', align: 'center' },
  { key: 'hra', header: 'HRA', section: 'earnings', type: 'number', align: 'center' },
  { key: 'cca', header: 'CCA', section: 'earnings', type: 'number', align: 'center' },
  { key: 'food_allowance', header: 'Food Allowance', section: 'earnings', type: 'number', align: 'center' },
  { key: 'transport_allowance', header: 'Transport Allowance', section: 'earnings', type: 'number', align: 'center' },
  { key: 'medical_allowances', header: 'Medical Allowances', section: 'earnings', type: 'number', align: 'center' },
  { key: 'monthly_bonus', header: 'Monthly Bonus', section: 'earnings', type: 'number', align: 'center' },
  { key: 'performance_incentive', header: 'Performance Incentive', section: 'earnings', type: 'number', align: 'center' },
  { key: 'arrears', header: 'Arrears', section: 'earnings', type: 'number', align: 'center' },
  { key: 'lta_ltc', header: 'LTA/LTC', section: 'earnings', type: 'number', align: 'center' },
  { key: 'business_bonus', header: 'Business Bonus', section: 'earnings', type: 'number', align: 'center' },
  { key: 'gross_earning', header: 'Gross Earning', section: 'earnings', type: 'number', align: 'center' },

  // Deductions
  { key: 'professional_tax', header: 'Professional Tax', section: 'deductions', type: 'number', align: 'center' },
  { key: 'esi', header: 'ESI', section: 'deductions', type: 'number', align: 'center' },
  { key: 'provident_fund', header: 'Provident Fund', section: 'deductions', type: 'number', align: 'center' },
  { key: 'tds', header: 'TDS', section: 'deductions', type: 'number', align: 'center' },
  { key: 'medical', header: 'Medical', section: 'deductions', type: 'number', align: 'center' },
  { key: 'advance', header: 'Advance', section: 'deductions', type: 'number', align: 'center' },
  { key: 'gross_deduction', header: 'Gross Deduction', section: 'deductions', type: 'number', align: 'center' },
  { key: 'net_amt_payable', header: 'Net Amt Payable', section: 'deductions', type: 'number', align: 'center' },

  // Company Contribution
  { key: 'cc_gross_earning', header: 'Gross Earning', section: 'company_contribution', type: 'number', align: 'center' },
  { key: 'cc_pension_cont', header: 'Pension Cont.', section: 'company_contribution', type: 'number', align: 'center' },
  { key: 'cc_epf_diff', header: 'EPF Diff.', section: 'company_contribution', type: 'number', align: 'center' },
  { key: 'cc_employer_pf_cont', header: "Total Employer's PF Cont.", section: 'company_contribution', type: 'number', align: 'center' },
  { key: 'cc_employer_esi_cont', header: "Employer's ESI Cont.", section: 'company_contribution', type: 'number', align: 'center' },
  { key: 'cc_gross_salary', header: 'Gross Salary', section: 'company_contribution', type: 'number', align: 'center' },
  { key: 'cc_net_salary', header: 'Net Salary', section: 'company_contribution', type: 'number', align: 'center' },
  { key: 'cc_salary_for_hra_exempt', header: 'Salary for HRA Exempt', section: 'company_contribution', type: 'number', align: 'center' },
  { key: 'total_ctc_salary', header: 'Total CTC Salary', section: 'company_contribution', type: 'number', align: 'center' },
];

// Columns kept visible (frozen) while the rest of the register scrolls horizontally.
export const FROZEN_KEYS = new Set(['s_no', 'code', 'name']);

export const SECTION_COLUMN_COUNTS = SECTIONS.map(s => ({
  ...s,
  count: COLUMNS.filter(c => c.section === s.key).length,
}));
