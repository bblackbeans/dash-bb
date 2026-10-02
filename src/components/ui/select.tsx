import { type SelectHTMLAttributes, forwardRef } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, Props>(
  ({ className = "", children, ...props }, ref) => (
    <select
      ref={ref}
      className={`w-full rounded-[var(--bb-radius)] border border-[var(--bb-border)] bg-[var(--bb-surface)] px-3 py-2 text-sm text-[var(--bb-cream)] disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";
