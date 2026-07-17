import { state } from '../core/state.js';

// Populate all filter dropdowns with real data from caches
export function populateFilterDropdowns() {
  const uniq = (arr, key) => [...new Set(arr.map(x => x[key]).filter(Boolean))];
  document.querySelectorAll('[id^="page-"] select').forEach(sel => {
    if (sel.closest('[id^="modal"]') || sel.closest('.modal') || sel.closest('[class*="modal"]')) return;
    const txt = (sel.options[0]?.text || '').toLowerCase();
    let replaced = false;

    if (txt.includes('all projects')) {
      sel.innerHTML = '<option value="">All Projects</option>' +
        state.projects.map(p => `<option value="${p.id}">${p.id} - ${p.name}</option>`).join('');
      replaced = true;
    } else if (txt.includes('all clients')) {
      const clients = uniq(state.projects, 'client');
      sel.innerHTML = '<option value="">All Clients</option>' +
        clients.map(c => `<option value="${c}">${c}</option>`).join('');
      replaced = true;
    } else if (txt.includes('all employees')) {
      sel.innerHTML = '<option value="">All Employees</option>' +
        state.employees.map(e => `<option value="${e.emp_id}">${e.emp_id} - ${e.name}</option>`).join('');
      replaced = true;
    } else if (txt.includes('all owners')) {
      sel.innerHTML = '<option value="">All Owners</option>' +
        state.employees.map(e => `<option value="${e.name}">${e.name}</option>`).join('');
      replaced = true;
    } else if (txt.includes('all depts')) {
      const depts = uniq(state.employees, 'department');
      sel.innerHTML = '<option value="">All Depts</option>' +
        depts.map(d => `<option value="${d}">${d}</option>`).join('');
      replaced = true;
    } else if (txt.includes('all billing codes')) {
      sel.innerHTML = '<option value="">All Billing Codes</option>' +
        state.bcodes.map(b => `<option value="${b.code}">${b.code}</option>`).join('');
      replaced = true;
    }

    if (replaced) sel.selectedIndex = 0;
  });
}

// Wire all filter selects and search boxes — pass loaders map and loadPage fn from index.js
export function wireFilters(loaders, loadPage) {
  Object.keys(loaders).forEach(pageId => {
    const page = document.getElementById(pageId);
    if (!page) return;

    const searchEl = page.querySelector('input[placeholder*="earch"]');
    if (searchEl) {
      let _t;
      searchEl.addEventListener('input', () => {
        clearTimeout(_t);
        _t = setTimeout(() => {
          state.pf[pageId] = { ...state.pf[pageId], search: searchEl.value.trim() || undefined };
          loadPage(pageId);
        }, 350);
      });
    }

    const selects = Array.from(page.querySelectorAll('select'))
      .filter(s => !s.closest('[id^="modal"]') && !s.closest('.modal') && !s.closest('[class*="modal"]'));

    selects.forEach(sel => {
      const firstOptText = (sel.options[0]?.text || '').toLowerCase();
      const param = Object.entries(state.PARAM_MAP).find(([k]) => firstOptText.includes(k))?.[1];
      if (!param) return;
      sel.addEventListener('change', () => {
        const raw = sel.value;
        const v = (raw === '' || raw.toLowerCase().startsWith('all ')) ? undefined : raw;
        const overrides = state.PAGE_PARAM_OVERRIDES[pageId] || {};
        const actualParam = overrides[param] || param;
        state.pf[pageId] = { ...state.pf[pageId], [actualParam]: v };
        loadPage(pageId);
      });
    });
  });
}
