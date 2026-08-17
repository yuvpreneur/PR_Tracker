import { useEffect, useState } from 'react';
import { get, viewAttachment } from '../../services/httpClient.js';

export default function usePayslips() {
  const [periods, setPeriods] = useState([]);
  const [period, setPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    get('/api/payslips/periods').catch(() => []).then(rows => {
      setPeriods(rows || []);
      if (rows?.length) setPeriod(rows[0]);
      setLoading(false);
    });
  }, []);

  // Payslip PDFs are auth-gated like any other endpoint, so a plain link can't open
  // them directly — viewAttachment() fetches the bytes with the Bearer token and opens
  // a blob: URL in a new tab (same mechanism Expenses' receipt attachments already use).
  const view = async () => {
    if (!period) return;
    setOpening(true);
    try { await viewAttachment(`/api/payslips/${period}`); } finally { setOpening(false); }
  };

  return { periods, period, setPeriod, loading, opening, view };
}
