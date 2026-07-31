import { iconSvg } from '../../bridge/shared/icons.js';

export const SERVICE_DESK_HERO_HTML = `<div class="feature-hero">
          <h2 style="display:flex;align-items:center;gap:10px">${iconSvg('LifeBuoy', { size: 22 })} Service Desk Integration</h2>
          <p>ServiceNow-style request management for project support, change requests, access issues, finance queries, and cancellation workflows. Track every ticket from creation through assignment, resolution, closure, or controlled cancellation.</p>
          <div class="feature-actions">
            <button class="btn btn-primary" onclick="openModal('modal-ticket')">${iconSvg('Plus', { size: 14 })} Create Ticket</button>
            <button class="btn btn-ghost" onclick="openModal('modal-ticket-cancel')">${iconSvg('XCircle', { size: 14 })} Cancel Ticket</button>
            <button class="btn btn-ghost">${iconSvg('RefreshCw', { size: 14 })} Sync with ServiceNow</button>
          </div>
        </div>
        `;

export const SERVICE_DESK_WORKFLOW_HTML = `<div class="workflow-grid">
          <div class="workflow-step"><strong>${iconSvg('FilePlus2', { size: 14 })} 1. Create</strong><span>Requester submits ticket with project, category, priority, attachments, and impact.</span></div>
          <div class="workflow-step"><strong>${iconSvg('Search', { size: 14 })} 2. Triage</strong><span>Queue owner validates data, urgency, SLA, and duplicates.</span></div>
          <div class="workflow-step"><strong>${iconSvg('UserCheck', { size: 14 })} 3. Assign</strong><span>Route to IT, Finance, PMO, HR, or application owner.</span></div>
          <div class="workflow-step"><strong>${iconSvg('Wrench', { size: 14 })} 4. Work</strong><span>Track comments, tasks, approvals, dependency blockers, and effort.</span></div>
          <div class="workflow-step"><strong>${iconSvg('CheckCircle2', { size: 14 })} 5. Resolve</strong><span>Owner provides resolution notes, evidence, and impacted records.</span></div>
          <div class="workflow-step"><strong>${iconSvg('Archive', { size: 14 })} 6. Close</strong><span>Requester confirms closure or auto-close after the waiting period.</span></div>
          <div class="workflow-step cancel"><strong>${iconSvg('XCircle', { size: 14 })} Cancel</strong><span>Controlled cancellation with reason, approval, and audit trail.</span></div>
        </div>
        <div class="integration-grid">
          <div class="mini-panel"><div class="kicker">Integration Health</div><div class="big">Live</div><p>Webhook listener, outbound API sync, and ticket status mapping are ready for ServiceNow-style integration.</p></div>
          <div class="mini-panel"><div class="kicker">Mapped Queues</div><div class="big">8</div><p>IT Support, PMO, Finance, Billing, Access, HR, Vendor, and Application Support.</p></div>
          <div class="mini-panel"><div class="kicker">Audit Controls</div><div class="big">100%</div><p>All create, update, assign, resolve, close, and cancel actions are audit-ready.</p></div>
        </div>
        `;
