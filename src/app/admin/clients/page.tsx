import Link from "next/link";
import { FolderPlus, Trash2 } from "lucide-react";
import { ClientSettings } from "@/components/admin/client-settings";
import { createClientAction, deleteClientAction } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LabelWithHelp } from "@/components/ui/label-with-help";
import { PageHeader } from "@/components/ui/page-header";
import { Tooltip } from "@/components/ui/tooltip";

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { dashboards: true } } },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Clientes"
        description="Pastas/locais dos clientes BlackBeans. Cada cliente agrupa seus dashboards."
        breadcrumbs={[
          { href: "/admin", label: "Admin" },
          { label: "Clientes" },
        ]}
      />

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-medium text-[var(--bb-cream)]">
          Novo cliente
        </h2>
        <form action={createClientAction} className="grid gap-3 sm:grid-cols-3">
          <div>
            <LabelWithHelp
              htmlFor="name"
              help="Nome comercial do cliente (ex.: Johnson & Johnson)."
            >
              Nome
            </LabelWithHelp>
            <Input id="name" name="name" placeholder="Nome do cliente" required />
          </div>
          <div>
            <LabelWithHelp
              htmlFor="slug"
              help="Usado na URL pública. Se vazio, geramos a partir do nome."
            >
              Slug
            </LabelWithHelp>
            <Input id="slug" name="slug" placeholder="opcional" />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              <FolderPlus className="h-4 w-4" />
              Criar cliente
            </Button>
          </div>
        </form>
      </Card>

      {clients.length ? (
        <ul className="divide-y divide-[var(--bb-border)] overflow-hidden rounded-[var(--bb-radius-xl)] border border-[var(--bb-border)]">
          {clients.map((client) => (
            <li
              key={client.id}
              className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bb-surface)] px-4 py-3"
            >
              <div>
                <Link
                  href={`/admin/clients/${client.slug}`}
                  className="font-medium text-[var(--bb-cream)] hover:text-[var(--bb-accent)]"
                >
                  {client.name}
                </Link>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-[var(--bb-gray)]">
                  <span>/{client.slug}</span>
                  <Badge tone="neutral">
                    {client._count.dashboards} dashboard(s)
                  </Badge>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ClientSettings id={client.id} name={client.name} slug={client.slug} />
                <form action={deleteClientAction}>
                <input type="hidden" name="id" value={client.id} />
                <Tooltip content="Remove o cliente e todos os dashboards (cascade).">
                  <Button type="submit" variant="danger" size="sm">
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </Button>
                </Tooltip>
              </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={FolderPlus}
          title="Nenhum cliente ainda"
          description="Crie a primeira pasta de cliente para começar a publicar dashboards."
        />
      )}
    </div>
  );
}
