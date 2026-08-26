import { CheckCircle2, XCircle, Clock, Info, Loader2, MinusCircle, AlertCircle, AlertTriangle, Circle } from 'lucide-react';

// Mirrors bridge/shared/ui.js's badge() color map so migrated pages stay
// visually identical to the still-legacy pages using the old string-based badge.
const STATUS_COLORS = {
  Active: '#22c55e', Inactive: '#94a3b8', Pending: '#f59e0b', Approved: '#22c55e',
  Rejected: '#ef4444', Open: '#3b82f6', 'In Progress': '#8b5cf6', Resolved: '#22c55e',
  Closed: '#94a3b8', Cancelled: '#ef4444', 'Won / Project': '#22c55e', 'Lost / Cold': '#ef4444',
  New: '#3b82f6', Contacted: '#8b5cf6', Qualified: '#f59e0b', Proposal: '#f97316',
  Billable: '#22c55e', 'Non-Billable': '#94a3b8', High: '#ef4444', Critical: '#7c2222',
  Medium: '#f59e0b', Low: '#22c55e', 'T&M': '#8b5cf6', Fixed: '#3b82f6',
  Milestone: '#f97316', Present: '#22c55e', Absent: '#ef4444', WFH: '#3b82f6',
  Paid: '#22c55e', Partial: '#f59e0b', Overdue: '#ef4444', 'Not Started': '#94a3b8',
  Draft: '#94a3b8', Sent: '#3b82f6', Void: '#ef4444',
  Completed: '#22c55e', 'On Hold': '#f59e0b', 'Waiting Approval': '#f97316',
  'Pending Finance': '#8b5cf6',
  // PR Manager sync status (Companies/Projects/Employees)
  Synced: '#22c55e', 'Not Synced': '#94a3b8', Incomplete: '#f59e0b',
  Blocked: '#ef4444', 'Sync Failed': '#ef4444',
  'Not Enabled': '#94a3b8', 'Pending Invite': '#f59e0b',
};

// Icon reflects the color tier (not the literal status text), so it stays correct
// for any status string that maps onto an existing color, including ones added later.
const COLOR_ICONS = {
  '#22c55e': CheckCircle2, '#ef4444': XCircle, '#f59e0b': Clock, '#3b82f6': Info,
  '#8b5cf6': Loader2, '#94a3b8': MinusCircle, '#f97316': AlertCircle, '#7c2222': AlertTriangle,
};

export default function Badge({ status }) {
  const color = STATUS_COLORS[status] || '#64748b';
  const Icon = COLOR_ICONS[color] || Circle;
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: `${color}20`, color }}
    >
      <Icon size={11} strokeWidth={2.5} />
      {status || '—'}
    </span>
  );
}
