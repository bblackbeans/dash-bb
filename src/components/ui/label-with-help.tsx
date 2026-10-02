"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { Tooltip } from "./tooltip";

export function LabelWithHelp({
  htmlFor,
  children,
  help,
}: {
  htmlFor?: string;
  children: ReactNode;
  help: string;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--bb-gray)]">
      <label htmlFor={htmlFor}>{children}</label>
      <Tooltip content={help}>
        <button
          type="button"
          className="inline-flex rounded p-0.5 text-[var(--bb-gray)] hover:text-[var(--bb-accent)]"
          aria-label={`Ajuda: ${help}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
    </div>
  );
}
