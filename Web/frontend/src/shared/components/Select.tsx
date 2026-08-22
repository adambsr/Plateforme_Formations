import { forwardRef, type SelectHTMLAttributes } from 'react';

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className = '', 'aria-invalid': invalid, ...props }, ref) {
  return (
    <span className={`select-control ${invalid ? 'select-error' : ''}`}>
      <select
        {...props}
        ref={ref}
        className={className}
        aria-invalid={invalid}
      />
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="m6 8 4 4 4-4" />
      </svg>
    </span>
  );
});
