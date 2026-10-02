import { type TextareaHTMLAttributes, forwardRef } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(
  ({ className = "", ...props }, ref) => (
    <textarea
      ref={ref}
      className={`w-full rounded-[var(--bb-radius)] border border-[var(--bb-border)] bg-[var(--bb-surface)] px-3 py-2 text-sm text-[var(--bb-cream)] placeholder:text-[var(--bb-gray)]/70 disabled:opacity-50 ${className}`}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
