'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  placeholder?: string;
  arrowClassName?: string;
  optionClassName?: string;
}

export function SelectField({
  id,
  value,
  onChange,
  options,
  className = '',
  triggerClassName = '',
  disabled = false,
  placeholder,
  arrowClassName = 'h-3.5 w-3.5',
  optionClassName = '',
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel =
    options.find((option) => option.value === value)?.label ??
    placeholder ??
    'Select...';

  useEffect(() => {
    if (!open) {
      setOpenUp(false);
      return;
    }

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // If space below is less than 250px and space above is greater, open upwards
      if (spaceBelow < 250 && spaceAbove > spaceBelow) {
        setOpenUp(true);
      } else {
        setOpenUp(false);
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const hasPadding = triggerClassName.includes('py-') || triggerClassName.includes('h-');
  const hasTextSize = triggerClassName.includes('text-');
  const defaultPadding = hasPadding ? '' : 'py-2 sm:py-2.5 px-3';
  const defaultTextSize = hasTextSize ? '' : 'text-[11px] sm:text-xs';

  const hasOptionPadding = optionClassName.includes('py-') || optionClassName.includes('h-');
  const hasOptionTextSize = optionClassName.includes('text-');
  const defaultOptionPadding = hasOptionPadding ? '' : 'px-3 py-2.5';
  const defaultOptionTextSize = hasOptionTextSize ? '' : 'text-[11px] sm:text-xs';

  return (
    <div ref={containerRef} className={`relative w-full max-w-full min-w-0 ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`w-full max-w-full min-w-0 bg-white border border-border-gray focus:border-primary-green rounded-xl ${defaultPadding} ${defaultTextSize} text-slate-500 outline-none transition-all flex items-center justify-between gap-2 text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${triggerClassName}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate flex-1 min-w-0">{selectedLabel}</span>
        <ChevronDown
          className={`${arrowClassName} shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className={`absolute z-50 left-0 right-0 w-full max-w-full min-w-0 bg-white border border-border-gray rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto ${
            openUp ? 'bottom-full mb-1 origin-bottom' : 'top-full mt-1 origin-top'
          }`}
        >
          {options.map((option) => (
            <li key={option.value} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`w-full max-w-full min-w-0 text-left transition-colors flex items-center justify-between gap-2 ${defaultOptionPadding} ${defaultOptionTextSize} ${
                  option.value === value
                    ? 'bg-very-light-green text-primary-green font-semibold'
                    : 'text-slate-500 hover:bg-secondary-bg'
                } ${optionClassName}`}
              >
                <span className="truncate min-w-0">{option.label}</span>
                {option.value === value && <Check className={`shrink-0 ${arrowClassName}`} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
