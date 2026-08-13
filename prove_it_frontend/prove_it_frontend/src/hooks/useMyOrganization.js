// Fetches the logged-in user's own organization (name + logo) for sidebar branding —
// GET /api/organizations/me and /me/logo are self-service endpoints (any authenticated
// non-Super-Admin user, scoped to their own org), separate from the Super-Admin-only
// GET /api/organizations/{org_id} routes used by the Organizations management pages.
import { useEffect, useState } from 'react';
import useAuth from './useAuth.jsx';
import { get, fetchAuthedBlobUrl } from '../services/httpClient.js';

export default function useMyOrganization() {
  const { user } = useAuth();
  const [org, setOrg] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    if (!user?.org_id) { setOrg(null); return; }
    let cancelled = false;
    get('/api/organizations/me').then(o => { if (!cancelled) setOrg(o); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.org_id]);

  useEffect(() => {
    if (!org?.logo_url) { setLogoUrl(null); return; }
    let objectUrl = null;
    let cancelled = false;
    fetchAuthedBlobUrl('/api/organizations/me/logo').then(u => {
      if (cancelled) return;
      objectUrl = u;
      setLogoUrl(u);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [org?.logo_url]);

  return { name: org?.name, logoUrl };
}
