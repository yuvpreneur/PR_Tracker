import { get, post } from '../core/http.js';
import { toast } from '../shared/ui.js';

const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export'];
const ACTION_LABELS = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', approve: 'Approve', export: 'Export' };

let currentRole = 'Admin';

async function renderRolePerms(role) {
  currentRole = role;
  const nameEl = document.getElementById('role-name');
  if (nameEl) nameEl.textContent = role;

  const rows = await get(`/api/role-permissions/${encodeURIComponent(role)}`).catch(() => []);
  const container = document.getElementById('perm-rows');
  if (!container) return;
  container.innerHTML = rows.map(r => `
    <div class="perm-row">
      <span>${r.module}</span>
      <div class="perm-checks">
        ${ACTIONS.map(a => `<label class="perm-check"><input type="checkbox" data-module="${r.module}" data-action="${a}" ${r[a] ? 'checked' : ''} /><span>${ACTION_LABELS[a]}</span></label>`).join('')}
      </div>
    </div>`).join('');
}

async function saveRolePermissions() {
  const boxes = document.querySelectorAll('#perm-rows input[type="checkbox"]');
  const byModule = {};
  boxes.forEach(cb => {
    const mod = cb.dataset.module;
    byModule[mod] = byModule[mod] || { module: mod };
    byModule[mod][cb.dataset.action] = cb.checked;
  });
  await post('/api/role-permissions/', { role: currentRole, permissions: Object.values(byModule) });
  toast('Permissions saved');
}

export async function loadRoles() {
  if (!window._rolesTabOverridden) {
    window._rolesTabOverridden = true;
    // Replace the legacy inert selectRole (hardcoded, never persisted) with the real, backend-driven version.
    // The static tab buttons already call onclick="selectRole(this, 'RoleName')" — this override intercepts that.
    window.selectRole = (btn, role) => {
      document.querySelectorAll('#page-roles .role-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderRolePerms(role);
    };
    document.querySelector('#page-roles .btn-primary')?.addEventListener('click', saveRolePermissions);
  }
  const activeTab = document.querySelector('#page-roles .role-tab.active');
  await renderRolePerms(activeTab ? activeTab.textContent.trim() : 'Admin');
}
