import Link from "next/link";
import type { ReactNode } from "react";

type Crumb = { href?: string; label: string };

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-2">
        {breadcrumbs?.length ? (
          <nav className="flex flex-wrap items-center gap-1.5 text-sm text-[var(--bb-gray)]">
            {breadcrumbs.map((c, i) => (
              <span key={`${c.label}-${i}`} className="inline-flex items-center gap-1.5">
                {i > 0 ? <span aria-hidden>/</span> : null}
                {c.href ? (
                  <Link href={c.href} className="hover:text-[var(--bb-accent)]">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-[var(--bb-cream)]">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--bb-cream)]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-[var(--bb-gray)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
