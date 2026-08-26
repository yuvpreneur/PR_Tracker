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
      <div className="page-header">
        <h2><Landmark size={22} /> Payroll</h2>
      </div>

      <div className="mb-5 flex gap-2">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-[13px] font-semibold rounded-lg border-none ${tab === t.id ? 'text-white' : ''}`}
            style={tab === t.id ? { background: 'var(--rose)' } : { background: 'var(--rose-soft)', color: 'var(--rose)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Active />
    </div>
  );
}
