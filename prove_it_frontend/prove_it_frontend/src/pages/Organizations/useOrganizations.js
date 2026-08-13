import { useCallback, useEffect, useState } from 'react';
import { get, patch, postFormData } from '../../services/httpClient.js';

export default function useOrganizations() {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const rows = await get('/api/organizations').catch(() => []);
    setOrganizations(rows || []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createOrganization = useCallback(async ({ name, logo, adminUsername, adminPassword, adminName, adminEmail }) => {
    const form = new FormData();
    form.append('name', name);
    form.append('admin_username', adminUsername);
    form.append('admin_password', adminPassword);
    form.append('admin_name', adminName);
    form.append('admin_email', adminEmail);
    if (logo) form.append('logo', logo);
    const result = await postFormData('/api/organizations', form);
    await refresh();
    return result;
  }, [refresh]);

  const setActive = useCallback(async (orgId, isActive) => {
    await patch(`/api/organizations/${orgId}`, { is_active: isActive });
    await refresh();
  }, [refresh]);

  const updateOrganization = useCallback(async (orgId, { name, logo }) => {
    if (name) await patch(`/api/organizations/${orgId}`, { name });
    if (logo) {
      const form = new FormData();
      form.append('logo', logo);
      await postFormData(`/api/organizations/${orgId}/logo`, form);
    }
    await refresh();
  }, [refresh]);

  return { organizations, loading, refresh, createOrganization, setActive, updateOrganization };
}

export async function getOrganization(orgId) {
  return get(`/api/organizations/${orgId}`);
}
