import { forwardRef } from 'react';

const FormInput = forwardRef(function FormInput(
  { label, error, hint, className = '', id, ...props },
  ref
) {
  const inputId = id || props.name;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`input-field ${error ? 'border-danger focus:ring-danger/20 focus:border-danger' : ''}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...props}
      />
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
