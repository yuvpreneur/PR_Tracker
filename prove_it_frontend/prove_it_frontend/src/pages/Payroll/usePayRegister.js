import { useCallback, useEffect, useState } from 'react';
import { get, patch, uploadFile, del } from '../../services/httpClient.js';

export default function usePayRegister() {
  const [periods, setPeriods] = useState([]);
  const [period, setPeriod] = useState(null);
  const [register, setRegister] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const loadPeriods = useCallback(async () => {
    const rows = await get('/api/payroll/periods').catch(() => []);
    setPeriods(rows || []);
    return rows || [];
  }, []);

  const loadRegister = useCallback(async p => {
    if (!p) { setRegister(null); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await get(`/api/payroll/${p}`).catch(() => null);
      setRegister(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPeriods().then(rows => { if (rows.length) setPeriod(rows[0].period); else setLoading(false); });
  }, [loadPeriods]);

  useEffect(() => { if (period) loadRegister(period); }, [period, loadRegister]);

  const upload = async file => {
    setUploading(true);
    try {
      const data = await uploadFile('/api/payroll/upload', file);
      if (data) {
        await loadPeriods();
        setPeriod(data.period);
        setRegister(data);
      }
      return data;
    } finally {
      setUploading(false);
    }
  };

  const remove = async p => {
    await del(`/api/payroll/${p}`);
    const rows = await loadPeriods();
    if (rows.length) setPeriod(rows[0].period);
    else { setPeriod(null); setRegister(null); }
  };

  const saveCompanyInfo = payload =>
    patch(`/api/payroll/${period}/company-info`, payload).then(r => { setRegister(prev => ({ ...prev, ...r })); return r; });

  return { periods, period, setPeriod, register, loading, uploading, upload, remove, saveCompanyInfo };
}
