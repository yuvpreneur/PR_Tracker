import { iconSvg } from '../../bridge/shared/icons.js';

export const SERVICE_DESK_HERO_HTML = `<div style="display: flex; justify-content: space-between; align-items: center; margin-top: -20px; margin-bottom: 20px">
          <h2 style="display:flex;align-items:center;gap:10px">${iconSvg('LifeBuoy', { size: 22 })} Service Desk Integration</h2>
          <button class="btn btn-primary" onclick="openModal('modal-ticket')" style="background: var(--rose-soft); color: var(--rose); box-shadow: none; border: none; margin-top: 20px">${iconSvg('Plus', { size: 14 })} Create Ticket</button>
        </div>
        `;

export const SERVICE_DESK_WORKFLOW_HTML = ``;
