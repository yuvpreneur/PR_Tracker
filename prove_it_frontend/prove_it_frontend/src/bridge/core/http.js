import { toast } from '../shared/ui.js';
import { API_BASE_URL } from '../../utils/constants.js';
const _tok = () => localStorage.getItem('token');

async function _req(method, path, body = null) {
  const headers = { Authorization: `Bearer ${_tok()}` };
  const opts = { method, headers };
  if (body) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const r = await fetch(API_BASE_URL + path, opts);
  if (r.status === 401) { localStorage.removeItem('token'); location.reload(); return null; }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    // Every page component mounts up front (see useBridgeMount.js) and fetches its own
    // data regardless of whether the current role can see that page, so a background GET
    // 403ing on an admin/manager-only endpoint is expected noise, not a real failure —
    // toasting it just stacks red "Requires role: ..." banners on every role switch.
    // Direct user actions (POST/PATCH/DELETE) still surface their 403s.
    if (!(r.status === 403 && method === 'GET')) toast(data.detail || 'Request failed', 'error');
    throw new Error(data.detail);
  }
  return data;
}

export const get   = p      => _req('GET',   p);
export const post  = (p, b) => _req('POST',  p, b);
export const patch = (p, b) => _req('PATCH', p, b);
export const del   = p      => _req('DELETE', p);

export function qs(params) {
  if (!params) return '';
  const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v && v !== ''));
  const s = new URLSearchParams(p).toString();
  return s ? '?' + s : '';
}
