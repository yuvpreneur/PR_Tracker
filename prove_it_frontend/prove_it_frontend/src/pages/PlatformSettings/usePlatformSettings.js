import { useCallback, useEffect, useState } from 'react';
import { get, patch } from '../../services/httpClient.js';

export default function usePlatformSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await get('/api/platform-settings/').catch(() => null);
    setSettings(data);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const save = useCallback(async (payload) => {
    const data = await patch('/api/platform-settings/', payload);
    setSettings(data);
    return data;
  }, []);

  return { settings, loading, save };
}
