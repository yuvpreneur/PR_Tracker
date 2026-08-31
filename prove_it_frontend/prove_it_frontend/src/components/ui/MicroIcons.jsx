// Tiny semantic SVG icons for UI decoration and context reinforcement
export const MicroIcons = {
  // 3-5 tiny user circles connected with thin lines - team/organization context
  TeamNetwork: ({ size = 24, color = 'currentColor', opacity = 0.6 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" opacity={opacity}>
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="6" cy="14" r="2.5" />
      <circle cx="18" cy="14" r="2.5" />
      <circle cx="6" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <line x1="12" y1="7" x2="6" y2="12" strokeLinecap="round" />
      <line x1="12" y1="7" x2="18" y2="12" strokeLinecap="round" />
      <line x1="6" y1="16" x2="6" y2="18.5" strokeLinecap="round" />
      <line x1="18" y1="16" x2="18" y2="18.5" strokeLinecap="round" />
    </svg>
  ),

  // Minimal badge/card with avatar circle + two text strokes
  EmployeeCard: ({ size = 24, color = 'currentColor', opacity = 0.6 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" opacity={opacity}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="8" cy="12" r="3" />
      <line x1="12" y1="10" x2="19" y2="10" strokeLinecap="round" />
      <line x1="12" y1="14" x2="19" y2="14" strokeLinecap="round" />
    </svg>
  ),

  // Tiny ascending line graph with 3 dots
  GrowthChart: ({ size = 24, color = 'currentColor', opacity = 0.6 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" opacity={opacity}>
      <circle cx="6" cy="16" r="1.5" fill={color} />
      <circle cx="12" cy="11" r="1.5" fill={color} />
      <circle cx="18" cy="7" r="1.5" fill={color} />
      <polyline points="6,16 12,11 18,7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  // Calendar + check for attendance/leave
  CalendarCheck: ({ size = 24, color = 'currentColor', opacity = 0.6 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" opacity={opacity}>
      <rect x="4" y="5" width="14" height="12" rx="1" />
      <line x1="4" y1="9" x2="18" y2="9" strokeLinecap="round" />
      <line x1="11" y1="5" x2="11" y2="3" strokeLinecap="round" />
      <line x1="7" y1="5" x2="7" y2="3" strokeLinecap="round" />
      <polyline points="15,12 16,13 18,11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  // Briefcase + spark for projects/workforce
  BriefcaseSpark: ({ size = 24, color = 'currentColor', opacity = 0.6 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" opacity={opacity}>
      <rect x="3" y="8" width="14" height="9" rx="1" />
      <line x1="3" y1="11" x2="17" y2="11" strokeLinecap="round" />
      <line x1="7" y1="8" x2="7" y2="6" strokeLinecap="round" />
      <line x1="13" y1="8" x2="13" y2="6" strokeLinecap="round" />
      <circle cx="19" cy="6" r="1.5" fill={color} />
      <path d="M19 4 L19 8 M17 6 L21 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  // Manager node branching to employee nodes - org hierarchy
  OrganizationTree: ({ size = 24, color = 'currentColor', opacity = 0.6 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" opacity={opacity}>
      <circle cx="12" cy="4" r="2" />
      <circle cx="6" cy="14" r="1.5" />
      <circle cx="12" cy="14" r="1.5" />
      <circle cx="18" cy="14" r="1.5" />
      <line x1="12" y1="6" x2="12" y2="10" strokeLinecap="round" />
      <line x1="12" y1="10" x2="6" y2="12.5" strokeLinecap="round" />
      <line x1="12" y1="10" x2="12" y2="12.5" strokeLinecap="round" />
      <line x1="12" y1="10" x2="18" y2="12.5" strokeLinecap="round" />
    </svg>
  ),

  // Clock + check for timesheets/hours
  ClockCheck: ({ size = 24, color = 'currentColor', opacity = 0.6 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" opacity={opacity}>
      <circle cx="10" cy="12" r="7" />
      <line x1="10" y1="8" x2="10" y2="12" strokeLinecap="round" />
      <line x1="10" y1="12" x2="13" y2="12" strokeLinecap="round" />
      <polyline points="16,8 17,9 19,7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  // Target for performance/KPI
  Target: ({ size = 24, color = 'currentColor', opacity = 0.6 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" opacity={opacity}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="2" fill={color} />
    </svg>
  ),

  // Document + tick for approvals/HR documents
  DocumentTick: ({ size = 24, color = 'currentColor', opacity = 0.6 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" opacity={opacity}>
      <path d="M5 4 L5 20 Q5 21 6 21 L18 21 Q19 21 19 20 L19 8 L14 3 L6 3 Q5 3 5 4" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="14" y1="3" x2="14" y2="8" x2="19" y2="8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="9,14 10.5,15.5 13,12.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),

  // Abstract connected dots - universal decoration for empty spaces
  ConnectedDots: ({ size = 24, color = 'currentColor', opacity = 0.4 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1" opacity={opacity}>
      <circle cx="6" cy="6" r="1.5" fill={color} />
      <circle cx="12" cy="8" r="1.5" fill={color} />
      <circle cx="18" cy="6" r="1.5" fill={color} />
      <circle cx="9" cy="15" r="1.5" fill={color} />
      <circle cx="15" cy="16" r="1.5" fill={color} />
      <line x1="6" y1="6" x2="12" y2="8" strokeLinecap="round" />
      <line x1="12" y1="8" x2="18" y2="6" strokeLinecap="round" />
      <line x1="12" y1="8" x2="9" y2="15" strokeLinecap="round" />
      <line x1="9" y1="15" x2="15" y2="16" strokeLinecap="round" />
    </svg>
  ),
};
