import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ExternalLink,
  LayoutTemplate,
  Plus,
  Trash2,
} from "lucide-react";
import {
  deleteDashboardAction,
  updateClientAction,
} from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LabelWithHelp } from "@/components/ui/label-with-help";
import { PageHeader } from "@/components/ui/page-header";
import { Tooltip } from "@/components/ui/tooltip";

type Props = { params: Promise<{ slug: string }> };

export default async function ClientDetailPage({ params }: Props) {
  const { slug } = await params;
  const client = await prisma.client.findUnique({
    where: { slug },
    include: {
      dashboards: { orderBy: { updatedAt: "desc" } },
    },
  });
  if (!client) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={client.name}
        description={`Pasta do cliente · /${client.slug}`}
        breadcrumbs={[
          { href: "/admin/clients", label: "Clientes" },
          { label: client.name },
        ]}
        actions={
          <Tooltip content="Abrir o wizard para informar dados, fonte e widgets">
            <Link href={`/admin/clients/${client.slug}/dashboards/new`}>
              <Button>
                <Plus className="h-4 w-4" />
                Novo dashboard
              </Button>
            </Link>
          </Tooltip>
        }
      />

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-medium">Dados do cliente</h2>
        <form
          action={updateClientAction}
          className="grid gap-3 sm:grid-cols-3"
        >
          <input type="hidden" name="id" value={client.id} />
          <div>
            <LabelWithHelp htmlFor="name" help="Nome exibido no admin e no viewer.">
              Nome
            </LabelWithHelp>
            <Input id="name" name="name" defaultValue={client.name} />
          </div>
          <div>
            <LabelWithHelp
              htmlFor="slug"
              help="Altera o segmento da URL pública de todos os dashboards."
            >
              Slug
            </LabelWithHelp>
            <Input id="slug" name="slug" defaultValue={client.slug} />
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="secondary" className="w-full">
              Salvar cliente
            </Button>
          </div>
        </form>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Dashboards</h2>
          <Link href={`/admin/clients/${client.slug}/dashboards/new`}>
            <Button size="sm" variant="secondary">
              <Plus className="h-4 w-4" />
              Criar
            </Button>
          </Link>
        </div>

        {client.dashboards.length ? (
          <ul className="divide-y divide-[var(--bb-border)] overflow-hidden rounded-[var(--bb-radius-xl)] border border-[var(--bb-border)]">
            {client.dashboards.map((dash) => (
              <li
                key={dash.id}
                className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bb-surface)] px-4 py-3"
              >
                <div>
                  <Link
                    href={`/admin/clients/${client.slug}/dashboards/${dash.slug}`}
                    className="font-medium hover:text-[var(--bb-accent)]"
                  >
                    {dash.title}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-[var(--bb-gray)]">
                    <span>/{dash.slug}</span>
                    <Badge tone={dash.isPublic ? "success" : "neutral"}>
                      {dash.isPublic ? "público" : "privado"}
                    </Badge>
                    <Badge tone="info">{dash.dataSource}</Badge>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {dash.isPublic ? (
                    <Tooltip content="Abre a URL pública em nova aba">
                      <Link
                        href={`/p/${client.slug}/${dash.slug}`}
                        target="_blank"
                        className="inline-flex"
                      >
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                          Público
                        </Button>
                      </Link>
                    </Tooltip>
                  ) : null}
                  <form action={deleteDashboardAction}>
                    <input type="hidden" name="id" value={dash.id} />
                    <input type="hidden" name="clientSlug" value={client.slug} />
                    <Tooltip content="Exclui o dashboard e seus widgets">
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
            icon={LayoutTemplate}
            title="Nenhum dashboard ainda"
            description="Use o wizard para escolher a fonte de dados e montar os widgets."
            action={
              <Link href={`/admin/clients/${client.slug}/dashboards/new`}>
                <Button>
                  <Plus className="h-4 w-4" />
                  Novo dashboard
                </Button>
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}
