import { useState } from 'react';
import { UserCog, Plus, KeyRound, Ban, RotateCcw } from 'lucide-react';
import useSubAdmins from './useSubAdmins.js';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';

// Must stay in sync with PLATFORM_MODULES in app/core/security.py.
const PLATFORM_MODULE_OPTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'organizations', label: 'Organizations' },
  { key: 'plans', label: 'Plans' },
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'free_access', label: 'Free Access' },
  { key: 'settings', label: 'Platform Settings' },
  { key: 'operations', label: 'Operations' },
];

const blankSubAdmin = { username: '', password: '', name: '', email: '', platform_permissions: [] };

export default function SubAdminsPage() {
  const { subAdmins, loading, createSubAdmin, updateSubAdmin, resetPassword } = useSubAdmins();

  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);

  const togglePermission = (key) => {
    const has = editing.platform_permissions.includes(key);
    setEditing({
      ...editing,
      platform_permissions: has
        ? editing.platform_permissions.filter(p => p !== key)
        : [...editing.platform_permissions, key],
    });
  };

  const save = async () => {
    if (!editing.name.trim() || !editing.email.trim()) { setFormError('Name and email are required.'); return; }
    if (!editing.id && (!editing.username.trim() || !editing.password)) { setFormError('Username and password are required.'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (editing.id) {
        await updateSubAdmin(editing.id, {
          name: editing.name, email: editing.email, platform_permissions: editing.platform_permissions,
        });
      } else {
        await createSubAdmin({
          username: editing.username, password: editing.password, name: editing.name,
          email: editing.email, platform_permissions: editing.platform_permissions,
        });
      }
      setEditing(null);
    } catch (err) {
      setFormError(err.message || 'Could not save this Sub-Admin.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = (sa) => updateSubAdmin(sa.id, { is_active: !sa.is_active });

  const submitReset = async () => {
    if (newPassword.length < 6) { setResetError('New password must be at least 6 characters.'); return; }
    setResetting(true);
    setResetError('');
    try {
      await resetPassword(resetTarget.id, newPassword);
      setResetTarget(null);
      setNewPassword('');
    } catch (err) {
      setResetError(err.message || 'Could not reset this password.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div>
      <div className="section-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><UserCog size={22} /> Sub-Admins</h2>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <Button variant="primary" onClick={() => { setEditing({ ...blankSubAdmin }); setFormError(''); }}>
          <Plus size={14} /> Add Sub-Admin
        </Button>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Admin</th><th>Permissions</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {subAdmins.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
                  {loading ? 'Loading…' : 'No Sub-Admins yet.'}
                </td>
              </tr>
            )}
            {subAdmins.map(sa => (
              <tr key={sa.id}>
                <td>
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>{sa.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{sa.email}</div>
                </td>
                <td style={{ maxWidth: 260 }}>
                  {sa.platform_permissions.length === 0
                    ? <span style={{ color: 'var(--muted)', fontSize: 11.5 }}>None</span>
                    : sa.platform_permissions.map(key => (
                      <span key={key} className="badge badge-muted" style={{ marginRight: 4 }}>
                        {PLATFORM_MODULE_OPTIONS.find(o => o.key === key)?.label || key}
                      </span>
                    ))}
                </td>
                <td><Badge status={sa.is_active ? 'Active' : 'Inactive'} /></td>
                <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-sm"
                    style={{ background: 'var(--soft)', color: 'var(--accent)', border: '1px solid var(--line)' }}
                    onClick={() => { setEditing({ ...blankSubAdmin, ...sa, password: '' }); setFormError(''); }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ background: 'var(--soft)', color: 'var(--accent)', border: '1px solid var(--line)' }}
                    onClick={() => { setResetTarget(sa); setNewPassword(''); setResetError(''); }}
                  >
                    <KeyRound size={13} /> Reset PW
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ background: 'var(--soft)', color: 'var(--accent)', border: '1px solid var(--line)' }}
                    onClick={() => toggleActive(sa)}
                  >
                    {sa.is_active ? <><Ban size={13} /> Deactivate</> : <><RotateCcw size={13} /> Activate</>}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing.id ? `Edit ${editing.name}` : 'Add Sub-Admin'} onClose={() => setEditing(null)}>
          {formError && (
            <p style={{ color: 'var(--red)', fontSize: 13, background: 'var(--red-soft)', padding: '8px 12px', borderRadius: 10, marginBottom: 12 }}>
              {formError}
            </p>
          )}
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input className="form-control" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} />
          </div>
          {!editing.id && (
            <>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-control" value={editing.username} onChange={e => setEditing({ ...editing, username: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-control" type="password" value={editing.password} onChange={e => setEditing({ ...editing, password: e.target.value })} />
              </div>
            </>
          )}
          <label className="form-label" style={{ marginTop: 6, display: 'block' }}>Platform permissions</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {PLATFORM_MODULE_OPTIONS.map(opt => (
              <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={editing.platform_permissions.includes(opt.key)}
                  onChange={() => togglePermission(opt.key)}
                />
                {opt.label}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button type="button" variant="primary" disabled={saving} onClick={save}>
              {saving ? 'Saving…' : editing.id ? 'Save' : 'Create Sub-Admin'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </Modal>
      )}

      {resetTarget && (
        <Modal title={`Reset password for ${resetTarget.name}`} onClose={() => setResetTarget(null)} width={380}>
          {resetError && (
            <p style={{ color: 'var(--red)', fontSize: 13, background: 'var(--red-soft)', padding: '8px 12px', borderRadius: 10, marginBottom: 12 }}>
              {resetError}
            </p>
          )}
          <div className="form-group">
            <label className="form-label">New password</label>
            <input className="form-control" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoFocus />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <Button type="button" variant="primary" disabled={resetting} onClick={submitReset}>
              {resetting ? 'Saving…' : 'Update Password'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setResetTarget(null)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
