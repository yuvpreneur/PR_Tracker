# Dashboard Redesign — Visual Testing Checklist

**Dev Server:** http://localhost:5174  
**Reference Design:** `docs/references/Redesign_dashboard.jpeg`

---

## Phase 1: Dashboard Visual Match

### Admin/Manager Dashboard (`/dashboard`)

**Visual Checklist:**
- [ ] Sidebar is **light white** (not dark navy)
- [ ] Sidebar has **light gray border-right** (not white semi-transparent)
- [ ] Navigation items are **dark slate text** by default (not white)
- [ ] Active nav item is **rose-tinted background** with **rose text** (not white gradient)
- [ ] Wavy SVG graphic visible at bottom of sidebar (faint rose wave)
- [ ] Top bar is **frosted white** with light border (unchanged from before, should look good)
- [ ] Avatar circle is **rose gradient** (not teal)
- [ ] Sign-out button is **rose-tinted** (not red)
- [ ] Page header: Plain dark "Dashboard" text + gray subtitle (no gradient banner)
- [ ] Period selector `<select>` is **pill-shaped** (rounded edges)
- [ ] Footer copyright line visible at very bottom: "© 2025 [Org Name] | AProve Catalysts. All rights reserved."

**Stat Cards (8 cards, 4 + 4 layout):**
- [ ] Each card has **rounded-square icon tile** (not circle), tinted background matching icon color
  - Example: green icon on mint-green tint, amber icon on amber-tint, etc.
- [ ] Icon container is positioned top-right of card
- [ ] Value text is **dark neutral** (not colored by icon color anymore)
- [ ] Label, value, sub-text follow new styling

**Charts & Widgets:**
- [ ] "Monthly Revenue vs Cost" chart renders correctly
  - [ ] Rose bars for revenue
  - [ ] Gray bars for cost
  - [ ] Month labels on x-axis (Jan'26, etc.)
  - [ ] Y-axis shows K/L/Cr formatted currency (₹18.0K, etc.)
  - [ ] Hover over bars → tooltip shows formatted values
- [ ] "Billable vs Non-Billable Hours" card
  - [ ] Two big numbers side-by-side (green billable, amber non-billable)
  - [ ] Progress bar below showing split (green portion = billable %)
  - [ ] Text labels below progress bar

**Project Table:**
- [ ] Table renders without `dangerouslySetInnerHTML` warning in console
- [ ] Columns: Project, Revenue, Cost, Profit, Status
  - [ ] Project name is bold, followed by progress bar + "% · client" line
  - [ ] Revenue is green
  - [ ] Cost is amber
  - [ ] Profit is teal or red depending on sign
  - [ ] Status has colored badge (green/amber/gray/purple depending on status)
- [ ] Kebab menu button (⋮) appears on hover per row
  - [ ] Button is muted gray, turns lighter on hover
  - [ ] No menu items visible (just the trigger button for now)

---

## Phase 2: Ripple Effect (StatCard Changes Across Pages)

### Projects Page (`/projects`)

**StatCard Changes:**
- [ ] Any KPI or summary cards use the new rounded-square icon tiles
- [ ] Icon colors match the reference (rose/green/amber/teal, etc.)
- [ ] Values are neutral dark text (not colored)
- [ ] Page still looks cohesive (no visual clashing with the new cards)
- [ ] No console errors related to StatCard

### Super Admin Overview (`/overview`)

**Key Checks:**
- [ ] Light sidebar visible (same as Dashboard)
- [ ] Rose navigation states
- [ ] Any StatCards use the new design
- [ ] RevenueGrowthChart (if visible) still renders correctly

### Other Pages Using StatCard

Check at least one of: Invoices, Receivables, Leave, Approvals, ServiceDesk

- [ ] StatCard icon shape and colors look consistent
- [ ] Values are readable (neutral dark text)
- [ ] No layout breakage

---

## Phase 3: Shell Integration & Legacy Wiring

### Topbar Elements (All Pages)

**Notification Bell:**
- [ ] Bell icon visible top-right of topbar
- [ ] Badge dot visible when there are notifications (red dot)
- [ ] Clicking bell should trigger the legacy notification behavior (may show toast/modal from bridge)
  - If you see behavior, good; if nothing happens, check console for errors

**User Chip (Top Right):**
- [ ] Avatar circle visible (rose gradient)
- [ ] User name visible next to avatar
- [ ] User role visible below name (e.g., "Admin")

**Sign-Out Button:**
- [ ] Button visible with rose-tinted background
- [ ] Text "Sign out" readable
- [ ] Clicking it logs you out (redirects to login)

**Role Switcher (if visible):**
- [ ] `<select>` is pill-shaped (if you have Admin/Manager role)
- [ ] Currently disabled (gray out) unless you're testing role-switching feature
- [ ] No console errors when interacting

---

## Phase 4: Responsive & Interactions

### Sidebar Collapse

**On any page:**
- [ ] Collapse button (◀ Collapse) visible at bottom of sidebar
- [ ] Click it → sidebar shrinks to 72px wide
- [ ] Nav icons still visible, labels hidden
- [ ] Click again → sidebar expands back to 276px
- [ ] Navigation still works while collapsed

### Responsive Breakpoints

**At 1100px width (use browser DevTools):**
- [ ] Stats grid changes from 4 columns → 2 columns
- [ ] Chart grid changes from 2 columns → 1 column (stacked)
- [ ] Page still readable

**At mobile width (< 600px):**
- [ ] Sidebar collapses by default or becomes overlay
- [ ] Content is readable, not cramped
- [ ] No horizontal scroll on page body

---

## Phase 5: Console & Build Quality

### Browser Console (F12 → Console tab)

**Dashboard page load:**
- [ ] No red error messages
- [ ] No "dangerouslySetInnerHTML" deprecation warnings (legacy Dashboard code is gone)
- [ ] No network errors (404s, CORS, etc.)
- [ ] No missing icon warnings

### Other Pages:

- [ ] Projects, Invoices, Overview, etc. load without console errors
- [ ] Check for any React warnings related to StatCard prop changes

---

## Phase 6: Data Correctness

### Dashboard Data

**Verify the values displayed match what you expect:**
- [ ] Total Revenue, Expenses, Net Profit numbers make sense
- [ ] Stat card counts (Companies, Active Projects, Headcount) are accurate
- [ ] Project table shows actual project data from the API
- [ ] Monthly chart shows data points (not blank)

**If data seems wrong:**
- [ ] Check the API (`/api/dashboard/admin/*` endpoints)
- [ ] Verify you're logged in as an Admin/Manager (different roles see different dashboards)
- [ ] Check browser Network tab for failed API calls

---

## Passing Criteria

✅ **Dashboard passes if:**
1. Visual matches reference JPEG (light sidebar, rose accents, stat cards, charts, tables)
2. No console errors
3. All interactive elements work (collapse, topbar buttons, period selector)
4. StatCard changes on other pages don't break layouts
5. Responsive design still works

⚠️ **Warnings to note (not blockers):**
- Trend pills on stat cards are omitted (API doesn't provide period-over-period deltas yet)
- Kebab menu buttons do nothing (Phase 3+ future work to wire actions)
- Legacy bridge notifications may not work (depends on backend state)

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| Page shows old dark sidebar | Clear browser cache (Ctrl+Shift+Del) and hard-refresh (Ctrl+Shift+R) |
| StatCards look broken | Check console for React errors; verify you're on latest code (git pull) |
| Charts not rendering | Check console for SVG/data errors; verify API is returning `monthly` data |
| Topbar buttons don't work | Check console; these may depend on legacy bridge code (Phase 3) |
| Responsive breaks at breakpoint | Check CSS in global.css for `.stats-row`, `.grid-2` media queries |

---

## Sign-Off

Once all above pass, the implementation is ready for:
- Code review (commit history, code style, backward compat)
- Merge to main
- Module-by-module rollout of remaining pages

**Estimated time:** 10-15 minutes for visual walkthrough
