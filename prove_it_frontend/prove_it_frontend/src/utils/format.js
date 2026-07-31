// Relocated verbatim from src/bridge/shared/ui.js as part of the bridge-removal migration
// (Phase 1) — canonical location for new React code. bridge/shared/ui.js keeps its own
// copy for the still-legacy pages until they're migrated off bridge entirely.

import { CURRENCIES } from './constants.js';

export const date = d => d ? String(d).slice(0, 10) : '—';

export const formatMoney = (amount, currencyCode = 'INR') => {
  const symbol = CURRENCIES.find(c => c.code === currencyCode)?.symbol || currencyCode + ' ';
  const n = (Number(amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbol}${n}`;
};

export const num = n => {
  if (!n) return '0';
  if (n >= 10000000) return (n / 10000000).toFixed(1) + 'Cr';
  if (n >= 100000)   return (n / 100000).toFixed(1)   + 'L';
  if (n >= 1000)     return (n / 1000).toFixed(1)     + 'K';
  return String(Math.round(n));
};

// Generic period -> {date_from, date_to} — used by audit, timesheets
export function periodRange(period) {
  const today = new Date();
  const fmt = d => d.toISOString().slice(0, 10);
  if (period === 'today' || !period) {
    const t = fmt(today); return { date_from: t, date_to: t };
  }
  if (period === 'this_week') {
    const dow = today.getDay();
    const mon = new Date(today); mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
    const sun = new Date(mon);   sun.setDate(mon.getDate() + 6);
    return { date_from: fmt(mon), date_to: fmt(sun) };
  }
  if (period === 'last_week') {
    const dow = today.getDay();
    const mon = new Date(today); mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) - 7);
    const sun = new Date(mon);   sun.setDate(mon.getDate() + 6);
    return { date_from: fmt(mon), date_to: fmt(sun) };
  }
  if (period === 'this_month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    const to   = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { date_from: fmt(from), date_to: fmt(to) };
  }
  if (period === 'last_month') {
    const to   = new Date(today.getFullYear(), today.getMonth(), 0);
    const from = new Date(to.getFullYear(), to.getMonth(), 1);
    return { date_from: fmt(from), date_to: fmt(to) };
  }
  if (period === 'q1_2026')    return { date_from: '2026-01-01', date_to: '2026-03-31' };
  if (period === 'fy_2025_26') return { date_from: '2025-04-01', date_to: '2026-03-31' };
  return {};
}
