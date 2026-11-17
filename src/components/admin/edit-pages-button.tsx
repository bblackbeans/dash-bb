"use client";

import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

let openPages: (() => void) | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function registerPagesEditor(open: () => void) {
  openPages = open;
  notify();
  return () => {
    if (openPages === open) openPages = null;
    notify();
  };
}

export function EditPagesButton() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setReady(Boolean(openPages));
    sync();
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  if (!ready) return null;

  return (
    <Button type="button" variant="secondary" className="h-10 shrink-0 px-4" onClick={() => openPages?.()}>
      <Pencil className="h-4 w-4" />
      Editar páginas
    </Button>
  );
}
