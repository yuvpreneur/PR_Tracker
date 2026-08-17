import EmployeeFieldGroupTab from './EmployeeFieldGroupTab.jsx';
import { EMPLOYEE_DETAILS_EXTRA_FIELDS } from './employeeDetailsFields.js';

export default function EmployeeDetailsTab() {
  return (
    <EmployeeFieldGroupTab
      basePath="/api/payroll/employee-details"
      fields={EMPLOYEE_DETAILS_EXTRA_FIELDS}
      readOnlyKeys={['email']}
      previewKeys={['dob', 'pan', 'notice_period']}
      modalTitlePrefix="Employee Details"
    />
  );
}
