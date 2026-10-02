"use client";

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  confirmVariant?: "primary" | "danger";
  pending?: boolean;
};

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  confirmLabel,
  cancelLabel = "Cancelar",
  onConfirm,
  confirmVariant = "primary",
  pending,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, pending]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-black/70"
        aria-label="Fechar"
        onClick={() => {
          if (!pending) onClose();
        }}
      />
      <div className="relative z-10 w-full max-w-md rounded-[var(--bb-radius-xl)] border border-[var(--bb-border)] bg-[var(--bb-surface)] p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2
              id="modal-title"
              className="text-lg font-semibold text-[var(--bb-cream)]"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-[var(--bb-gray)]">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              if (!pending) onClose();
            }}
            className="cursor-pointer rounded p-1 text-[var(--bb-gray)] hover:text-[var(--bb-cream)]"
            aria-label="Fechar modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
        {onConfirm ? (
          <div className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={pending}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={confirmVariant}
              onClick={onConfirm}
              disabled={pending}
            >
              {pending ? "Aguarde..." : confirmLabel || "Confirmar"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
