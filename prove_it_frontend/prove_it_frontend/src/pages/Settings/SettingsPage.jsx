import { useRef } from 'react';
import { Settings as SettingsIcon, Building2, Bell, Workflow, Database, Save, Download, Upload } from 'lucide-react';
import useSettings from './useSettings.js';
import Button from '../../components/ui/Button.jsx';
import SectionTitle from '../../components/ui/SectionTitle.jsx';
import Dropdown from '../../components/ui/Dropdown.jsx';

export default function SettingsPage() {
  const {
    profile, setProfile, saveProfile,
    notifications, toggleNotification,
    workflow, setWorkflow, saveWorkflow,
    backupConfig, setBackupConfig,
    downloadBackup, restoreBackup, restoring,
    loading,
  } = useSettings();

  const fileInputRef = useRef(null);

  const handleRestoreFile = e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) restoreBackup(file);
  };

  if (loading) {
    return (
      <div>
        <div className="page-header"><h2><SettingsIcon size={22} /> Settings</h2></div>
        <div style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header"><h2><SettingsIcon size={22} /> Settings</h2></div>
      <div className="grid-2">
        <div className="card" id="settings-profile-card">
          <SectionTitle icon={Building2} subdued={false}>Company Profile</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Company Name</label>
              <input className="form-control" placeholder="Acme Corp Pvt Ltd" value={profile.company_name}
                onChange={e => setProfile({ ...profile, company_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">GST Number</label>
              <input className="form-control" placeholder="27AABCU9603R1ZX" value={profile.gst_number}
                onChange={e => setProfile({ ...profile, gst_number: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Default Currency</label>
              <input className="form-control" placeholder="INR" value={profile.default_currency}
                onChange={e => setProfile({ ...profile, default_currency: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Financial Year Start</label>
              <Dropdown
                value={profile.financial_year_start}
                onChange={financial_year_start => setProfile({ ...profile, financial_year_start })}
                options={[
                  { value: 'April (India)', label: 'April (India)' },
                  { value: 'January', label: 'January' },
                  { value: 'July', label: 'July' }
                ]}
                placeholder="Select month"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" onClick={saveProfile}><Save size={15} /> Save Profile</Button>
            </div>
          </div>
        </div>

        <div className="card">
          <SectionTitle icon={Bell} subdued={false}>Notifications</SectionTitle>
          <div id="notif-rows">
            {notifications.map((item, i) => (
              <div className="notif-row" key={item.label}>
                <span>{item.label}</span>
                <div style={{ display: 'flex', gap: 14 }}>
                  <label style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!item.in_app} style={{ accentColor: 'var(--accent)' }}
                      onChange={e => toggleNotification(i, 'in_app', e.target.checked)} />
                    <span style={{ color: 'var(--text3)', fontSize: 11 }}>In-app</span>
                  </label>
                  <label style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!item.email} style={{ accentColor: 'var(--accent)' }}
                      onChange={e => toggleNotification(i, 'email', e.target.checked)} />
                    <span style={{ color: 'var(--text3)', fontSize: 11 }}>Email</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" id="settings-workflow-card">
          <SectionTitle icon={Workflow} subdued={false}>Approval Workflow</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Timesheet Approval Levels</label>
              <Dropdown
                value={workflow.timesheet_approval_levels}
                onChange={timesheet_approval_levels => setWorkflow({ ...workflow, timesheet_approval_levels })}
                options={[
                  { value: '1 Level (Manager)', label: '1 Level (Manager)' },
                  { value: '2 Levels (Manager → Admin)', label: '2 Levels (Manager → Admin)' },
                  { value: '2 Levels (Manager → Finance)', label: '2 Levels (Manager → Finance)' }
                ]}
                placeholder="Select levels"
                style={{ width: '100%' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Expense Approval Levels</label>
              <Dropdown
                value={workflow.expense_approval_levels}
                onChange={expense_approval_levels => setWorkflow({ ...workflow, expense_approval_levels })}
                options={[
                  { value: '2 Levels (Manager → Finance)', label: '2 Levels (Manager → Finance)' },
                  { value: '1 Level (Manager)', label: '1 Level (Manager)' }
                ]}
                placeholder="Select levels"
                style={{ width: '100%' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Auto-lock Approved Records</label>
              <Dropdown
                value={workflow.auto_lock}
                onChange={auto_lock => setWorkflow({ ...workflow, auto_lock })}
                options={[
                  { value: 'Yes – lock immediately', label: 'Yes – lock immediately' },
                  { value: 'No – allow edits with reason', label: 'No – allow edits with reason' }
                ]}
                placeholder="Select option"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" onClick={saveWorkflow}><Save size={15} /> Save Workflow</Button>
            </div>
          </div>
        </div>

        <div className="card" id="settings-backup-card">
          <SectionTitle icon={Database} subdued={false}>Backup &amp; Data</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Auto Backup Frequency</label>
              <Dropdown
                value={backupConfig.auto_backup_frequency}
                onChange={auto_backup_frequency => setBackupConfig({ ...backupConfig, auto_backup_frequency })}
                options={[
                  { value: 'Daily', label: 'Daily' },
                  { value: 'Weekly', label: 'Weekly' },
                  { value: 'Monthly', label: 'Monthly' }
                ]}
                placeholder="Select frequency"
                style={{ width: '100%' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Backup Retention (days)</label>
              <input className="form-control" placeholder="90" value={backupConfig.retention_days}
                onChange={e => setBackupConfig({ ...backupConfig, retention_days: e.target.value })} />
            </div>
            {/* No Save button here — legacy never wires saveBackupConfig() to one either */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-ghost" style={{ color: 'var(--rose)', borderColor: 'var(--rose)' }} onClick={downloadBackup}><Download size={15} /> Download Backup</button>
              <button type="button" className="btn btn-ghost" style={{ color: 'var(--rose)', borderColor: 'var(--rose)' }} onClick={() => fileInputRef.current?.click()} disabled={restoring}>
                <Upload size={15} /> {restoring ? 'Restoring…' : 'Restore Backup'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                style={{ display: 'none' }}
                onChange={handleRestoreFile}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
