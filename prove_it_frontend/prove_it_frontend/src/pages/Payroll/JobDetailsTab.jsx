import EmployeeFieldGroupTab from './EmployeeFieldGroupTab.jsx';
import { JOB_DETAILS_FIELDS } from './jobDetailsFields.js';

export default function JobDetailsTab() {
  return (
    <EmployeeFieldGroupTab
      basePath="/api/payroll/job-details"
      fields={JOB_DETAILS_FIELDS}
      readOnlyKeys={['designation', 'department', 'phone']}
      previewKeys={['designation', 'department', 'work_location']}
      modalTitlePrefix="Job Details"
    />
  );
}
