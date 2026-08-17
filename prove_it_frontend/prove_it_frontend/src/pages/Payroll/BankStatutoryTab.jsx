import EmployeeFieldGroupTab from './EmployeeFieldGroupTab.jsx';
import { BANK_STATUTORY_FIELDS } from './bankStatutoryFields.js';

export default function BankStatutoryTab() {
  return (
    <EmployeeFieldGroupTab
      basePath="/api/payroll/bank-details"
      fields={BANK_STATUTORY_FIELDS}
      previewKeys={['bank_name', 'ifsc', 'pf_no', 'uan']}
      modalTitlePrefix="Bank & Statutory Details"
    />
  );
}
