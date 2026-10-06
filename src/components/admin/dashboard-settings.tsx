"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateDashboardAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LabelWithHelp } from "@/components/ui/label-with-help";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  id: string;
  clientSlug: string;
  title: string;
  slug: string;
  description: string;
  label?: string;
  stayOnList?: boolean;
};

export function DashboardSettings({
  id,
  clientSlug,
  title,
  slug,
  description,
  label = "Editar dados",
  stayOnList = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateDashboardAction, {
    error: "",
    saved: false,
  });
  const titleId = `dash-title-${id}`;
  const slugId = `dash-slug-${id}`;
  const descriptionId = `dash-description-${id}`;

  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) setOpen(false);
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal
        open={open}
        title="Dados do dashboard"
        description="Esse nome aparece no admin e na página pública."
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        pending={pending}
      >
        <form action={action} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="clientSlug" value={clientSlug} />
          {stayOnList ? <input type="hidden" name="stay" value="list" /> : null}
          <div>
            <LabelWithHelp htmlFor={titleId} help="Nome exibido no admin e para o cliente.">
              Nome
            </LabelWithHelp>
            <Input id={titleId} name="title" defaultValue={title} required />
          </div>
          <div>
            <LabelWithHelp htmlFor={slugId} help="Trecho final da URL pública.">
              Endereço
            </LabelWithHelp>
            <Input id={slugId} name="slug" defaultValue={slug} required />
            <p className="mt-1 text-xs text-[var(--bb-gray)]">
              /p/{clientSlug}/{slug}
            </p>
          </div>
          <div>
            <LabelWithHelp htmlFor={descriptionId} help="Texto curto abaixo do nome. Pode ficar vazio.">
              Descrição
            </LabelWithHelp>
            <Textarea id={descriptionId} name="description" rows={3} defaultValue={description} />
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
