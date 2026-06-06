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
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel =
    options.find((option) => option.value === value)?.label ??
    placeholder ??
    'Select...';

  useEffect(() => {
    if (!open) return;

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

  return (
    <div ref={containerRef} className={`relative w-full max-w-full min-w-0 ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`w-full max-w-full min-w-0 bg-white border border-border-gray focus:border-primary-green rounded-xl py-2 sm:py-2.5 px-3 text-[11px] sm:text-xs text-primary-text outline-none transition-all flex items-center justify-between gap-2 text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${triggerClassName}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate flex-1 min-w-0">{selectedLabel}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-secondary-text transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 w-full max-w-full min-w-0 bg-white border border-border-gray rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto"
        >
          {options.map((option) => (
            <li key={option.value} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`w-full max-w-full min-w-0 px-3 py-2.5 text-[11px] sm:text-xs text-left transition-colors flex items-center justify-between gap-2 ${
                  option.value === value
                    ? 'bg-very-light-green text-primary-green font-semibold'
                    : 'text-primary-text hover:bg-secondary-bg'
                }`}
              >
                <span className="truncate min-w-0">{option.label}</span>
                {option.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
