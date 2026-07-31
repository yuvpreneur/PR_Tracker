import { useRef } from 'react';
import { Settings as SettingsIcon, Building2, Bell, Workflow, Database, Save, Download, Upload } from 'lucide-react';
import useSettings from './useSettings.js';
import Button from '../../components/ui/Button.jsx';
import SectionTitle from '../../components/ui/SectionTitle.jsx';

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
        <div className="section-header"><h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><SettingsIcon size={22} /> Settings</h2></div>
        <div style={{ padding: 16, color: '#94a3b8', fontSize: 13 }}>Loading…</div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header"><h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><SettingsIcon size={22} /> Settings</h2></div>
      <div className="grid-2">
        <div className="card" id="settings-profile-card">
          <SectionTitle icon={Building2}>Company Profile</SectionTitle>
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
              <select className="form-control" value={profile.financial_year_start}
                onChange={e => setProfile({ ...profile, financial_year_start: e.target.value })}>
                <option>April (India)</option>
                <option>January</option>
                <option>July</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" onClick={saveProfile}><Save size={15} /> Save Profile</Button>
            </div>
          </div>
        </div>

        <div className="card">
          <SectionTitle icon={Bell}>Notifications</SectionTitle>
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
          <SectionTitle icon={Workflow}>Approval Workflow</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Timesheet Approval Levels</label>
              <select className="form-control" value={workflow.timesheet_approval_levels}
                onChange={e => setWorkflow({ ...workflow, timesheet_approval_levels: e.target.value })}>
                <option>1 Level (Manager)</option>
                <option>2 Levels (Manager → Admin)</option>
                <option>2 Levels (Manager → Finance)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Expense Approval Levels</label>
              <select className="form-control" value={workflow.expense_approval_levels}
                onChange={e => setWorkflow({ ...workflow, expense_approval_levels: e.target.value })}>
                <option>2 Levels (Manager → Finance)</option>
                <option>1 Level (Manager)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Auto-lock Approved Records</label>
              <select className="form-control" value={workflow.auto_lock}
                onChange={e => setWorkflow({ ...workflow, auto_lock: e.target.value })}>
                <option>Yes – lock immediately</option>
                <option>No – allow edits with reason</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="primary" onClick={saveWorkflow}><Save size={15} /> Save Workflow</Button>
            </div>
          </div>
        </div>

        <div className="card" id="settings-backup-card">
          <SectionTitle icon={Database}>Backup &amp; Data</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Auto Backup Frequency</label>
              <select className="form-control" value={backupConfig.auto_backup_frequency}
                onChange={e => setBackupConfig({ ...backupConfig, auto_backup_frequency: e.target.value })}>
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Backup Retention (days)</label>
              <input className="form-control" placeholder="90" value={backupConfig.retention_days}
                onChange={e => setBackupConfig({ ...backupConfig, retention_days: e.target.value })} />
            </div>
            {/* No Save button here — legacy never wires saveBackupConfig() to one either */}
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="ghost" onClick={downloadBackup}><Download size={15} /> Download Backup</Button>
              <Button variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={restoring}>
                <Upload size={15} /> {restoring ? 'Restoring…' : 'Restore Backup'}
              </Button>
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
