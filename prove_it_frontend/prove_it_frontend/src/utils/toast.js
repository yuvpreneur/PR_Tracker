// Relocated verbatim from src/bridge/shared/ui.js as part of the bridge-removal migration
// (Phase 1) — canonical location for new React code. bridge/shared/ui.js keeps its own
// copy for the still-legacy pages until they're migrated off bridge entirely.
export function toast(msg, type = 'success') {
  const bg = { success: '#22c55e', error: '#ef4444', info: '#3b82f6' }[type] || '#3b82f6';
  const el = Object.assign(document.createElement('div'), {
    textContent: msg,
    style: `position:fixed;top:24px;right:24px;z-index:99999;padding:12px 22px;border-radius:10px;` +
           `font-size:14px;font-weight:500;color:#fff;background:${bg};` +
           `box-shadow:0 4px 24px rgba(0,0,0,.18);pointer-events:none;` +
           `max-width:380px;white-space:normal;line-height:1.45;`,
  });
  document.body.appendChild(el);
  // Longer messages (e.g. detailed validation errors) get more time on screen to read.
  const duration = Math.min(7000, Math.max(3500, msg.length * 60));
  setTimeout(() => el.remove(), duration);
}
