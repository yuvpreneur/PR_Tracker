import { useState } from 'react';
import { Landmark } from 'lucide-react';
import PayRegisterTab from './PayRegisterTab.jsx';
import EmployeeDetailsTab from './EmployeeDetailsTab.jsx';
import JobDetailsTab from './JobDetailsTab.jsx';
import BankStatutoryTab from './BankStatutoryTab.jsx';

const TABS = [
  { id: 'register', label: 'Pay Register', Component: PayRegisterTab },
  { id: 'employee', label: 'Employee Details', Component: EmployeeDetailsTab },
  { id: 'job', label: 'Job Details', Component: JobDetailsTab },
  { id: 'bank', label: 'Bank & Statutory Details', Component: BankStatutoryTab },
];

export default function PayrollPage() {
  const [tab, setTab] = useState('register');
  const Active = TABS.find(t => t.id === tab)?.Component || PayRegisterTab;

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
