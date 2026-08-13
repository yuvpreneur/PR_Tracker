import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { fetchAuthedBlobUrl } from '../../services/httpClient.js';

export default function OrgLogoThumb({ orgId, hasLogo, size = 34 }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!hasLogo) { setUrl(null); return; }
    let objectUrl = null;
    let cancelled = false;
    fetchAuthedBlobUrl(`/api/organizations/${orgId}/logo`).then(u => {
      if (cancelled) return;
      objectUrl = u;
      setUrl(u);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [orgId, hasLogo]);

  return (
    <div style={{
      width: size, height: size, borderRadius: size >= 60 ? 14 : 9, background: 'var(--soft)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
    }}>
      {url
        ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <Building2 size={size / 2} color="var(--accent)" />}
    </div>
  );
}
