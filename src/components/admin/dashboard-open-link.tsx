"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link, { useLinkStatus } from "next/link";

type Props = {
  href: string;
  title: string;
};

export function DashboardOpenLink({ href, title }: Props) {
  return (
    <Link href={href} className="font-medium hover:text-[var(--bb-accent)]">
      {title}
      <Opening title={title} />
    </Link>
  );
}

function Opening({ title }: { title: string }) {
  const { pending } = useLinkStatus();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!pending || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-6">
      <div className="flex items-center gap-3 rounded-[var(--bb-radius-xl)] border border-[var(--bb-border)] bg-[var(--bb-surface)] px-5 py-4 shadow-xl">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--bb-accent)] border-t-transparent" />
        <p className="text-sm text-[var(--bb-cream)]">Abrindo {title}...</p>
      </div>
    </div>,
    document.body
  );
}
