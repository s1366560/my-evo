'use client';

import React, { forwardRef, useState, useCallback, useId } from 'react';
import { clsx } from 'clsx';
import { Check, AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  showValidState?: boolean;
  onValidate?: (value: string) => string | null;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, showValidState = false, onValidate, type = 'text', ...props }, ref) => {
    const [touched, setTouched] = useState(false);
    const [isValid, setIsValid] = useState(false);
    const [validationMessage, setValidationMessage] = useState<string | null>(null);
    const generatedId = useId();
    const id = props.id || props.name || generatedId;

    const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      setTouched(true);
      if (onValidate) {
        const result = onValidate(e.target.value);
        setValidationMessage(result);
        setIsValid(result === null);
      }
      props.onBlur?.(e);
    }, [onValidate, props]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      if (touched && onValidate) {
        const result = onValidate(e.target.value);
        setValidationMessage(result);
        setIsValid(result === null);
      }
      props.onChange?.(e);
    }, [touched, onValidate, props]);

    const displayError = touched ? (error || validationMessage) : error;
    const showSuccess = showValidState && touched && !displayError && props.value && isValid;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;
    const describedBy = [displayError ? errorId : null, helperText && !displayError ? helperId : null].filter(Boolean).join(' ') || undefined;

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-gray-300">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            type={type}
            id={id}
            className={clsx(
              'flex h-10 w-full rounded-lg border bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500',
              'focus:outline-none focus:ring-2 transition-all duration-200',
              'disabled:cursor-not-allowed disabled:opacity-50',
              displayError
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : showSuccess
                ? 'border-emerald-500 focus:ring-emerald-500 focus:border-emerald-500'
                : 'border-white/20 focus:ring-purple-500 focus:border-transparent',
              className
            )}
            ref={ref}
            onBlur={handleBlur}
            onChange={handleChange}
            aria-invalid={displayError ? 'true' : undefined}
            aria-describedby={describedBy}
            aria-required={props.required ? 'true' : undefined}
            {...props}
          />
          {showSuccess && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Check className="w-4 h-4 text-emerald-500" />
            </div>
          )}
          {displayError && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
          )}
        </div>
        {displayError && (
          <p id={errorId} className="text-xs text-red-400 flex items-center gap-1" role="alert">
            <AlertCircle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            <span>{displayError}</span>
          </p>
        )}
        {helperText && !displayError && (
          <p id={helperId} className="text-xs text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  showValidState?: boolean;
  onValidate?: (value: string) => string | null;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, showValidState = false, onValidate, ...props }, ref) => {
    const [touched, setTouched] = useState(false);
    const [isValid, setIsValid] = useState(false);
    const [validationMessage, setValidationMessage] = useState<string | null>(null);
    const id = props.id || props.name;

    const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
      setTouched(true);
      if (onValidate) {
        const result = onValidate(e.target.value);
        setValidationMessage(result);
        setIsValid(result === null);
      }
      props.onBlur?.(e);
    }, [onValidate, props]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (touched && onValidate) {
        const result = onValidate(e.target.value);
        setValidationMessage(result);
        setIsValid(result === null);
      }
      props.onChange?.(e);
    }, [touched, onValidate, props]);

    const displayError = touched ? (error || validationMessage) : error;
    const showSuccess = showValidState && touched && !displayError && props.value && isValid;

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-gray-300">
            {label}
          </label>
        )}
        <div className="relative">
          <textarea
            id={id}
            className={clsx(
              'flex min-h-[120px] w-full rounded-lg border bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500',
              'focus:outline-none focus:ring-2 transition-all duration-200',
              'disabled:cursor-not-allowed disabled:opacity-50',
              displayError
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : showSuccess
                ? 'border-emerald-500 focus:ring-emerald-500 focus:border-emerald-500'
                : 'border-white/20 focus:ring-purple-500 focus:border-transparent',
              className
            )}
            ref={ref}
            onBlur={handleBlur}
            onChange={handleChange}
            {...props}
          />
          {showSuccess && (
            <div className="absolute right-3 top-3">
              <Check className="w-4 h-4 text-emerald-500" />
            </div>
          )}
          {displayError && (
            <div className="absolute right-3 top-3">
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
          )}
        </div>
        {displayError && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{displayError}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, ...props }, ref) => {
    const id = props.id || props.name;

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-gray-300">
            {label}
          </label>
        )}
        <select
          id={id}
          className={clsx(
            'flex h-10 w-full rounded-lg border border-white/20 bg-black/50 px-3 py-2 text-sm text-white',
            'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-500 focus:ring-red-500',
            className
          )}
          ref={ref}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

// Validation helpers
export const validators = {
  email: (value: string): string | null => {
    if (!value) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
    return null;
  },
  required: (value: string, fieldName = 'This field'): string | null => {
    if (!value || !value.trim()) return `${fieldName} is required`;
    return null;
  },
  minLength: (min: number) => (value: string): string | null => {
    if (value.length < min) return `Must be at least ${min} characters`;
    return null;
  },
  url: (value: string): string | null => {
    if (!value) return null; // Optional
    try {
      new URL(value);
      return null;
    } catch {
      return 'Invalid URL format';
    }
  },
};
