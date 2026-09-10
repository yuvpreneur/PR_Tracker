import { useCallback, useEffect, useState } from 'react';
import { get, post, patch, del } from '../../services/httpClient.js';

const DEFAULT_WEEKLY_OFF = { weekdays: [6] };

export default function useHolidays() {
  const [holidays, setHolidays] = useState([]);
  const [weeklyOff, setWeeklyOff] = useState(DEFAULT_WEEKLY_OFF);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [rows, wo] = await Promise.all([
      get('/api/holidays').catch(() => []),
      get('/api/settings/weekly-off').catch(() => DEFAULT_WEEKLY_OFF),
    ]);
    setHolidays(Array.isArray(rows) ? rows : []);
    setWeeklyOff(wo || DEFAULT_WEEKLY_OFF);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createHoliday = payload => post('/api/holidays', payload).then(r => { refresh(); return r; });
  const deleteHoliday = id => del(`/api/holidays/${id}`).then(r => { refresh(); return r; });
  const saveWeeklyOff = payload => patch('/api/settings/weekly-off', payload).then(r => { refresh(); return r; });

  return { holidays, weeklyOff, loading, refresh, createHoliday, deleteHoliday, saveWeeklyOff };
}
