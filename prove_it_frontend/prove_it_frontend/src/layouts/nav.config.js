import {
  LayoutDashboard, ChartColumn, Building2, FolderKanban, Tag, CreditCard, LifeBuoy,
  Users, Banknote, Clock, Palmtree, Landmark, Receipt, Wallet, FileText, Handshake,
  Inbox, ClipboardCheck, UserCog, ShieldCheck, KeyRound, ClipboardList, Settings,
} from 'lucide-react';

// Ported verbatim (groups + page ids/labels) from appScript's NAV array in
// src/pages/Replica/appMarkup.js as part of the bridge-removal migration (Phase 1) —
// see usePermissions.js/useReferenceData.jsx for the same pattern applied earlier.
// Icons use the same page-id -> lucide mapping bridge/index.js's NAV_ICON_MAP already
// established (repainted there over the legacy emoji icons); duplicated here as real
// lucide-react components instead of the vanilla 'lucide' package's icon nodes.
export const NAV = [
  { group: 'Overview', items: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'reports', label: 'Reports', icon: ChartColumn },
  ] },
  { group: 'Delivery', items: [
    { id: 'companies', label: 'Companies', icon: Building2 },
    { id: 'projects', label: 'Projects', icon: FolderKanban, external: true, href: 'https://pm.proveit.in/' },
    { id: 'project-codes', label: 'Project Codes', icon: Tag },
    { id: 'billing-codes', label: 'Billing Codes', icon: CreditCard },
  ] },
  { group: 'Sales & Service', items: [
    { id: 'service-desk', label: 'Service Desk', icon: LifeBuoy },
  ] },
  { group: 'People & Time', items: [
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'hourly-cost', label: 'Hourly Cost', icon: Banknote },
    { id: 'timesheets', label: 'Timesheets', icon: Clock },
    { id: 'leave', label: 'Leave', icon: Palmtree },
    { id: 'payroll', label: 'Payroll', icon: Landmark },
    { id: 'payslips', label: 'My Payslips', icon: Receipt },
  ] },
  { group: 'Finance', items: [
    { id: 'expenses', label: 'Expenses', icon: Wallet },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'customers', label: 'Customers', icon: Handshake },
    { id: 'receivables', label: 'Receivables', icon: Inbox },
    { id: 'approvals', label: 'Approvals', icon: ClipboardCheck },
  ] },
  { group: 'Admin', items: [
    { id: 'users', label: 'Users', icon: UserCog },
    { id: 'roles', label: 'Roles & Perms', icon: ShieldCheck },
    { id: 'access-control', label: 'Access Control', icon: KeyRound },
    { id: 'audit', label: 'Audit Log', icon: ClipboardList },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] },
];

export const NAV_ITEMS = NAV.flatMap(section => section.items);
