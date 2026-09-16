import { ChevronDown } from 'lucide-react';
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
        className={`content-select ${className}`.trim()}
        aria-invalid={invalid}
      />
      <ChevronDown aria-hidden="true" />
    </span>
  );
});
