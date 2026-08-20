import { useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import usePlatformSettings from './usePlatformSettings.js';
import Button from '../../components/ui/Button.jsx';

export default function PlatformSettingsPage() {
  const { settings, loading, save } = usePlatformSettings();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await save({
        default_currency: form.default_currency,
        default_financial_year_start: form.default_financial_year_start,
        session_timeout_minutes: Math.max(5, Number(form.session_timeout_minutes) || 720),
      });
      setNotice('Platform settings saved.');
    } catch (err) {
      setError(err.message || 'Could not save platform settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="section-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Settings2 size={22} /> Platform Settings</h2>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--slate)', margin: '-6px 0 14px' }}>
        Global configuration applied across the whole platform.
      </p>

      <div className="card" style={{ maxWidth: 480 }}>
        {!form ? (
          <p style={{ color: 'var(--muted)' }}>{loading ? 'Loading…' : 'Could not load platform settings.'}</p>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
              Currency and financial year seed a brand-new Organization's own Settings when it's created — they don't change any existing org.
            </p>
            <div className="form-group">
              <label className="form-label">Default currency for new organizations</label>
              <input
                className="form-control" value={form.default_currency}
                onChange={e => setForm({ ...form, default_currency: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Default financial year start for new organizations</label>
              <input
                className="form-control" value={form.default_financial_year_start}
                onChange={e => setForm({ ...form, default_financial_year_start: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Session timeout (minutes)</label>
              <input
                className="form-control" type="number" min="5"
                value={form.session_timeout_minutes}
                onChange={e => setForm({ ...form, session_timeout_minutes: e.target.value })}
              />
            </div>

            {notice && <p style={{ color: 'var(--green)', fontSize: 13, background: 'var(--green-soft)', padding: '8px 12px', borderRadius: 10, margin: 0 }}>{notice}</p>}
            {error && <p style={{ color: 'var(--red)', fontSize: 13, background: 'var(--red-soft)', padding: '8px 12px', borderRadius: 10, margin: 0 }}>{error}</p>}

            <Button type="submit" variant="primary" disabled={saving} style={{ justifyContent: 'center' }}>
              {saving ? 'Saving…' : 'Save Settings'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
