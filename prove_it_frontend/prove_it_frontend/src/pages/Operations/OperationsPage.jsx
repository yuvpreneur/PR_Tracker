import { useState } from 'react';
import { Wrench, Download } from 'lucide-react';
import { downloadAttachment } from '../../services/httpClient.js';
import Button from '../../components/ui/Button.jsx';

export default function OperationsPage() {
  const [downloading, setDownloading] = useState(false);

  const downloadBackup = async () => {
    setDownloading(true);
    try {
      await downloadAttachment('/api/operations/backup/export');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <div className="section-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Wrench size={22} /> Operations</h2>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--slate)', margin: '-6px 0 14px' }}>
        Platform-wide maintenance actions.
      </p>

      <div className="card" style={{ maxWidth: 480 }}>
        <h3 style={{ marginTop: 0 }}>Platform-wide database backup</h3>
        <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          Downloads every organization's data as one JSON file — export only, there's no matching
          restore for a file this size, since restoring it wrong could corrupt every organization at once.
        </p>
        <Button variant="primary" disabled={downloading} onClick={downloadBackup}>
          <Download size={14} /> {downloading ? 'Preparing…' : 'Download platform backup'}
        </Button>
      </div>
    </div>
  );
}
