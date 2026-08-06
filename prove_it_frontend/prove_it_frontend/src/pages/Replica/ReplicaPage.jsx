import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { appHtml, appScript } from './appMarkup.js';
import { initApiBridge } from '../../bridge/index.js';
import { canViewPage } from '../../bridge/shared/permissions.js';
import useAuth from '../../hooks/useAuth.jsx';
import { PAGE_COMPONENTS } from './pageManifest.js';
import NoAccessBridgeMount from './NoAccessBridgeMount.jsx';

export default function ReplicaPage() {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // Survives React 18 StrictMode's dev-only double-invoke of this effect (mount →
  // cleanup → remount, same component instance) without surviving a genuine
  // unmount+remount (e.g. logout then log back in creates a fresh ref). Without
  // this guard, StrictMode caused appScript's <script> tag to be recreated and
  // re-executed a second time, double-registering every one of its top-level
  // (not deferred behind doLogin()) document.addEventListener calls — harmless
  // for ones that just .remove() a class, but broke the report-export menu's
  // classList.toggle('open') (two toggles on the same click net out to nothing).
  const scriptInjectedRef = useRef(false);

  // Mirrors useBridgeMount.js's own wait for the same event — state.currentUser/
  // permissions/pageOverrides (read by canViewPage below) aren't populated until
  // initApiBridge()'s init sweep finishes, so the legacy-nav sync effect below must
  // not fire before then.
  const [bridgeReady, setBridgeReady] = useState(() => !!window.__bridgeReady);

  // pageId is the single source of truth for which page is mounted — same bare ids
  // used throughout (bridge/shared/permissions.js, bridge/index.js's NAV_ICON_MAP,
  // appMarkup.js's nav onclick="navigate('id')").
  const pageId = location.pathname.replace(/^\//, '').split('/')[0] || 'dashboard';

  useEffect(() => {
    if (location.pathname === '/') navigate('/dashboard', { replace: true });
    // Intentionally mount-only — this just normalizes the very first landing URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (window.__bridgeReady) return;
    const onReady = () => setBridgeReady(true);
    document.addEventListener('bridge:ready', onReady, { once: true });
    return () => document.removeEventListener('bridge:ready', onReady);
  }, []);

  // Keeps the legacy sidebar's .nav-item.active/.page.active CSS-class highlight
  // (still owned by appScript's navigate()) in sync with the URL for cases that
  // don't go through a nav click — back/forward, refresh, deep link. Nav clicks
  // themselves flow the other way, via the onNavigate callback passed into
  // initApiBridge() below, which pushes the matching URL.
  useEffect(() => {
    if (!bridgeReady) return;
    if (typeof window.navigate === 'function') window.navigate(pageId);
  }, [pageId, bridgeReady]);

  useEffect(() => {
    if (!scriptInjectedRef.current) {
      scriptInjectedRef.current = true;
      const existing = document.getElementById('prove-it-catalysts-runtime');
      if (existing) existing.remove();

      const script = document.createElement('script');
      script.id = 'prove-it-catalysts-runtime';
      script.text = appScript;
      document.body.appendChild(script);
    }

    // Skip the appMarkup login screen — user is already authenticated via React
    const timer = setTimeout(() => {
      const loginScreen = document.getElementById('login-screen');
      if (loginScreen) loginScreen.style.display = 'none';
      if (typeof window.doLogin === 'function') window.doLogin();
      // Init API bridge after appScript has defined all window.* functions.
      // onNavigate is called from window.navigate() (see bridge/index.js) whenever
      // a legacy nav click fires — pushes the matching URL so the browser address
      // bar and history stay in sync with whatever page the sidebar just switched to.
      setTimeout(() => initApiBridge((id) => {
        const path = '/' + id;
        if (window.location.pathname !== path) navigate(path);
      }), 200);
    }, 50);

    // Override doLogout so the Sign out button clears the JWT and returns to React login
    window.doLogout = () => {
      logout();
    };

    return () => {
      clearTimeout(timer);
      const runtime = document.getElementById('prove-it-catalysts-runtime');
      if (runtime) runtime.remove();
      delete window.doLogout;
      // Restore original navigate/openModal if overridden by bridge
      if (window._origCloseModal) { window.closeModal = window._origCloseModal; delete window._origCloseModal; }
    };
  }, [logout, navigate]);

  const PageComponent = canViewPage(pageId) ? PAGE_COMPONENTS[pageId] : null;

  return (
    <>
      <div
        className="prove-it-replica-root"
        dangerouslySetInnerHTML={{ __html: appHtml }}
      />
      <Suspense fallback={null}>
        {PageComponent ? <PageComponent /> : <NoAccessBridgeMount />}
      </Suspense>
    </>
  );
}
