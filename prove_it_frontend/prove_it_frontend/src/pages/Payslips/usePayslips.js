import { useEffect, useState } from 'react';
import { get, fetchAuthedBytes, downloadAttachment, printAttachment } from '../../services/httpClient.js';

export default function usePayslips() {
  const [periods, setPeriods] = useState([]);
  const [period, setPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [viewBytes, setViewBytes] = useState(null);

  useEffect(() => {
    get('/api/payslips/periods').catch(() => []).then(rows => {
      setPeriods(rows || []);
      if (rows?.length) setPeriod(rows[0]);
      setLoading(false);
    });
  }, []);

  const closeView = () => setViewBytes(null);

  // Payslip PDFs are auth-gated like any other endpoint, so a plain <embed src> can't
  // load them directly — fetchAuthedBytes() fetches them with the Bearer token, and
  // PayslipViewer renders the pages onto <canvas> itself (via pdfjs-dist) rather than
  // handing the bytes to the browser's own PDF viewer, whose toolbar/sidebar chrome
  // can't be turned off consistently across browsers.
  const view = async () => {
    if (!period) return;
    setOpening(true);
    try {
      const bytes = await fetchAuthedBytes(`/api/payslips/${period}`);
      if (bytes) setViewBytes(bytes);
    } finally { setOpening(false); }
  };

  const download = async () => {
    if (!period) return;
    setDownloading(true);
    try { await downloadAttachment(`/api/payslips/${period}`); } finally { setDownloading(false); }
  };

  const print = async () => {
    if (!period) return;
    setPrinting(true);
    try { await printAttachment(`/api/payslips/${period}`); } finally { setPrinting(false); }
  };

  return {
    periods, period, setPeriod: p => { closeView(); setPeriod(p); }, loading,
    opening, view, downloading, download, printing, print,
    viewBytes, closeView,
  };
}
