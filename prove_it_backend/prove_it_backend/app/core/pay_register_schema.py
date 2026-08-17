"""
Canonical column schema for the Pay Register (Payroll page) — every field, in order,
from the source Pay Register Excel template (columns S.No through TOTAL CTC SALARY;
Sign./Remark are deliberately excluded, same as the source's intent for that sheet).

`header` is the exact column header text as it appears in the workbook (internal
newlines/whitespace collapsed to single spaces), kept here for documentation/display
purposes. routers/payroll.py locates columns by POSITION relative to the 'Code' header
(not by matching this text) since several headers repeat verbatim across sections —
e.g. Earnings' "Gross Earning" vs Company Contribution's "GROSS EARNING" — so this list's
left-to-right ORDER must stay in sync with the template even if display text drifts.
Mirrored on the frontend by src/pages/Payroll/payRegisterColumns.js.

Bank & Statutory Details, Job Details, and five Employee Details columns (DOR, DOB, Notice
Period, PAN, EMail) are physically present in the template but deliberately NOT part of the
Pay Register's stored/displayed output (see COLUMNS/SECTIONS below) — that data barely
changes month to month, so instead of being re-derived from every upload it's maintained
separately as manually-entered, directly-editable fields on the Employee record, each
surfaced on its own Payroll tab (see BANK_STATUTORY_FIELDS, JOB_DETAILS_FIELDS,
EMPLOYEE_DETAILS_EXTRA_FIELDS and routers/payroll.py's bank-details/job-details/
employee-details endpoints). SHEET_COLUMNS still includes all of them, though: the
position-based column mapping needs the template's true physical column count to correctly
resolve every column that comes after them (e.g. Attendance's position depends on Job
Details' column count being counted, even though Job Details itself is dropped from
COLUMNS/SECTIONS).
"""

SHEET_COLUMNS_SECTIONS = [
    {"key": "employee", "label": "Employee Details"},
    {"key": "bank_statutory", "label": "Bank & Statutory Details"},
    {"key": "job", "label": "Job Details"},
    {"key": "attendance", "label": "Attendance"},
    {"key": "actual", "label": "Actual Salary (as paid)"},
    {"key": "earnings", "label": "Earnings"},
    {"key": "deductions", "label": "Deductions"},
    {"key": "company_contribution", "label": "Company Contribution"},
]

# Sections excluded from the Pay Register's stored/displayed output (see COLUMNS below for
# why each one is excluded).
_EXCLUDED_SECTIONS = {"bank_statutory", "job"}

SECTIONS = [s for s in SHEET_COLUMNS_SECTIONS if s["key"] not in _EXCLUDED_SECTIONS]

SHEET_COLUMNS = [
    # Employee Details
    {"key": "s_no", "header": "S N", "section": "employee", "type": "number"},
    {"key": "code", "header": "Code", "section": "employee", "type": "text"},
    {"key": "name", "header": "Name", "section": "employee", "type": "text"},
    {"key": "father_husband_name", "header": "Father's/ Husband's Name", "section": "employee", "type": "text"},
    {"key": "gender", "header": "Gender", "section": "employee", "type": "text"},
    {"key": "doj", "header": "DOJ", "section": "employee", "type": "text"},
    {"key": "dor", "header": "DOR", "section": "employee", "type": "text"},
    {"key": "dob", "header": "DOB", "section": "employee", "type": "text"},
    {"key": "notice_period", "header": "Notice Period", "section": "employee", "type": "text"},
    {"key": "pan", "header": "PAN", "section": "employee", "type": "text"},
    {"key": "email", "header": "EMail", "section": "employee", "type": "text"},

    # Bank & Statutory Details
    {"key": "pay_mode", "header": "Pay Mode", "section": "bank_statutory", "type": "text"},
    {"key": "bank_name", "header": "Bank Name", "section": "bank_statutory", "type": "text"},
    {"key": "bank_branch", "header": "Bank Branch", "section": "bank_statutory", "type": "text"},
    {"key": "ifsc", "header": "IFSC", "section": "bank_statutory", "type": "text"},
    {"key": "bank_ref_no", "header": "Bank Ref No", "section": "bank_statutory", "type": "text"},
    {"key": "cheque_no", "header": "Cheque No.", "section": "bank_statutory", "type": "text"},
    {"key": "cheque_date", "header": "Cheque Date", "section": "bank_statutory", "type": "text"},
    {"key": "account_no", "header": "A/c No", "section": "bank_statutory", "type": "text"},
    {"key": "name_as_per_account", "header": "Name as per A/c", "section": "bank_statutory", "type": "text"},
    {"key": "aadhaar", "header": "Aadhaar", "section": "bank_statutory", "type": "text"},
    {"key": "pf_no", "header": "PF No", "section": "bank_statutory", "type": "text"},
    {"key": "pf_date", "header": "PF Date", "section": "bank_statutory", "type": "text"},
    {"key": "uan", "header": "UAN", "section": "bank_statutory", "type": "text"},
    {"key": "esi_no", "header": "ESI No", "section": "bank_statutory", "type": "text"},
    {"key": "esi_date", "header": "ESI Date", "section": "bank_statutory", "type": "text"},
    {"key": "esi_office", "header": "ESI Office", "section": "bank_statutory", "type": "text"},

    # Job Details
    {"key": "branch_code", "header": "Branch Code", "section": "job", "type": "text"},
    {"key": "branch", "header": "Branch", "section": "job", "type": "text"},
    {"key": "category", "header": "Category", "section": "job", "type": "text"},
    {"key": "designation", "header": "Designation", "section": "job", "type": "text"},
    {"key": "department", "header": "Department", "section": "job", "type": "text"},
    {"key": "scale", "header": "Scale", "section": "job", "type": "text"},
    {"key": "shift", "header": "Shift", "section": "job", "type": "text"},
    {"key": "work_location", "header": "Work Location", "section": "job", "type": "text"},
    {"key": "phone", "header": "Phone", "section": "job", "type": "text"},
    {"key": "mobile", "header": "Mobile", "section": "job", "type": "text"},
    {"key": "internal_id", "header": "Internal ID", "section": "job", "type": "text"},
    {"key": "address_permanent", "header": "Address(Perm.)", "section": "job", "type": "text"},
    {"key": "address_correspondence", "header": "Address(Corres.)", "section": "job", "type": "text"},

    # Attendance
    {"key": "total_days", "header": "Total Days", "section": "attendance", "type": "number"},
    {"key": "wk_off", "header": "Wk Off", "section": "attendance", "type": "number"},
    {"key": "holiday", "header": "Holiday", "section": "attendance", "type": "number"},
    {"key": "max_work_days", "header": "Max Work Days", "section": "attendance", "type": "number"},
    {"key": "max_payable_days", "header": "Max Payable Days", "section": "attendance", "type": "number"},
    {"key": "absent_lwp", "header": "Abs./ LWP", "section": "attendance", "type": "number"},
    {"key": "net_paid_days", "header": "Net Paid Days", "section": "attendance", "type": "number"},
    {"key": "total_leaves", "header": "Total Lvs", "section": "attendance", "type": "number"},
    {"key": "present_days", "header": "Present Days", "section": "attendance", "type": "number"},

    # Actual Salary (as paid, before this run's earnings/deductions breakdown)
    {"key": "gross_salary_actual", "header": "GROSS SALARY [Actual]", "section": "actual", "type": "number"},
    {"key": "basic_salary_actual", "header": "BASIC SALARY [Actual]", "section": "actual", "type": "number"},
    {"key": "hra_actual", "header": "HRA [Actual]", "section": "actual", "type": "number"},
    {"key": "cca_actual", "header": "CCA [Actual]", "section": "actual", "type": "number"},
    {"key": "food_allowance_actual", "header": "FOOD ALLOWANCE [Actual]", "section": "actual", "type": "number"},
    {"key": "transport_allowance_actual", "header": "TRANSPORT ALLOWANCE [Actual]", "section": "actual", "type": "number"},
    {"key": "medical_allowances_actual", "header": "MEDICAL ALLOWANCES [Actual]", "section": "actual", "type": "number"},
    {"key": "monthly_bonus_actual", "header": "MONTHLY BONUS [Actual]", "section": "actual", "type": "number"},
    {"key": "performance_incentive_actual", "header": "PERFORMANCE INCENTIVE [Actual]", "section": "actual", "type": "number"},
    {"key": "arrears_actual", "header": "ARREARS [Actual]", "section": "actual", "type": "number"},
    {"key": "lta_ltc_actual", "header": "LTA/LTC [Actual]", "section": "actual", "type": "number"},
    {"key": "professional_tax_actual", "header": "PROFESSIONAL TAX [Actual]", "section": "actual", "type": "number"},
    {"key": "esi_actual", "header": "ESI [Actual]", "section": "actual", "type": "number"},
    {"key": "provident_fund_actual", "header": "PROVIDENT FUND [Actual]", "section": "actual", "type": "number"},
    {"key": "tds_actual", "header": "TDS [Actual]", "section": "actual", "type": "number"},
    {"key": "medical_actual", "header": "MEDICAL [Actual]", "section": "actual", "type": "number"},
    {"key": "advance_actual", "header": "ADVANCE [Actual]", "section": "actual", "type": "number"},
    {"key": "net_salary_actual", "header": "NET SALARY [Actual]", "section": "actual", "type": "number"},
    {"key": "salary_for_hra_exempt_actual", "header": "SALARY FOR HRA EXEMPT [Actual]", "section": "actual", "type": "number"},
    {"key": "business_bonus_actual", "header": "BUSINESS BONUS [Actual]", "section": "actual", "type": "number"},
    {"key": "gross_earning_actual", "header": "Gross Earning [Actual]", "section": "actual", "type": "number"},

    # Earnings
    {"key": "basic_salary", "header": "BASIC SALARY", "section": "earnings", "type": "number"},
    {"key": "hra", "header": "HRA", "section": "earnings", "type": "number"},
    {"key": "cca", "header": "CCA", "section": "earnings", "type": "number"},
    {"key": "food_allowance", "header": "FOOD ALLOWANCE", "section": "earnings", "type": "number"},
    {"key": "transport_allowance", "header": "TRANSPORT ALLOWANCE", "section": "earnings", "type": "number"},
    {"key": "medical_allowances", "header": "MEDICAL ALLOWANCES", "section": "earnings", "type": "number"},
    {"key": "monthly_bonus", "header": "MONTHLY BONUS", "section": "earnings", "type": "number"},
    {"key": "performance_incentive", "header": "PERFORMANCE INCENTIVE", "section": "earnings", "type": "number"},
    {"key": "arrears", "header": "ARREARS", "section": "earnings", "type": "number"},
    {"key": "lta_ltc", "header": "LTA/LTC", "section": "earnings", "type": "number"},
    {"key": "business_bonus", "header": "BUSINESS BONUS", "section": "earnings", "type": "number"},
    {"key": "gross_earning", "header": "Gross Earning", "section": "earnings", "type": "number"},

    # Deductions
    {"key": "professional_tax", "header": "PROFESSIONAL TAX", "section": "deductions", "type": "number"},
    {"key": "esi", "header": "ESI", "section": "deductions", "type": "number"},
    {"key": "provident_fund", "header": "PROVIDENT FUND", "section": "deductions", "type": "number"},
    {"key": "tds", "header": "TDS", "section": "deductions", "type": "number"},
    {"key": "medical", "header": "MEDICAL", "section": "deductions", "type": "number"},
    {"key": "advance", "header": "ADVANCE", "section": "deductions", "type": "number"},
    {"key": "gross_deduction", "header": "Gross Deduction", "section": "deductions", "type": "number"},
    {"key": "net_amt_payable", "header": "Net Amt Payable", "section": "deductions", "type": "number"},

    # Company Contribution — prefixed cc_ since several headers here repeat an Earnings/
    # Deductions/Actual-Salary label (e.g. "GROSS EARNING", "NET SALARY") with a different
    # meaning in this section; the prefix keeps every key in this schema unique.
    {"key": "cc_gross_earning", "header": "GROSS EARNING", "section": "company_contribution", "type": "number"},
    {"key": "cc_pension_cont", "header": "PENSION CONT.", "section": "company_contribution", "type": "number"},
    {"key": "cc_epf_diff", "header": "EPF DIFF.", "section": "company_contribution", "type": "number"},
    {"key": "cc_employer_pf_cont", "header": "TOTAL EMPLOYER'S PF CONT.", "section": "company_contribution", "type": "number"},
    {"key": "cc_employer_esi_cont", "header": "EMPLOYER'S ESI CONT.", "section": "company_contribution", "type": "number"},
    {"key": "cc_gross_salary", "header": "GROSS SALARY", "section": "company_contribution", "type": "number"},
    {"key": "cc_net_salary", "header": "NET SALARY", "section": "company_contribution", "type": "number"},
    {"key": "cc_salary_for_hra_exempt", "header": "SALARY FOR HRA EXEMPT", "section": "company_contribution", "type": "number"},
    {"key": "total_ctc_salary", "header": "TOTAL CTC SALARY", "section": "company_contribution", "type": "number"},
]

# A handful of individual Employee Details columns dropped from the register table too
# (DOR, DOB, Notice Period, PAN, EMail) — kept in SHEET_COLUMNS for position math same as
# the excluded sections above, just not surfaced here.
_EXCLUDED_KEYS = {"dor", "dob", "notice_period", "pan", "email"}

# What the Pay Register actually stores/displays per employee — every SHEET_COLUMNS entry
# except Bank & Statutory Details (see module docstring), Job Details (Branch,
# Designation, Department, Work Location, etc. — already Employee master data visible on
# the Employees page), and _EXCLUDED_KEYS above.
COLUMNS = [c for c in SHEET_COLUMNS if c["section"] not in _EXCLUDED_SECTIONS and c["key"] not in _EXCLUDED_KEYS]

# The manually-maintained field groups below are each keyed the same as their SHEET_COLUMNS
# counterparts so there's one name for "PF No", "Branch", etc. across the app. Each is
# editable via routers/payroll.py's own GET/PATCH endpoints, stored directly on the
# Employee record — some keys here (designation, department, phone, email) are the exact
# same field the Employees page already manages; payroll.py deliberately excludes those
# from its PATCH payload (read-only here) rather than opening a second write path for data
# Employees:edit already owns.
BANK_STATUTORY_FIELDS = [c for c in SHEET_COLUMNS if c["section"] == "bank_statutory"]
JOB_DETAILS_FIELDS = [c for c in SHEET_COLUMNS if c["section"] == "job"]
EMPLOYEE_DETAILS_EXTRA_FIELDS = [c for c in SHEET_COLUMNS if c["key"] in _EXCLUDED_KEYS]

NUMERIC_KEYS = {c["key"] for c in COLUMNS if c["type"] == "number"}
