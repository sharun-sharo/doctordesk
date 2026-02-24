import { forwardRef } from 'react';

const FormInput = forwardRef(function FormInput(
  { label, error, hint, className = '', id, rightAdornment, 'aria-label': ariaLabel, ...props },
  ref
) {
  const inputId = id || props.name;
  const hasAdornment = !!rightAdornment;
  const inputClasses = [
    'input-field input-focus-ring',
    error ? 'border-danger focus:ring-danger/20 focus:border-danger' : '',
    hasAdornment ? 'pr-12' : '',
  ].filter(Boolean).join(' ');
  const computedAriaLabel = ariaLabel ?? (label && typeof label === 'string' ? label : undefined);

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          className={inputClasses}
          aria-invalid={!!error}
          aria-label={computedAriaLabel}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {hasAdornment && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center [&_button]:min-h-[44px] [&_button]:min-w-[44px] [&_button]:rounded-lg [&_button]:text-slate-500 [&_button]:hover:text-slate-700 [&_button]:focus:outline-none [&_button]:focus:ring-2 [&_button]:focus:ring-primary-500 [&_button]:focus:ring-inset">
            {rightAdornment}
          </div>
        )}
      </div>
      {hint && !error && (
        <p id={`${inputId}-hint`} className="mt-1.5 text-caption text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="mt-1.5 text-caption text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

export default FormInput;
