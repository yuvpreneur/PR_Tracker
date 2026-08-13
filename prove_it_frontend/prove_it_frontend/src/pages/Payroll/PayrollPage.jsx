import { useState } from 'react';
import { Landmark } from 'lucide-react';
import RunsTab from './RunsTab.jsx';
import SalaryStructureTab from './SalaryStructureTab.jsx';
import HolidaysWeeklyOffTab from './HolidaysWeeklyOffTab.jsx';
import AdvancesTab from './AdvancesTab.jsx';

const TABS = [
  { id: 'runs', label: 'Runs', Component: RunsTab },
  { id: 'salary-structure', label: 'Salary Structure', Component: SalaryStructureTab },
  { id: 'holidays', label: 'Holidays & Weekly Off', Component: HolidaysWeeklyOffTab },
  { id: 'advances', label: 'Advances', Component: AdvancesTab },
];

export default function PayrollPage() {
  const [tab, setTab] = useState('runs');
  const Active = TABS.find(t => t.id === tab)?.Component || RunsTab;

  return (
    <div>
      <div className="section-header">
        <h2 className="flex items-center gap-2"><Landmark size={22} /> Payroll</h2>
      </div>

      <div className="mb-5 flex gap-1 border-b border-line">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-2 text-[13px] font-semibold ${tab === t.id ? 'border-b-2 border-brand text-brand-3' : 'text-muted'}`}
            style={tab === t.id ? { borderColor: 'var(--color-brand)' } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Active />
    </div>
  );
}
