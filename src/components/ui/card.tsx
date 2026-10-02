import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[var(--bb-radius-xl)] border border-[var(--bb-border)] bg-[var(--bb-surface)] shadow-[var(--bb-shadow)] ${className}`}
    >
      {children}
    </div>
  );
}
