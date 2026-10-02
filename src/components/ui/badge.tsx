import type { ReactNode } from "react";

const tones = {
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  error: "bg-red-500/15 text-red-300 border-red-500/30",
  info: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  neutral: "bg-white/5 text-[var(--bb-gray)] border-[var(--bb-border)]",
  accent: "bg-[var(--bb-accent)]/15 text-[var(--bb-accent)] border-[var(--bb-accent)]/40",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
