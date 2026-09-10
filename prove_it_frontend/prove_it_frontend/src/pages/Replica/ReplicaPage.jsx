import React, { useEffect, useRef } from 'react';
import { appHtml, appScript } from './appMarkup.js';
import { initApiBridge } from '../../bridge/index.js';
import useAuth from '../../hooks/useAuth.jsx';

// Trimmed to a hidden legacy-modal host as part of the bridge-removal migration
// (Phase 1) — appHtml now contains only the 15 modal-overlay divs (each `display:
// none` by default, see global.css's .modal-overlay rule), not the sidebar/topbar/
// nav/page-content shell AppLayout.jsx + the real routes now own. appScript and
// initApiBridge() still run unchanged: wireSubmits()/table-row-action delegation/
// notifications/reports export haven't been ported to React yet (Phases 2-3), and
// still expect these exact modal DOM nodes to exist.
export default function ReplicaPage() {
  const { logout } = useAuth();
  // Survives React 18 StrictMode's dev-only double-invoke of this effect (mount →
  // cleanup → remount, same component instance) without surviving a genuine
  // unmount+remount (e.g. logout then log back in creates a fresh ref). Without
  // this guard, StrictMode caused appScript's <script> tag to be recreated and
  // re-executed a second time, double-registering every one of its top-level
  // (not deferred behind doLogin()) document.addEventListener calls — harmless
  // for ones that just .remove() a class, but broke the report-export menu's
  // classList.toggle('open') (two toggles on the same click net out to nothing).
  const scriptInjectedRef = useRef(false);

  useEffect(() => {
    if (!scriptInjectedRef.current) {
      scriptInjectedRef.current = true;
      const existing = document.getElementById('prove-it-catalysts-runtime');
      if (existing) existing.remove();

      // A classic inline <script> (no type="module"/async/defer) runs synchronously
      // the moment it's inserted — appScript's entire IIFE, including every
      // window.doLogin/openModal/closeModal/navigate/etc. assignment at its end, has
      // already executed by the time appendChild() returns below. doLogin() and
      // initApiBridge() used to be scheduled 50ms/250ms out via setTimeout — that was
      // never actually necessary for this reason, and became actively harmful once
      // AllPages (routes/AppRoutes.jsx) started mounting every page's data-fetching
      // hook at once: that burst of synchronous render + effect work can (especially
      // under Vite dev-mode's on-demand module compilation) delay a mere setTimeout
      // by seconds, not ms — leaving initApiBridge()'s click delegation (the entire
      // legacy modal/table-action system) unregistered and silently eating clicks
      // for however long that takes. Running both synchronously, right here, means
      // the click handlers exist before this effect even returns.
      const script = document.createElement('script');
      script.id = 'prove-it-catalysts-runtime';
      script.text = appScript;
      try {
        document.body.appendChild(script);
      } catch (e) {
        console.error('[legacy runtime] Script injection failed:', e);
      }

      // doLogin() (appScript) still does its own nav/dashboard/permission-demo DOM
      // painting (buildNavigation() et al) — all now targeting elements that no
      // longer exist since AppLayout.jsx owns the real shell, so it's expected to
      // throw partway through. Catch it rather than let that stop initApiBridge()
      // below, which is what still matters (modals, table-row actions,
      // notifications, reports export).
      try {
        if (typeof window.doLogin === 'function') window.doLogin();
      } catch (e) {
        console.warn('[legacy runtime] doLogin() partial failure (expected — nav/shell now owned by React):', e);
      }

      try {
        initApiBridge();
      } catch (e) {
        console.error('[legacy runtime] initApiBridge() failed:', e);
      }
    }

    // Override doLogout so the Sign out button clears the JWT and returns to React login
    window.doLogout = () => {
      logout();
    };

    return () => {
      const runtime = document.getElementById('prove-it-catalysts-runtime');
      if (runtime) runtime.remove();
      delete window.doLogout;
      // Restore original navigate/openModal if overridden by bridge
      if (window._origCloseModal) { window.closeModal = window._origCloseModal; delete window._origCloseModal; }
    };
  }, [logout]);

  return (
    <>
      {/* appScript's IIFE calls buildNavigation() unconditionally at the top level
          (not deferred behind doLogin() — confirmed via the actual stack trace, which
          is why the doLogin() try/catch above doesn't cover it) — it does
          document.getElementById("nav").innerHTML = "" synchronously the moment this
          script tag executes. Without a real #nav element to write into, that throws
          and aborts the rest of the IIFE before it reaches its window.openModal/
          closeModal/doLogin/navigate/etc. assignments at the bottom, silently breaking
          the entire legacy runtime this page exists to keep alive. This placeholder
          gives it something harmless to populate — never shown, never read by
          AppLayout.jsx's own real nav. */}
      <nav id="nav" style={{ display: 'none' }} aria-hidden="true" />
      <div
        className="prove-it-replica-root"
        dangerouslySetInnerHTML={{ __html: appHtml }}
      />
    </>
  );
}
