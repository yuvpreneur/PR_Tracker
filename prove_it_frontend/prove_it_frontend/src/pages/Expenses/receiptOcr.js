// tesseract.js and pdfjs-dist are both dynamically imported below (not statically here)
// so their ~500KB of JS only loads for someone who actually clicks "Upload File" on the
// Expenses page, instead of bloating every page's initial bundle.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Best-effort heuristic parsing of OCR'd receipt text — there's no layout model behind
// this, just keyword/regex guesses meant to save typing, not a guaranteed-correct read.
// The Add Expense form stays fully editable so a wrong guess just gets corrected.
const CATEGORY_KEYWORDS = {
  Travel: ['taxi', 'uber', 'ola', 'flight', 'airlines', 'airways', 'hotel', 'cab', 'railway', 'train', 'fuel', 'petrol', 'diesel'],
  Software: ['software', 'subscription', 'license', 'saas', 'adobe', 'microsoft', 'aws', 'amazon web services', 'google cloud', 'azure', 'github', 'slack', 'zoom'],
  Material: ['stationery', 'hardware', 'supplies', 'material', 'equipment', 'furniture', 'printer', 'cartridge'],
};

// A PDF "receipt" saved via a browser's Print/Save-as-PDF often bakes its print header
// (timestamp + doc title) and footer (page URL, page number) into the page as literal
// text — none of that is part of the receipt itself, so it's filtered out before any
// field extraction runs (it otherwise reads as a very convincing fake vendor/date).
const NOISE_LINE_PATTERNS = [
  /^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}\s*(am|pm)?/i, // e.g. "7/30/26, 11:30 AM" (may trail into the page title on the same line)
  /^https?:\/\//i,
  /^\d+\/\d+$/,
];
const isNoiseLine = line => NOISE_LINE_PATTERNS.some(re => re.test(line.trim()));

// The page-title half of a print header ("Invoice · ProveIT") sometimes lands on its own
// OCR'd line, separate from the timestamp above. Only trusted within the first couple of
// lines, and only when it starts with a generic document-type word no real vendor is
// named after — a store's actual name (e.g. "Joe's Pizza - Downtown") never triggers this.
const HEADER_TITLE_RE = /^(invoice|receipt|statement|bill|order|estimate)\s*[·|-]\s*.{1,40}$/i;

function stripLeadingPrintChrome(lines) {
  let start = 0;
  while (start < lines.length && start < 2 && HEADER_TITLE_RE.test(lines[start])) start++;
  return lines.slice(start);
}

const AMOUNT_KEYWORDS_RE = /total|amount due|balance due|amount paid|net amount/i;
// The comma-grouped branch requires at least one group (`+`, not `*`) so a plain run of
// digits with no separators (e.g. "354000.00") falls through to the second branch and
// matches in full, instead of the first branch greedily claiming just its first 3 digits
// and leaving "000.00" behind as a separate, spurious near-zero match.
const NUMBER_RE = /(?:₹|rs\.?|inr)?\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi;

const DATE_PATTERNS = [
  { re: /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/, kind: 'numeric' },
  { re: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/, kind: 'iso' },
  { re: /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/, kind: 'monthDayYear' },
  { re: /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{2,4})\b/, kind: 'dayMonthYear' },
];

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const monthIndex = name => (name.slice(0, 3).toLowerCase() in MONTHS ? MONTHS[name.slice(0, 3).toLowerCase()] : null);

function toIsoDate(year, month0, day) {
  if (year < 100) year += year < 70 ? 2000 : 1900;
  const d = new Date(Date.UTC(year, month0, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month0 || d.getUTCDate() !== day) return null;
  return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateFromLine(line) {
  for (const { re, kind } of DATE_PATTERNS) {
    const m = re.exec(line);
    if (!m) continue;
    let iso = null;
    if (kind === 'numeric') {
      const [, a, b, y] = m.map(Number);
      iso = toIsoDate(y, a - 1, b) || toIsoDate(y, b - 1, a); // mirrors the backend's dayfirst=False-first, then swap
    } else if (kind === 'iso') {
      const [, y, mo, d] = m.map(Number);
      iso = toIsoDate(y, mo - 1, d);
    } else if (kind === 'monthDayYear') {
      const mo = monthIndex(m[1]);
      if (mo !== null) iso = toIsoDate(Number(m[3]), mo, Number(m[2]));
    } else if (kind === 'dayMonthYear') {
      const mo = monthIndex(m[2]);
      if (mo !== null) iso = toIsoDate(Number(m[3]), mo, Number(m[1]));
    }
    if (iso) return iso;
  }
  return null;
}

function extractDate(lines) {
  // A line explicitly labeled as a date (Issue date, Due date, Expense date, plain
  // "Date:"...) is a far more reliable signal than the first date-shaped token anywhere
  // on the page — an invoice/PO number or a stray "120" quantity can coincidentally match
  // the same numeric shape.
  const labeled = lines.find(l => /\bdate\b/i.test(l));
  for (const line of labeled ? [labeled, ...lines] : lines) {
    const iso = dateFromLine(line);
    if (iso) return iso;
  }
  return null;
}

function numbersIn(line) {
  const out = [];
  NUMBER_RE.lastIndex = 0;
  let m;
  while ((m = NUMBER_RE.exec(line))) {
    const cleaned = m[1]?.replace(/,/g, '').trim();
    if (!cleaned) continue;
    const val = parseFloat(cleaned);
    if (!Number.isNaN(val) && val > 0) out.push(val);
  }
  return out;
}

function extractAmount(lines) {
  const keywordHits = lines.filter(l => AMOUNT_KEYWORDS_RE.test(l)).flatMap(numbersIn);
  if (keywordHits.length) return Math.max(...keywordHits);
  // No "total"-style line found at all — fall back to the largest number on the
  // receipt, since the grand total is usually the biggest figure printed.
  const allNums = lines.flatMap(numbersIn).filter(n => n > 1);
  return allNums.length ? Math.max(...allNums) : null;
}

// A document number ("INV-0001", "PO #4471"...) commonly sits right-aligned on the same
// visual row as the business name, and OCR merges same-row text into one line regardless
// of the horizontal gap between them — strip it back off rather than treat it as part of
// the vendor's name.
const TRAILING_REF_RE = /\s+(?:inv(?:oice)?|po|ref|bill|order|no)\.?\s*[-#:]?\s*\d{2,}\s*$/i;

function extractVendor(lines) {
  for (const raw of lines) {
    const cleaned = raw.trim();
    if (cleaned.length < 2 || /^[\d\W_]+$/.test(cleaned)) continue;
    return cleaned.replace(TRAILING_REF_RE, '').trim().slice(0, 100);
  }
  return null;
}

function extractCategory(text) {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return category;
  }
  return 'Misc';
}

const TABLE_HEADER_RE = /\bqty\b.*\b(item|description)\b|\bdescription\b.*\b(qty|quantity|amount|price)\b/i;
const TABLE_END_RE = /subtotal|^total\b|amount due|balance due/i;

// Column-aligned table text (item name, qty, price, total all on one OCR'd line) reliably
// keeps the multiple-space gaps between columns even when OCR normalizes everything else,
// so splitting on 2+ spaces recovers the original columns often enough to rely on.
const splitColumns = line => line.split(/\s{2,}/).map(c => c.trim()).filter(Boolean);

function extractDescription(lines, vendor) {
  // Invoice-shaped receipts have a line-items table — the item/description column of the
  // row right after the header (e.g. "DESCRIPTION / QTY / ...", or "QTY / ITEM / PRICE" —
  // column order varies) is the actual work/item description, far more useful than the
  // whole row (which also drags in qty/price/total) or the surrounding BILL TO/date block.
  const headerIdx = lines.findIndex(l => TABLE_HEADER_RE.test(l));
  if (headerIdx !== -1) {
    const descColIdx = splitColumns(lines[headerIdx]).findIndex(c => /^(description|item)$/i.test(c));
    for (const line of lines.slice(headerIdx + 1)) {
      const candidate = line.trim();
      if (!candidate) continue;
      if (TABLE_END_RE.test(candidate)) break;
      const cols = descColIdx !== -1 ? splitColumns(candidate) : [];
      if (cols[descColIdx]) return cols[descColIdx].slice(0, 150);
      // Columns didn't line up (spacing collapsed to single spaces) — fall back to
      // cutting the row right before its first standalone number, which is usually
      // where the qty/price columns begin.
      const cut = /\s(?:₹|\$|rs\.?|inr)?\d/i.exec(candidate);
      return (cut ? candidate.slice(0, cut.index) : candidate).trim().slice(0, 150);
    }
  }
  const body = lines.map(l => l.trim()).filter(l => l && l !== vendor);
  const middle = body.length > 2 ? body.slice(1, -1) : body;
  return middle.join(' ').trim().slice(0, 150) || null;
}

export function parseReceipt(text) {
  const lines = stripLeadingPrintChrome(text.split('\n').filter(l => l.trim() && !isNoiseLine(l)));
  const vendor = extractVendor(lines);
  return {
    category: extractCategory(text),
    expense_date: extractDate(lines),
    amount: extractAmount(lines),
    vendor,
    description: extractDescription(lines, vendor),
  };
}

const MAX_PDF_PAGES = 3; // receipts are essentially never more than a couple pages

async function renderPdfPagesToCanvases(file) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const canvases = [];
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 3 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    canvases.push(canvas);
  }
  return canvases;
}

async function ocrText(file) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    if (file.type === 'application/pdf') {
      const canvases = await renderPdfPagesToCanvases(file);
      const texts = [];
      for (const canvas of canvases) {
        const { data } = await worker.recognize(canvas);
        texts.push(data.text);
      }
      return texts.join('\n');
    }
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

// Runs entirely client-side (WebAssembly) — no server-side OCR dependency, so this works
// identically wherever the backend is hosted. See PR_Tracker's Expenses "Upload File"
// discussion for why: Tesseract's system binary can't be installed on Render's native
// Python runtime, but tesseract.js sidesteps that by never needing a server at all.
export async function extractReceiptFields(file) {
  const text = await ocrText(file).catch(() => '');
  return parseReceipt(text);
}
