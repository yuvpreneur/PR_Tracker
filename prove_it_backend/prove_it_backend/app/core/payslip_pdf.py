"""
Builds a single employee's Payslip PDF for one Pay Register period, laid out to match
the org's existing payslip template (company header, employee/attendance info block,
Earnings/Deductions table, net pay summary).

Two data sources feed it, matching how Payroll's data is now split across tabs:
- The Pay Register's own employee row (routers/payroll.py) — attendance + the
  Earnings/Deductions/Actual-Salary/Company-Contribution figures for that period.
- The Employees record (Job Details / Bank & Statutory Details / Employee Details tabs)
  — designation, pay mode, bank details, ESI No, email. `employee_doc` is None if the
  Pay Register's Code didn't match any Employee record (see payroll.py's
  employee_found flag) — those fields just render blank/N.A. in that case.
"""

import calendar
from datetime import date
from io import BytesIO
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

_MONTH_NAMES = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

_ONES = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

# Earnings/Deductions line items shown on the payslip, in template order — each has a
# Pay Register "scale" (standard entitlement) key and an "_actual" (as paid) key. Rows
# where both are zero/blank are omitted, same as the reference payslip (e.g. ESI/TDS/
# Medical/Advance don't print for an employee who has none).
_EARNING_ITEMS = [
    ("basic_salary", "BASIC SALARY"), ("hra", "HRA"), ("cca", "CCA"),
    ("food_allowance", "FOOD ALLOWANCE"), ("transport_allowance", "TRANSPORT ALLOWANCE"),
    ("medical_allowances", "MEDICAL ALLOWANCES"), ("monthly_bonus", "MONTHLY BONUS"),
    ("performance_incentive", "PERFORMANCE INCENTIVE"), ("arrears", "ARREARS"),
    ("lta_ltc", "LTA/LTC"), ("business_bonus", "BUSINESS BONUS"),
]
_DEDUCTION_ITEMS = [
    ("professional_tax", "PROFESSIONAL TAX"), ("esi", "ESI"), ("provident_fund", "PROVIDENT FUND"),
    ("tds", "TDS"), ("medical", "MEDICAL"), ("advance", "ADVANCE"),
]


def _two_digit_words(n: int) -> str:
    if n < 20:
        return _ONES[n]
    tens, ones = divmod(n, 10)
    return (_TENS[tens] + (" " + _ONES[ones] if ones else "")).strip()


def _three_digit_words(n: int) -> str:
    if n >= 100:
        hundreds, rest = divmod(n, 100)
        return _ONES[hundreds] + " Hundred" + (" " + _two_digit_words(rest) if rest else "")
    return _two_digit_words(n)


def number_to_words_inr(amount) -> str:
    """Indian-numbering (crore/lakh/thousand) words for the rupee part of `amount`,
    e.g. 120000 -> 'One Lakh Twenty Thousand'. No 'Rupees'/'Only' wrapper — the caller
    adds those (see build_payslip_pdf's 'Rs. {words} Only' line)."""
    n = int(round(float(amount or 0)))
    if n == 0:
        return "Zero"
    crore, n = divmod(n, 1_00_00_000)
    lakh, n = divmod(n, 1_00_000)
    thousand, hundred = divmod(n, 1000)
    parts = []
    if crore:
        parts.append(_three_digit_words(crore) + " Crore")
    if lakh:
        parts.append(_three_digit_words(lakh) + " Lakh")
    if thousand:
        parts.append(_three_digit_words(thousand) + " Thousand")
    if hundred:
        parts.append(_three_digit_words(hundred))
    return " ".join(parts)


def _fmt(amount) -> str:
    return f"{float(amount or 0):,.2f}"


def _fmt_days(value) -> str:
    """Attendance figures (total_days, wk_off, ...) come through as floats — render
    whole-number counts ('30') instead of the raw float repr ('30.0')."""
    if value is None:
        return ""
    n = float(value)
    return str(int(n)) if n.is_integer() else str(n)


def _weekday_abbrs(weekdays) -> str:
    return ", ".join(calendar.day_abbr[d].upper() for d in sorted(set(weekdays or [])) if 0 <= d <= 6)


def _month_bounds(period: str):
    year, month = (int(x) for x in period.split("-"))
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def _g(d: Optional[dict], key: str, default=None):
    return (d or {}).get(key) or default


def build_payslip_pdf(
    company_name: Optional[str],
    company_address: Optional[str],
    logo_bytes: Optional[bytes],
    period: str,
    row: dict,
    employee_doc: Optional[dict],
    weekly_off_days,
) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=14 * mm, bottomMargin=14 * mm, leftMargin=16 * mm, rightMargin=16 * mm,
    )
    navy = colors.HexColor("#1B4B73")
    green = colors.HexColor("#1B7A3D")
    orange = colors.HexColor("#C0522D")

    styles = getSampleStyleSheet()
    center = ParagraphStyle("center", parent=styles["Normal"], alignment=TA_CENTER)
    company_style = ParagraphStyle("company", parent=center, fontName="Helvetica-Bold", fontSize=11, leading=13, textColor=navy)
    address_style = ParagraphStyle("address", parent=center, fontName="Helvetica", fontSize=8.5, leading=11, textColor=navy)
    title_style = ParagraphStyle("title", parent=center, fontName="Helvetica-Bold", fontSize=11, leading=14, spaceBefore=4, textColor=navy)
    subtitle_style = ParagraphStyle("subtitle", parent=center, fontName="Helvetica", fontSize=9, leading=11, textColor=navy)
    footer_style = ParagraphStyle("footer", parent=styles["Normal"], fontName="Helvetica-Oblique", fontSize=8, leading=10)
    net_pay_style = ParagraphStyle("netPay", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, textColor=green)
    tds_style = ParagraphStyle("tds", parent=styles["Normal"], fontName="Helvetica-Oblique", fontSize=8.5, textColor=orange)

    story = []

    if logo_bytes:
        try:
            img = Image(BytesIO(logo_bytes))
            img._restrictSize(50 * mm, 25 * mm)
            img.hAlign = "CENTER"
            story.append(img)
            story.append(Spacer(1, 3 * mm))
        except Exception:
            pass  # a broken/unsupported logo image shouldn't block payslip generation

    if company_name:
        story.append(Paragraph(company_name, company_style))
    if company_address:
        story.append(Paragraph(company_address, address_style))

    year, month = (int(x) for x in period.split("-"))
    month_start, month_end = _month_bounds(period)
    story.append(Paragraph(f"Pay Slip For the Month of {_MONTH_NAMES[month]}-{year}", title_style))
    story.append(Paragraph(f"(From {month_start.strftime('%d/%m/%Y')} To {month_end.strftime('%d/%m/%Y')})", subtitle_style))
    story.append(Spacer(1, 4 * mm))

    # ── Employee / attendance info block ──────────────────────────────────────────
    wk_off_label = _fmt_days(row.get("wk_off")) or "0"
    off_days = _weekday_abbrs(weekly_off_days)
    if off_days:
        wk_off_label += f" ({off_days})"

    info_rows = [
        ("Employee Name", row.get("name"), "Employee Code", row.get("code")),
        ("Father's Name", row.get("father_husband_name"), "DOJ", row.get("doj")),
        ("Bank A/c No.", _g(employee_doc, "account_no"), "ESI A/c No", _g(employee_doc, "esi_no", "N.A.")),
        ("Designation", _g(employee_doc, "designation"), "Bank Name", _g(employee_doc, "bank_name")),
        ("Pay Mode", _g(employee_doc, "pay_mode"), "Gender", row.get("gender")),
        ("E-Mail", _g(employee_doc, "email"), "", ""),
        ("Month Days", _fmt_days(row.get("total_days")), "Total Paid Days", _fmt_days(row.get("net_paid_days"))),
        ("Weekly-Off", wk_off_label, "Days-Off", 0),
        ("Paid Holidays", _fmt_days(row.get("holiday")), "Unpaid Holidays", 0),
        ("Working Days", _fmt_days(row.get("max_work_days")), "Max Payable Days", _fmt_days(row.get("max_payable_days"))),
        ("LWP", _fmt_days(row.get("absent_lwp")), "Net Paid Days", _fmt_days(row.get("net_paid_days"))),
        ("Present Days", _fmt_days(row.get("present_days")), "Paid Leaves", _fmt_days(row.get("total_leaves"))),
    ]
    info_table_data = [
        [l1, f": {v1 if v1 is not None else ''}", l2, f": {v2 if v2 is not None else ''}" if l2 else ""]
        for l1, v1, l2, v2 in info_rows
    ]
    info_table = Table(info_table_data, colWidths=[32 * mm, 55 * mm, 32 * mm, 55 * mm])
    info_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.75, colors.black),
        ("INNERGRID", (0, 0), (-1, -1), 0, colors.white),
        ("LINEABOVE", (0, 6), (-1, 6), 0.75, colors.black),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica", 8.5),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold", 8.5),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold", 8.5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 4 * mm))

    # ── Earnings / Deductions table ────────────────────────────────────────────────
    def item_rows(items):
        out = []
        for key, label in items:
            scale, amount = row.get(key), row.get(f"{key}_actual")
            if not scale and not amount:
                continue
            out.append((label, _fmt(scale), _fmt(amount)))
        return out

    earning_rows = item_rows(_EARNING_ITEMS)
    deduction_rows = item_rows(_DEDUCTION_ITEMS)
    gross_earning_scale = row.get("gross_earning") or 0
    gross_earning_actual = row.get("gross_earning_actual") or 0
    gross_deduction_scale = row.get("gross_deduction") or 0
    gross_deduction_actual = sum(row.get(f"{k}_actual") or 0 for k, _ in _DEDUCTION_ITEMS)

    label_style = ParagraphStyle("cellLabel", parent=styles["Normal"], fontName="Helvetica", fontSize=8, leading=9.5)
    label_style_bold = ParagraphStyle("cellLabelBold", parent=label_style, fontName="Helvetica-Bold")

    def cell_label(text, bold=False):
        return Paragraph(text, label_style_bold if bold else label_style) if text else ""

    n_rows = max(len(earning_rows), len(deduction_rows))
    ed_data = [[cell_label("Earnings", True), "Scale Rs.", "Amount Rs.", cell_label("Deductions", True), "Scale Rs.", "Amount Rs."]]
    for i in range(n_rows):
        e = earning_rows[i] if i < len(earning_rows) else ("", "", "")
        d = deduction_rows[i] if i < len(deduction_rows) else ("", "", "")
        ed_data.append([cell_label(e[0]), e[1] if e[0] else "", e[2] if e[0] else "", cell_label(d[0]), d[1] if d[0] else "", d[2] if d[0] else ""])
    ed_data.append([cell_label("Total Earnings", True), _fmt(gross_earning_scale), _fmt(gross_earning_actual),
                     cell_label("Total Deductions", True), _fmt(gross_deduction_scale), _fmt(gross_deduction_actual)])

    ed_table = Table(ed_data, colWidths=[40 * mm, 20 * mm, 20 * mm, 40 * mm, 20 * mm, 20 * mm])
    ed_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.75, colors.black),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold", 8.5),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold", 8.5),
        ("FONTNAME", (0, 1), (-1, -2), "Helvetica", 8.5),
        ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
        ("ALIGN", (1, 0), (2, -1), "RIGHT"), ("ALIGN", (4, 0), (5, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(ed_table)
    story.append(Spacer(1, 2 * mm))

    # ── Net pay summary ─────────────────────────────────────────────────────────────
    net_pay = row.get("net_amt_payable") or 0
    words = number_to_words_inr(net_pay)
    tds_amount = row.get("tds_actual") or 0
    summary_data = [
        [Paragraph(f"Net Pay : Rs. {_fmt(net_pay)}", net_pay_style)],
        [Paragraph(f"In Words : Rs. {words} Only", net_pay_style)],
        [Paragraph(f"TDS Deducted Upto {_MONTH_NAMES[month]}-{year} : Rs. {_fmt(tds_amount) if tds_amount else 'Nil'}", tds_style)],
    ]
    summary_table = Table(summary_data, colWidths=[188 * mm])
    summary_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.75, colors.black),
        ("LINEBELOW", (0, 0), (-1, 1), 0.4, colors.grey),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph("This is a Computer Generated Sheet, does not require Signature.", footer_style))

    doc.build(story)
    return buf.getvalue()
