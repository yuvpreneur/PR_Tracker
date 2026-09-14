import { forwardRef } from 'react';

// A standard native <select>, styled by global.css's .form-control — the same look and
// behaviour as the hand-written `<select className="form-control">` filters on
// Receivables/Payslips/NoAccess. It replaces a custom button + portalled listbox that
// looked nothing like the rest of the app's form controls and gave up everything a real
// <select> provides for free: keyboard navigation and type-ahead, form participation,
// mobile/native pickers, and screen-reader semantics.
//
// The prop shape is unchanged from that implementation — value / onChange(value) /
// options[{value,label}] / placeholder / disabled / className / style — so every call
// site keeps working as-is. `ref` is forwarded to the <select> so callers can focus it
// (AccessControlPage's "Assign Project" button does).
const Dropdown = forwardRef(function Dropdown({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  disabled = false,
  className = '',
  style,
  ...rest
}, ref) {
  const opts = Array.isArray(options) ? options : [];
  const current = value ?? '';
  // React blanks a <select> whose value matches no <option> (and warns) — which happens
  // routinely here, either because nothing is chosen yet or because the options are still
  // being fetched. Render a stand-in option so the control always shows something real:
  // the placeholder when nothing is selected, otherwise the pending value itself, so a
  // saved selection isn't silently dropped while its list loads.
  const hasMatch = opts.some(o => String(o.value) === String(current));

  return (
    <select
      ref={ref}
      className={className ? `form-control ${className}` : 'form-control'}
      style={style}
      value={current}
      disabled={disabled}
      onChange={e => onChange?.(e.target.value)}
      {...rest}
    >
      {!hasMatch && (
        current === ''
          ? <option value="" disabled>{placeholder}</option>
          : <option value={current}>{current}</option>
      )}
      {opts.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
});

export default Dropdown;
