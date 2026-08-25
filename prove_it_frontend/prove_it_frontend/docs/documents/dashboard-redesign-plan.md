# Dashboard Redesign — Rose/Light Rebrand (Phase 1 of module-by-module rollout)

## Context

The product is being rebranded from the current dark navy/teal shell + gradient-banner page style to a lighter, rose-accented SaaS look, per `../references/Redesign_dashboard.jpeg` (already in-repo). The rebrand will roll out **one module at a time** rather than as a single big-bang change, and this phase covers only the **Dashboard** module plus the shared shell/atoms it needs.

### Scope decisions

- The sidebar/topbar (`AppLayout.jsx`) is one shared shell instance for the whole app — it will be restyled **now**, so every module's chrome matches the reference immediately, even though page *content* is redesigned module by module afterward.
- Shared atoms genuinely reused by other pages (`StatCard`, `.card`, table styling) will be **edited in place**, not forked. Their new props are additive/optional so existing callers on other pages don't break, but their default visual (icon shape, spacing, colors) changes everywhere immediately — an accepted, known side effect.
- Anything *not* explicitly covered by that decision (`.section-header` gradient banner, `.btn-primary`, `.badge-*`, generic `table/th/td` styling) is **left untouched** this phase, since those are still load-bearing for unmigrated pages (Projects, Companies, Employees, etc.) and touching them now would defeat the module-by-module rollout.

No folder restructuring — this stays inside the existing `src/pages/`, `src/components/ui/`, `src/layouts/` layout. One new sibling folder, `src/components/widgets/`, is added for composite/multi-part shared pieces (chart, dual-stat split), matching the "shared UI components & widgets" scope — this is additive, not a reorganization.

### Critical constraint (bridge/legacy coexistence)

`bridge/index.js` (legacy vanilla-JS layer) still looks up the topbar's notif bell, role-switcher, view-as-exit button, and user-chip spans **by exact id** (`notif-btn`, `role-switcher`, `view-as-exit`, `active-avatar`, `active-user-name`, `active-user-role`) to wire real behavior not yet ported to React. All shell restyling must be **CSS/class/token changes only** — no id, element-type, or structural changes to these nodes, or the legacy wiring breaks silently.

---

## Phase 1 Breakdown

### 1. Design tokens

Add new tokens **additively** to `src/styles/global.css` `:root` (alongside the existing teal `--brand`/`--brand-2`/etc., which stay):

```css
--rose: #E8607A;        /* primary accent — sidebar active state, avatar */
--rose-2: #F2879C;
--rose-soft: rgba(232,96,122,.14);
--blush: #FBE9EE;       /* pastel icon-tile bg */
--blush-ink: #C24868;   /* icon color on blush */
--amber-tint: #FBF3E2;  /* pastel icon-tile bg, tint 2 */
--violet-tint: #F1EBFC; /* pastel icon-tile bg, tint 3 */
--sky-tint: #E8F3FB;    /* pastel icon-tile bg, tint 4 */
--sky-ink: #2D82B5;
--mint-tint: #E7F7EF;   /* pastel icon-tile bg, tint 5 */
```

Mirror the subset in `src/styles/variables.css` and add `@theme` aliases in `src/index.css` for Tailwind utility use.

### 2. Shell restyle

**`src/layouts/AppLayout.jsx`** + **`src/styles/global.css`** (CSS-only, no JSX structure/id changes):

- `#sidebar`: white background, light border-right, softer shadow (no dark navy gradient).
- `.nav-item`: dark slate text by default; `:hover` → rose-soft tint; `.active` → rose-soft background + rose text.
- `.nav-group-label`: keep uppercase/muted treatment, verify contrast on light bg.
- `.sidebar-footer`: light outlined pill (not dark translucent).
- **New**: decorative wavy SVG graphic (rose-tinted) behind sidebar footer, inline in JSX, absolutely positioned, `pointer-events: none`.
- `#topbar`: keep frosted-white (already close), verify border/shadow.
- `.user-avatar`: rose gradient (not teal).
- Sign-out button inline style: swap red token for rose token.
- `#role-switcher` `<select>`: keep native element + id + legacy wiring; add className for rounded-pill look.
- **New**: footer line in `#content` wrapper (© text, below `<Outlet/>`), shell-level chrome.

### 3. Shared atom edits

**`StatCard.jsx`** (affects 9 pages immediately: Dashboard + Projects, ServiceDesk, Leave, Receivables, Invoices, Approvals, Overview, Organizations):
- Icon container: rounded-square pastel tile (e.g. `bg-blush rounded-2xl`) instead of circle.
- Remove top gradient bar.
- Value text: always `var(--ink)` neutral dark (not colored by `color` prop).
- **New optional prop**: `trend: { value: string, direction: 'up'|'down'|'flat' }` — small colored pill top-right (green up, red down, muted flat). Omitted if not passed.
- Keep existing `label`/`value`/`sub`/`color`/`icon` props unchanged so other pages work without edits.

**`SectionTitle.jsx`**:
- **New optional props**: `subdued: bool` (default `true` for backwards compat), `right: ReactNode` (trailing kebab slot).
- Dashboard passes `subdued={false}` + `right={<KebabMenu/>}`.

**New `ProgressBar.jsx`**:
- `<ProgressBar value={pct} color="rose|green|amber|sky" />`
- Replaces inline `.progress`/`.progress-bar` CSS pattern.

**New `KebabMenu.jsx`**:
- `<MoreVertical/>` button trigger, presentational-only (no menu items wired yet).

### 4. New shared widgets

**`src/components/widgets/RevenueCostChart.jsx`**:
- React/SVG grouped-bar chart (clean pattern from `src/pages/Overview/RevenueGrowthChart.jsx`).
- Rose bars (Revenue), neutral gray (Cost), ₹ K/L/Cr axis formatting.
- Hover tooltip, gradient defs, dashed gridlines, legend row.
- Replaces legacy imperative `lineChart()` from `bridge/pages/dashboard.js`.

**Extract helper** `src/utils/format.js`:
- Pull `fmt()` logic from `lineChart()` into a shared `formatCurrency(value, style='short'|'long')` helper so both legacy and new chart can use it without duplication.

**`src/components/widgets/DualStatSplit.jsx`**:
- Two big numbers + one split progress bar (Billable vs Non-billable hours pattern).
- Takes `{ label, value, color }` for each stat and a shared percentage; renders with `ProgressBar`.

### 5. Dashboard page assembly

**`src/pages/Dashboard/DashboardPage.jsx`**:
- Replace `.section-header` banner with local plain header (no gradient; built inline, not reusing shared class).
- Move period `<select>` to its own row above stat grid (pill styling).
- Add `trend` prop to `StatCard` calls where meaningful (initially omitted, flagging that backend deltas are needed).
- Replace `RevenueCostChart` wrapper with new `components/widgets/RevenueCostChart.jsx`.
- Replace inline billable/non-billable block with `DualStatSplit`.
- Replace `ProjectListCard`'s `dangerouslySetInnerHTML` with `DataTable` + `ProgressBar` + `KebabMenu`.
- Keep `EmployeeDashboard`/`FinanceDashboard` structure as-is this phase (only Admin/Manager redesigned).
- Remove `lineChart`/`projRows` imports from `bridge/pages/dashboard.js` (legacy dead code).

---

## Explicitly out of scope

- `.section-header`, `.btn-primary`, `.badge-*`, generic `table/th/td` global CSS — unmigrated pages still rely on these.
- Other page folders (Companies, Projects, etc.) — module-by-module rollout.
- `FinanceDashboard`/`EmployeeDashboard` full redesign — inherit shared-atom changes only.
- Backend enhancements (period-over-period deltas, etc.) — flagged as gaps, not faked.
- Functional kebab-menu actions — trigger presentational only.

---

## Verification checklist

- [ ] `npm run dev` — `/dashboard` visually matches `../references/Redesign_dashboard.jpeg` for Admin/Manager.
- [ ] Click through Projects, Overview (Super Admin), Timesheets to verify `StatCard` icon shape/neutral value color is acceptable across pages.
- [ ] Topbar elements (notif bell, sign-out, user chip) still function (legacy wiring untouched).
- [ ] Sidebar collapse toggle works, responsive breakpoints (1100px, mobile) still responsive.
- [ ] No console errors or `dangerouslySetInnerHTML` deprecation warnings.
