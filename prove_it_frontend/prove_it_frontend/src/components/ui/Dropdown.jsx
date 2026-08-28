import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp } from 'lucide-react';

export default function Dropdown({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  icon: Icon,
  disabled = false,
  className = '',
  style,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width
      });
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        ...style
      }}
      className={className}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          width: '100%',
          padding: '12px 16px',
          background: isOpen ? '#F3E4E9' : '#F7F8F3',
          border: isOpen ? '1px solid rgba(232, 96, 122, .3)' : '1px solid #E5E9DC',
          borderRadius: '16px',
          fontSize: '13px',
          fontWeight: 500,
          color: selectedOption ? 'var(--ink)' : 'var(--muted)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all .15s ease',
          opacity: disabled ? 0.6 : 1,
          minHeight: '42px'
        }}
        onMouseEnter={(e) => {
          if (!disabled && !isOpen) {
            e.currentTarget.style.background = '#F0F0ED';
            e.currentTarget.style.borderColor = '#D8DCD2';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.background = '#F7F8F3';
            e.currentTarget.style.borderColor = '#E5E9DC';
          }
        }}
      >
        {/* Label - No Icon */}
        <span style={{ flex: 1, textAlign: 'left' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        {/* Chevron */}
        <ChevronUp
          size={18}
          strokeWidth={2}
          style={{
            transition: 'transform .2s ease',
            transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)',
            color: 'var(--slate)'
          }}
        />
      </button>

      {/* Dropdown Menu - Rendered via Portal to escape stacking context */}
      {isOpen && createPortal(
        <div
          style={{
            position: 'fixed',
            top: `${menuPos.top}px`,
            left: `${menuPos.left}px`,
            width: `${menuPos.width}px`,
            background: '#FFFFFF',
            border: '1px solid #E5E9DC',
            borderRadius: '16px',
            boxShadow: '0 6px 16px -14px rgba(232, 96, 122, .25)',
            zIndex: 99999,
            overflow: 'hidden'
          }}
        >
          {options.map((option, idx) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '12px 16px',
                  background: isSelected ? 'linear-gradient(180deg, #F3E4E9 0%, #E8D4DC 100%)' : '#FFFFFF',
                  border: 'none',
                  borderBottom: idx < options.length - 1 ? '1px solid #F0F0ED' : 'none',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: isSelected ? 'var(--rose)' : 'var(--ink)',
                  cursor: 'pointer',
                  transition: 'background .1s ease',
                  textAlign: 'left',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = '#F9E8ED';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = '#FFFFFF';
                  }
                }}
              >
                {/* Option Label - No Icon */}
                <span>
                  {option.label}
                </span>

                {/* Checkmark for Selected */}
                {isSelected && (
                  <span style={{ color: 'var(--rose)', fontSize: '16px', fontWeight: 700, marginLeft: '8px' }}>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
