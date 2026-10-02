"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Tooltip } from "@/components/ui/tooltip";

export function LogoutButton({ email }: { email?: string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <>
      <div className="flex items-center gap-3 text-sm">
        {email ? (
          <span className="hidden text-[var(--bb-gray)] sm:inline">{email}</span>
        ) : null}
        <Tooltip content="Encerrar sessão do admin">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--bb-radius)] px-3 py-2 text-[var(--bb-cream)] hover:bg-white/5"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </Tooltip>
      </div>

      <Modal
        open={open}
        title="Sair da conta?"
        description="Você precisará fazer login novamente para acessar o admin."
        onClose={() => (!pending ? setOpen(false) : undefined)}
        onConfirm={confirm}
        confirmLabel="Sim, sair"
        confirmVariant="danger"
        pending={pending}
      />
    </>
  );
}
