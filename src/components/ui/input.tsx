import { type InputHTMLAttributes, forwardRef } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={`w-full rounded-[var(--bb-radius)] border border-[var(--bb-border)] bg-[var(--bb-surface)] px-3 py-2 text-sm text-[var(--bb-cream)] placeholder:text-[var(--bb-gray)]/70 disabled:opacity-50 ${className}`}
      {...props}
    />
  )
);
Input.displayName = "Input";
