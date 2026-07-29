import { useEffect, useState } from 'react';

// Waits for initApiBridge()'s one-time setup (bridge/index.js) to finish before
// clearing + claiming a legacy page div for a portal. Necessary because
// populateFilterDropdowns()/wireFilters() run exactly once, ~250ms after mount, and
// blindly overwrite any <select>'s innerHTML whose first option matches a known
// legacy label ("All Clients", "All Owners", "All Projects", ...) via raw DOM
// mutation — if a React-rendered page has already claimed that div by then, this
// collides with React-owned <select> children and corrupts React's reconciliation
// (throws "removeChild ... not a child of this node" on the next re-render).
export default function useBridgeMount(pageId) {
  const [mountNode, setMountNode] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const mount = () => {
      if (cancelled) return;
      const el = document.getElementById(pageId);
      if (!el) return;
      el.innerHTML = '';
      // The default-active page (dashboard) starts with visibility:hidden in the raw
      // markup so its legacy placeholder content never paints — reveal it now, the
      // same moment React's real content takes over.
      el.style.visibility = '';
      setMountNode(el);
    };
    if (window.__bridgeReady) mount();
    else document.addEventListener('bridge:ready', mount, { once: true });
    return () => {
      cancelled = true;
      document.removeEventListener('bridge:ready', mount);
    };
  }, [pageId]);

  return mountNode;
}
