// Bridge to mount React Dropdown components into HTML modals while maintaining
// compatibility with bridge code that uses val()/set() on native select elements.
// This allows modals to use the Dropdown component's design without converting them to React.

import React from 'react';
import { createRoot } from 'react-dom/client';
import Dropdown from '../components/ui/Dropdown.jsx';

// Store root instances to allow cleanup/remounting
const dropdownRoots = new Map();

/**
 * Replace a native <select> in an HTML modal with a React Dropdown component.
 * Keeps a hidden native select in sync so val()/set() bridge functions still work.
 *
 * @param {string} modalId - ID of the modal element (e.g., 'modal-emp')
 * @param {string} labelHint - Text hint to find the select by its associated label
 * @param {Array} options - Options array: [{value, label}, ...]
 * @param {string} placeholder - Placeholder text
 */
export function replaceSelectWithDropdown(modalId, labelHint, options = [], placeholder = 'Select...') {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  // Find the native select by label
  const label = Array.from(modal.querySelectorAll('label, .form-label')).find(l =>
    l.textContent.trim().toLowerCase().includes(labelHint.toLowerCase())
  );
  if (!label) return;

  let nativeSelect = null;
  if (label.htmlFor) {
    nativeSelect = document.getElementById(label.htmlFor);
  } else {
    let sib = label.nextElementSibling;
    while (sib) {
      if (sib.tagName === 'SELECT') {
        nativeSelect = sib;
        break;
      }
      const sel = sib.querySelector('select');
      if (sel) {
        nativeSelect = sel;
        break;
      }
      sib = sib.nextElementSibling;
    }
  }

  if (!nativeSelect || nativeSelect.tagName !== 'SELECT') return;

  // Store current value
  const currentValue = nativeSelect.value;

  // Hide the native select
  nativeSelect.style.display = 'none';

  // Create a container for the React Dropdown right before the hidden select
  const containerId = `dropdown-${modalId}-${labelHint.replace(/\s+/g, '-').toLowerCase()}`;
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    nativeSelect.parentNode.insertBefore(container, nativeSelect);
  }

  // Clean up previous root if it exists
  if (dropdownRoots.has(containerId)) {
    dropdownRoots.get(containerId).unmount();
  }

  // Mount React Dropdown component
  const root = createRoot(container);
  const handleChange = (value) => {
    nativeSelect.value = value;
    // Trigger change event so any listeners are notified
    nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  };

  root.render(
    React.createElement(Dropdown, {
      value: currentValue || '',
      onChange: handleChange,
      options: options,
      placeholder: placeholder,
      style: { width: '100%' }
    })
  );

  dropdownRoots.set(containerId, root);
}

/**
 * Update the options for a Dropdown that's already been mounted.
 * @param {string} modalId
 * @param {string} labelHint
 * @param {Array} options
 */
export function updateDropdownOptions(modalId, labelHint, options = []) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const label = Array.from(modal.querySelectorAll('label, .form-label')).find(l =>
    l.textContent.trim().toLowerCase().includes(labelHint.toLowerCase())
  );
  if (!label) return;

  let nativeSelect = null;
  if (label.htmlFor) {
    nativeSelect = document.getElementById(label.htmlFor);
  } else {
    let sib = label.nextElementSibling;
    while (sib) {
      if (sib.tagName === 'SELECT') {
        nativeSelect = sib;
        break;
      }
      const sel = sib.querySelector('select');
      if (sel) {
        nativeSelect = sel;
        break;
      }
      sib = sib.nextElementSibling;
    }
  }

  if (!nativeSelect) return;

  // Update native select options for val() compatibility
  const currentValue = nativeSelect.value;
  nativeSelect.innerHTML = '';
  options.forEach(opt => {
    const optionEl = document.createElement('option');
    optionEl.value = opt.value || '';
    optionEl.textContent = opt.label || opt.value;
    nativeSelect.appendChild(optionEl);
  });
  if (currentValue && nativeSelect.querySelector(`option[value="${currentValue}"]`)) {
    nativeSelect.value = currentValue;
  }

  // Remount the Dropdown component with new options
  replaceSelectWithDropdown(modalId, labelHint, options);
}

/**
 * Cleanup all Dropdown components in a modal when it closes
 * @param {string} modalId
 */
export function cleanupModalDropdowns(modalId) {
  // Find and destroy all roots for this modal
  const prefix = `dropdown-${modalId}-`;
  for (const [containerId, root] of dropdownRoots.entries()) {
    if (containerId.startsWith(prefix)) {
      root.unmount();
      dropdownRoots.delete(containerId);
    }
  }
}

// Make these functions available globally so bridge code (non-React modules) can call them
if (typeof window !== 'undefined') {
  window.__updateDropdownOptions = updateDropdownOptions;
  window.__replaceSelectWithDropdown = replaceSelectWithDropdown;
}
