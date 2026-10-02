"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import {
  deleteDashboardTemplateAction,
  updateDashboardTemplateAction,
} from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";

export type TemplateRow = {
  id: string;
  name: string;
  description: string;
  builtin: boolean;
  widgets: number;
};

export function TemplateManager({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [removing, setRemoving] = useState<TemplateRow | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function openEdit(template: TemplateRow) {
    setError("");
    setName(template.name);
    setDescription(template.description);
    setEditing(template);
  }

  async function saveEdit() {
    if (!editing) return;
    setPending(true);
    const result = await updateDashboardTemplateAction({
      id: editing.id,
      name,
      description,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!removing) return;
    setPending(true);
    const result = await deleteDashboardTemplateAction({ id: removing.id });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRemoving(null);
    setError("");
    router.refresh();
  }

  return (
    <>
      <ul className="grid gap-3 lg:grid-cols-2">
        {templates.map((template) => (
          <li
            key={template.id}
            className="flex items-start justify-between gap-3 rounded-[var(--bb-radius-xl)] border border-[var(--bb-border)] bg-[var(--bb-surface)] p-4"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-[var(--bb-cream)]">{template.name}</p>
                <Badge tone={template.builtin ? "accent" : "neutral"}>
                  {template.builtin ? "pronto" : "salvo"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-[var(--bb-gray)]">
                {template.description || "Sem descrição"}
              </p>
              <p className="mt-2 text-xs text-[var(--bb-gray)]">
                {template.widgets} bloco{template.widgets === 1 ? "" : "s"}
              </p>
            </div>
            {template.builtin ? null : (
              <div className="flex shrink-0 gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(template)} aria-label={`Editar ${template.name}`}>
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                <Button type="button" size="sm" variant="danger" onClick={() => { setError(""); setRemoving(template); }} aria-label={`Excluir ${template.name}`}>
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <Modal
        open={Boolean(editing)}
        title="Editar modelo"
        description="O nome e a descrição aparecem na lista do estúdio."
        onClose={() => (!pending ? setEditing(null) : undefined)}
        onConfirm={saveEdit}
        confirmLabel="Salvar"
        pending={pending}
      >
        <div className="space-y-3">
          <label className="block space-y-1 text-sm text-[var(--bb-gray)]">
            Nome
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
          </label>
          <label className="block space-y-1 text-sm text-[var(--bb-gray)]">
            Descrição
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={180} rows={3} />
          </label>
          {error && editing ? <p className="text-sm text-red-300">{error}</p> : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(removing)}
        title="Excluir modelo?"
        description={removing ? `"${removing.name}" sai da lista. Os dashboards que já usam essa montagem não mudam.` : undefined}
        onClose={() => (!pending ? setRemoving(null) : undefined)}
        onConfirm={confirmDelete}
        confirmLabel="Excluir"
        confirmVariant="danger"
        pending={pending}
      >
        {error && removing ? <p className="text-sm text-red-300">{error}</p> : null}
      </Modal>
    </>
  );
}
