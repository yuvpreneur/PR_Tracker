import { useCallback, useEffect, useState } from 'react';
import { get, post, patch, del } from '../../services/httpClient.js';

// Invoices is its own backend resource (/api/invoices) — no longer a view over
// Receivables. Fully React-owned: no legacy bridge state, no bridge:changed events.
export default function useInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [projects, setProjects] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [rows, comps, projs, sum] = await Promise.all([
      get('/api/invoices').catch(() => []),
      get('/api/companies').catch(() => []),
      get('/api/projects').catch(() => []),
      get('/api/invoices/summary').catch(() => null),
    ]);
    setInvoices(rows || []);
    setCompanies(comps || []);
    setProjects(projs || []);
    setSummary(sum);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createInvoice   = payload => post('/api/invoices', payload).then(r => { refresh(); return r; });
  const updateInvoice   = (id, payload) => patch(`/api/invoices/${id}`, payload).then(r => { refresh(); return r; });
  const sendInvoice     = id => post(`/api/invoices/${id}/send`).then(r => { refresh(); return r; });
  const recordPayment   = (id, amount) => post(`/api/invoices/${id}/payments`, { amount }).then(r => { refresh(); return r; });
  const voidInvoice     = id => post(`/api/invoices/${id}/void`).then(r => { refresh(); return r; });
  const deleteInvoice   = id => del(`/api/invoices/${id}`).then(r => { refresh(); return r; });

  return {
    invoices, companies, projects, summary, loading, refresh,
    createInvoice, updateInvoice, sendInvoice, recordPayment, voidInvoice, deleteInvoice,
  };
}
