// Relocated from src/bridge/core/http.js as part of the bridge-removal migration (Phase 1)
// — canonical location for new React code. Framework-agnostic as-is; only the toast
// import path changed (now src/utils/toast.js instead of the legacy bridge/shared/ui.js).
import { toast } from '../utils/toast.js';
import { API_BASE_URL } from '../utils/constants.js';

const _tok = () => localStorage.getItem('token');

// A single background request 401ing doesn't necessarily mean the session is dead —
// on every login, every page's hook fires its own request concurrently, and a lone
// transient hiccup (slow backend wake-up, dropped connection) used to nuke the token
// and reload the whole app even though every other request succeeded. Re-verify
// against /auth/me before giving up, and share one in-flight check across all callers
// so a burst of simultaneous 401s only triggers a single recheck.
let _sessionCheck = null;
async function _sessionStillValid() {
  if (!_sessionCheck) {
    _sessionCheck = fetch(API_BASE_URL + '/api/auth/me', { headers: { Authorization: `Bearer ${_tok()}` } })
      .then(r => r.ok)
      .catch(() => false)
      .finally(() => { _sessionCheck = null; });
  }
  return _sessionCheck;
}

async function _req(method, path, body = null, _retried = false) {
  const headers = { Authorization: `Bearer ${_tok()}` };
  const opts = { method, headers };
  if (body) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const r = await fetch(API_BASE_URL + path, opts);
  if (r.status === 401) {
    if (!_retried && await _sessionStillValid()) return _req(method, path, body, true);
    localStorage.removeItem('token');
    location.reload();
    return null;
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    // Every page component mounts up front and fetches its own data regardless of whether
    // the current role can see that page, so a background GET 403ing on an admin/manager-
    // only endpoint is expected noise, not a real failure — toasting it just stacks red
    // "Requires role: ..." banners on every role switch. Direct user actions (POST/PATCH/
    // DELETE) still surface their 403s.
    if (!(r.status === 403 && method === 'GET')) toast(data.detail || 'Request failed', 'error');
    throw new Error(data.detail);
  }
  return data;
}

export const get   = p      => _req('GET',   p);
export const post  = (p, b) => _req('POST',  p, b);
export const patch = (p, b) => _req('PATCH', p, b);
export const del   = p      => _req('DELETE', p);

// Multipart upload — no Content-Type header, the browser sets the boundary itself.
export async function uploadFile(path, file, _retried = false) {
  const form = new FormData();
  form.append('file', file);
  const r = await fetch(API_BASE_URL + path, { method: 'POST', headers: { Authorization: `Bearer ${_tok()}` }, body: form });
  if (r.status === 401) {
    if (!_retried && await _sessionStillValid()) return uploadFile(path, file, true);
    localStorage.removeItem('token');
    location.reload();
    return null;
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { toast(data.detail || 'Upload failed', 'error'); throw new Error(data.detail); }
  return data;
}

// Attachment endpoints require the same Bearer auth as everything else, so a plain
// <a href> can't hit them directly — fetch the bytes ourselves and open a blob: URL.
export async function viewAttachment(path, _retried = false) {
  const r = await fetch(API_BASE_URL + path, { headers: { Authorization: `Bearer ${_tok()}` } });
  if (r.status === 401) {
    if (!_retried && await _sessionStillValid()) return viewAttachment(path, true);
    localStorage.removeItem('token');
    location.reload();
    return;
  }
  if (!r.ok) { toast('Could not open attachment', 'error'); return; }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function qs(params) {
  if (!params) return '';
  const p = Object.fromEntries(Object.entries(params).filter(([, v]) => v && v !== ''));
  const s = new URLSearchParams(p).toString();
  return s ? '?' + s : '';
}
