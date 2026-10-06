"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateClientDetailsAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LabelWithHelp } from "@/components/ui/label-with-help";
import { Modal } from "@/components/ui/modal";

type Props = {
  id: string;
  name: string;
  slug: string;
};

export function ClientSettings({ id, name, slug }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateClientDetailsAction, {
    error: "",
    saved: false,
  });
  const nameId = `client-name-${id}`;
  const slugId = `client-slug-${id}`;

  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) setOpen(false);
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Editar
      </Button>
      <Modal
        open={open}
        title="Dados do cliente"
        description="O endereço entra na URL de todos os dashboards deste cliente."
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        pending={pending}
      >
        <form action={action} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <div>
            <LabelWithHelp htmlFor={nameId} help="Nome exibido no admin.">
              Nome
            </LabelWithHelp>
            <Input id={nameId} name="name" defaultValue={name} required />
          </div>
          <div>
            <LabelWithHelp htmlFor={slugId} help="Trecho da URL. Alterar muda o link dos dashboards.">
              Endereço
            </LabelWithHelp>
            <Input id={slugId} name="slug" defaultValue={slug} required />
            <p className="mt-1 text-xs text-[var(--bb-gray)]">/admin/clients/{slug}</p>
          </div>
          {state.error ? <p className="text-sm text-red-300">{state.error}</p> : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
