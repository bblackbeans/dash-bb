import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--bb-radius-xl)] border border-dashed border-[var(--bb-border)] px-6 py-14 text-center">
      <div className="rounded-full bg-[var(--bb-accent)]/10 p-3 text-[var(--bb-accent)]">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-medium text-[var(--bb-cream)]">{title}</h3>
        {description ? (
          <p className="max-w-sm text-sm text-[var(--bb-gray)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
