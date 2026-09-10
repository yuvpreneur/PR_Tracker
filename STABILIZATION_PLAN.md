# Stabilization Plan — `fix/api-trailing-slash-spa-fallback`

**Goal:** make the feature branch as stable as `aug-31`, without discarding the work it carries
(Subscription page, Supabase migrations, 74 net-new defensive guards).

**Date:** 2026-09-10
**Branches compared:** `aug-31` (stable) vs `fix/api-trailing-slash-spa-fallback` (unstable)
**Delta:** 59 files, +1235 / −150

---

## 1. Summary

The branch is *not* broadly broken. It is `aug-31` plus two commits, and its instability traces to
**two independent causes**:

| # | Cause | Status |
|---|-------|--------|
| 1 | `main.py` SPA catch-all returned `index.html` at HTTP 200 for every `/api/...` call | **Already fixed** in `7c7fb71` |
| 2 | The working tree was partly built on a stale base and silently reverted parts of all four of `aug-31`'s bug-fix commits | **Open — this plan** |

Cause 1 alone explains every error in the reported console dump. Cause 2 is why those errors landed
in *specific* pages, and it is still present.

### Important correction to the premise

`aug-31` is **not structurally safer** than the feature branch. It is stable because it lacks the
*trigger*, not because it is better defended:

- `src/bridge/pages/employees.js` and `src/bridge/pages/timesheets.js` — the files that threw
  `state.employees.map is not a function` and `state.bcodes.map is not a function` — are
  **byte-identical on both branches** and unguarded on both.
- Net guard count actually favours the feature branch: **+74 `Array.isArray` guards added, 7 removed.**

Point `aug-31` at any backend that returns a non-array and it fails in exactly the same way.
Restoring the seven removals closes the known gaps; it does not make either branch immune.

---

## 2. Root cause 1 — the SPA catch-all (fixed, for reference)

```python
# The regression, as introduced:
@app.get("/{path:path}")
def serve_frontend(path: str): ...
```

Starlette matches routes **before** applying its trailing-slash redirect. Every list endpoint is
declared `@router.get("/")`, so its real path is `/api/employees/`, while the frontend calls
`/api/employees`. The catch-all matched first and returned `index.html` at status **200**.

Downstream, the failure is mechanical:

```
200 + HTML  →  httpClient never throws  →  r.json() fails  →  .catch(() => ({}))  →  {}
{} passes `rows || []` (|| only guards null/undefined)  →  .map/.filter throws  →  blank screen
```

Fixed in `7c7fb71` by (a) moving the SPA fallback to a 404 handler so routing runs untouched, and
(b) rewriting `/api/foo` → `/api/foo/` in ASGI middleware instead of relying on a 307 — the redirect
is fatal behind the Vite proxy, because it crosses origins (`:5174` → `:8000`) and browsers strip the
`Authorization` header on cross-origin redirects.

---

## 3. Root cause 2 — reverted fixes (the open work)

`aug-31`'s last four commits are all bug fixes. Committing the stale working tree undid parts of
**all four**:

| Fix commit | File | Status on feature branch |
|---|---|---|
| `5bf306d` Fix frontend TypeErrors | `src/pages/Replica/ReplicaPage.jsx` | **reverted** |
| `5bf306d` | `src/pages/ServiceDesk/useServiceDesk.js` | **reverted** |
| `057f01a` Defensive array checks | `src/pages/Companies/CompaniesPage.jsx` | **reverted** |
| `057f01a` | `src/pages/BillingCodes/BillingCodesPage.jsx` | **reverted** |
| `057f01a` | `src/pages/Expenses/ExpensesPage.jsx` | 1 of 3 guards lost |
| `0ba0e15` PR Manager membership model | `app/core/prmanager_client.py` | **model removed** — see §5, needs a decision |
| `6577980` refreshCaches | `src/bridge/core/cache.js` | retained, improved |
| `5bf306d` | `src/pages/Reports/ReportsPage.jsx` | retained |

`CompaniesPage.jsx` and `useServiceDesk.js` are byte-identical to their **pre-fix** versions — and
they are exactly the two files that threw in the console.

Separately, not part of any revert:

| File | Regression |
|---|---|
| `app/routers/subscriptions.py` | Lost `if not cu.org_id: raise HTTPException(404, "No organization")` |

---

## 4. Fix plan

### Phase 0 — Prerequisites

```bash
git checkout fix/api-trailing-slash-spa-fallback
git status --porcelain        # must be clean before starting
git rev-parse HEAD            # note the SHA so you can roll back
```

> The frontend `.env` (`VITE_API_BASE_URL`) is gitignored and unaffected by branch switching.
> On this branch `constants.js` falls back to `''` (relative) and `vite.config.js` provides the
> `/api` proxy, so `.env` can stay commented out here. On `aug-31` it must be set to
> `http://localhost:8000`, because that branch has no proxy and falls back to the Render URL.

### Phase 1 — Restore the five reverted frontend files

**Verified safe:** each of these has **zero** unique new work on the feature branch — the only
difference from `aug-31` is the removed guard. Restoring wholesale loses nothing.

```bash
git checkout aug-31 -- \
  prove_it_frontend/prove_it_frontend/src/pages/Replica/ReplicaPage.jsx \
  prove_it_frontend/prove_it_frontend/src/pages/ServiceDesk/useServiceDesk.js \
  prove_it_frontend/prove_it_frontend/src/pages/Companies/CompaniesPage.jsx \
  prove_it_frontend/prove_it_frontend/src/pages/BillingCodes/BillingCodesPage.jsx \
  prove_it_frontend/prove_it_frontend/src/pages/Expenses/ExpensesPage.jsx
```

**Verify before committing** — expect 5 files staged and only guard-shaped changes:

```bash
git diff --cached --stat
git diff --cached | grep -cE "^\+.*Array\.isArray"   # expect 5
```

Guards restored per file (`ReplicaPage.jsx` contributes none — its fix is try/catch, not a guard):

| File | Guards restored |
|---|---|
| `BillingCodesPage.jsx` | 2 |
| `CompaniesPage.jsx` | 1 |
| `ExpensesPage.jsx` | 1 |
| `useServiceDesk.js` | 1 |
| `ReplicaPage.jsx` | 0 (try/catch) |

What each restores:

- `ReplicaPage.jsx` — try/catch around legacy script injection and `initApiBridge()`, so a legacy
  runtime failure logs instead of taking down the React tree.
- `useServiceDesk.js` — `Array.isArray(rows) ? rows : []` in place of `rows || []`, which is what
  produced `(rows || []).filter is not a function`.
- `CompaniesPage.jsx` — `companiesArray` guard feeding both `useMemo`s; source of
  `companies.map is not a function`.
- `BillingCodesPage.jsx` — 2 guards.
- `ExpensesPage.jsx` — `projectsArray` guard.

### Phase 2 — Restore the subscriptions guard

Edit `prove_it_backend/prove_it_backend/app/routers/subscriptions.py`, in `get_my_subscription`:

```python
def get_my_subscription(db: Database = Depends(get_db), cu=Depends(get_current_user)):
    """Get the current user's organization's subscription — accessible to any authenticated user."""
    if not cu.org_id:                                    # <-- restore this
        raise HTTPException(404, "No organization")      # <-- restore this
    s = db[collections.SUBSCRIPTIONS].find_one({"_id": cu.org_id})
    return _sub_out(cu.org_id, s)
```

Without it, an org-less user (super-admin, or an account not yet attached to an org) hits
`find_one({"_id": None})`, gets `None`, and `_sub_out` returns a **default subscription object**
instead of a clean 404 — a silent wrong answer rather than an error.

Confirm `HTTPException` is imported in that module before committing.

### Phase 3 — Decide on `prmanager_client.py` ⚠️ **needs your call**

This one is **not** clearly a regression, and should not be reverted mechanically.

- `aug-31` HEAD (`0ba0e15`) is titled *"restore project-based membership model"* — membership is
  derived from `PROJECT_PERMISSIONS` grants (`allowed=True`), deliberately **not** "every project".
- The feature branch replaces this with a **company-based** model: look up any company in the org,
  take its `pm_org_id`, sync the employee there. `PROJECT_PERMISSIONS` references drop from 2 → 0.

Given that the branch also adds two Supabase migrations for PR Manager sync, the company-based model
may be an **intentional redesign** rather than a stale revert. Two options:

- **(a) It is intentional** → keep the feature-branch version. Add a commit message or code comment
  explaining that it supersedes `0ba0e15`, so the next person doesn't "restore" it again.
- **(b) It is a stale revert** → restore with
  `git checkout aug-31 -- prove_it_backend/prove_it_backend/app/core/prmanager_client.py`
  and re-apply any genuinely new sync work on top by hand.

The original rationale for project-based membership is preserved in `0ba0e15`'s docstring:
cross-app account provisioning is higher-stakes than an in-app page-view default, so an employee with
no grant rows should get **no** PM membership rather than all of them. If that reasoning still holds,
choose (b).

### Phase 4 — Verification

Backend (from `prove_it_backend/prove_it_backend`, with the venv active):

```bash
python -c "import ast; ast.parse(open('main.py').read())"
uvicorn main:app --reload --port 8000
```

```bash
# No redirects; JSON everywhere; HTML never returned for /api
for u in /api/employees /api/employees/ /api/companies /api/tickets /api/health /api/nonexistent; do
  printf "%-20s " "$u"
  curl -s -o /dev/null -w "status=%{http_code} type=%{content_type} redirect=%{redirect_url}\n" "http://localhost:8000$u"
done
```

Expected: `401 application/json` for the data endpoints (no token), `200` for `/api/health`,
`404 application/json` for `/api/nonexistent`, and an **empty redirect column on every row**.

Frontend:

```bash
cd prove_it_frontend/prove_it_frontend && npm run dev
```

Then in the browser, with DevTools open:

1. Hard-refresh (`Ctrl+Shift+R`) — module-level constants are baked at load.
2. Log in; confirm **zero** `.map is not a function` / `.filter is not a function` errors.
3. Visit Companies, Billing Codes, Expenses, Service Desk, Timesheets, Employees.
4. Confirm no request in the Network tab returns `text/html` for an `/api/...` URL.
5. Confirm the Subscription page still renders (the feature this branch adds).

### Phase 5 — Commit

```bash
git add -A
git commit -m "Restore defensive guards reverted by stale working tree"
git push
```

---

## 5. Latent risks this plan does **not** close

These are pre-existing on **both** branches and are the reason a single bad response can still white-screen the app:

1. **Unguarded legacy bridge files.** `src/bridge/pages/employees.js` (`state.employees.map`) and
   `src/bridge/pages/timesheets.js` (`state.bcodes.map`) have no guard on either branch.
2. **`rows || []` is the wrong guard.** `||` only catches `null`/`undefined`; an object `{}` passes
   straight through. Every remaining site should use `Array.isArray(rows) ? rows : []`.
3. **No React error boundary.** `CompaniesPage` threw during render and took down the whole tree —
   that is why the symptom was a blank screen rather than one broken panel. An error boundary around
   the routed page would contain this class of failure permanently, and is the single highest-value
   follow-up.
4. **`constants.js` defaults to production.** On `aug-31`, an unset `VITE_API_BASE_URL` silently
   points local dev at the deployed Render API. A localhost default (or a hard failure) would be safer.
5. **Two checkouts on disk.** `Desktop/PR_Tracker` and `Desktop/PR_Tracker-1` both exist and both have
   run `uvicorn` on port 8000. Starting the backend from the wrong folder means testing code you are
   not editing. Confirm with:
   ```bash
   powershell "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Select-Object ProcessId,CommandLine"
   ```

---

## 6. Appendix — reproducing the diagnosis

Audit which of `aug-31`'s fixes survive on any branch:

```bash
FIX=fix/api-trailing-slash-spa-fallback
for c in 5bf306d 057f01a 6577980 0ba0e15; do
  echo "=== $c $(git log -1 --format=%s $c)"
  git diff --name-only $c^ $c | while read -r f; do
    if   git diff --quiet $c  $FIX -- "$f"; then st="RETAINED"
    elif git diff --quiet $c^ $FIX -- "$f"; then st="** REVERTED **"
    else st="diverged"; fi
    printf "    %-30s %s\n" "$(basename $f)" "$st"
  done
done
```

Count guard drift between two branches:

```bash
git diff aug-31 fix/api-trailing-slash-spa-fallback | grep -cE "^-.*Array\.isArray"   # removed: 7
git diff aug-31 fix/api-trailing-slash-spa-fallback | grep -cE "^\+.*Array\.isArray"  # added: 74
```
