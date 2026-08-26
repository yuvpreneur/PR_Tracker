import { useState } from 'react';
import { ShieldCheck, UserCog, Wallet, User, Eye, Plus, Pencil, Trash2, Check, Download, Save } from 'lucide-react';
import useRolePermissions from './useRolePermissions.js';
import Button from '../../components/ui/Button.jsx';
import SectionTitle from '../../components/ui/SectionTitle.jsx';

const ROLE_TABS = ['Admin', 'Manager', 'Finance User', 'Employee'];
const ROLE_ICONS = { Admin: ShieldCheck, Manager: UserCog, 'Finance User': Wallet, Employee: User };
const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export'];
const ACTION_LABELS = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', approve: 'Approve', export: 'Export' };
const ACTION_ICONS = { view: Eye, create: Plus, edit: Pencil, delete: Trash2, approve: Check, export: Download };

// Manager is Admin-equivalent everywhere (see FULL_ACCESS_ROLES, app/core/permissions.py)
// so its tab is read-only full-access too, same as Admin's — there's nothing to configure.
const FULL_ACCESS_TAB_ROLES = new Set(['Admin', 'Manager']);

export default function RolesPage() {
  const [role, setRole] = useState('Admin');
  const { rows, loading, saving, toggle, save } = useRolePermissions(role);
  const isFullAccessTab = FULL_ACCESS_TAB_ROLES.has(role);

  return (
    <div>
      <div className="page-header">
        <h2><ShieldCheck size={22} /> Roles &amp; Permissions</h2>
      </div>

      <div className="role-tabs">
        {ROLE_TABS.map(r => {
          const RoleIcon = ROLE_ICONS[r];
          return (
            <button
              key={r}
              className={`role-tab${r === role ? ' active' : ''}`}
              onClick={() => setRole(r)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RoleIcon size={14} /> {r}
            </button>
          );
        })}
      </div>

      <div className="card" id="perm-card">
        <SectionTitle icon={ROLE_ICONS[role]}>
          PERMISSIONS FOR: <span style={{ color: 'var(--rose)' }}>{role}</span>
        </SectionTitle>

        <div id="perm-rows">
          {loading && <div style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>Loading…</div>}
          {!loading && rows.map(r => (
            <div className="perm-row" key={r.module}>
              <span>{r.module}</span>
              <div className="perm-checks">
                {ACTIONS.map(a => {
                  // Delete is exclusive to Admin/Manager and can never be delegated to
                  // another role (app/core/permissions.py enforces this on the backend
                  // regardless of what gets saved here) — grey it out so the UI doesn't
                  // imply otherwise.
                  const deleteLocked = a === 'delete' && !isFullAccessTab;
                  const locked = isFullAccessTab || deleteLocked;
                  const ActionIcon = ACTION_ICONS[a];
                  return (
                    <label
                      className="perm-check"
                      key={a}
                      title={deleteLocked ? 'Only Admin/Manager can delete records — this cannot be granted to other roles' : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={isFullAccessTab ? true : !!r[a]}
                        disabled={locked}
                        onChange={e => toggle(r.module, a, e.target.checked)}
                      />
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ActionIcon size={12} /> {ACTION_LABELS[a]}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          {isFullAccessTab ? (
            <span style={{ color: '#94a3b8', fontSize: 13 }}>{role} always has full access — nothing to configure here.</span>
          ) : (
            <Button variant="primary" onClick={save} disabled={loading || saving}>
              <Save size={15} /> {saving ? 'Saving…' : 'Save Permissions'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
