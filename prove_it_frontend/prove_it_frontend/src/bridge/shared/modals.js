// Modal helpers, field finders, edit state, wireBtn

export function openModal(id) {
  if (typeof window.openModal === 'function') window.openModal(id);
  else { const m = document.getElementById(id); if (m) m.style.display = 'flex'; }
}

export function closeModal(id) {
  if (typeof window._origCloseModal === 'function') window._origCloseModal();
  else if (typeof window.closeModal === 'function') window.closeModal(id);
  else { const m = document.getElementById(id); if (m) m.style.display = 'none'; }
}

// Find an input/select/textarea by its label text inside a modal
export function field(modalId, hint) {
  const modal = document.getElementById(modalId);
  if (!modal) return null;
  const h = hint.toLowerCase();
  for (const lbl of modal.querySelectorAll('label, .form-label')) {
    if (!lbl.textContent.trim().toLowerCase().includes(h)) continue;
    if (lbl.htmlFor) { const el = document.getElementById(lbl.htmlFor); if (el) return el; }
    let sib = lbl.nextElementSibling;
    while (sib) {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(sib.tagName)) return sib;
      const n = sib.querySelector('input,select,textarea');
      if (n) return n;
      sib = sib.nextElementSibling;
    }
    const grp = lbl.closest('.form-group,.mb-3,.col-md-6,.col-6') || lbl.parentElement;
    const n = grp?.querySelector('input,select,textarea');
    if (n) return n;
  }
  return null;
}

export const val = (m, h, def = '') => field(m, h)?.value?.trim() || def;

export function set(m, h, v) { const el = field(m, h); if (el) el.value = v ?? ''; }

// Clears every input/select/textarea inside a modal. These modals are persistent DOM
// nodes shared between Edit and Create (set() populates fields for Edit; nothing ever
// clears them afterward) — without this, opening "+ New X" right after editing/viewing
// a record starts the form pre-filled with that record's values instead of blank.
export function resetFields(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.querySelectorAll('input, textarea').forEach(el => {
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
    else el.value = '';
  });
  modal.querySelectorAll('select').forEach(el => { el.selectedIndex = 0; });
  // input.value = '' above already clears a file input's selection — this just restores
  // the attach-zone's label text, which the change handler in bridge/index.js overwrote
  // with the picked filename and won't otherwise revert on its own.
  modal.querySelectorAll('.attach-zone[data-default-label]').forEach(zone => {
    const label = zone.querySelector('[data-attach-label]');
    if (label) label.textContent = zone.dataset.defaultLabel;
  });
}

export function fillSel(el, items, vk, lk, ph = 'Select…') {
  if (!el || el.tagName !== 'SELECT') return;
  const cur = el.value;
  el.innerHTML = `<option value="">${ph}</option>` +
    items.map(i => `<option value="${i[vk]}">${i[lk]}</option>`).join('');
  if (cur) el.value = cur;
}

// Edit state per page — tracks whether modal is editing an existing record or creating new
export const editState = {};
export const startEdit   = (pg, id) => { editState[pg] = { id, editing: true }; };
export const startCreate = pg       => { editState[pg] = { id: null, editing: false }; };
export const editId      = pg       => editState[pg]?.id || null;

// Wire a modal's primary button to an async submit handler
export function wireBtn(modalId, onSubmit) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const btn = modal.querySelector('.btn-primary, .btn-danger, button[type="submit"]');
  if (!btn) return;
  btn.onclick = async e => {
    e.preventDefault(); e.stopPropagation();
    btn.disabled = true;
    try { await onSubmit(); } catch { /* toast shown by _req */ }
    finally { btn.disabled = false; }
  };
}
