import Link from "next/link";
import { FolderKanban, LayoutTemplate } from "lucide-react";
import { TemplateManager } from "@/components/admin/template-manager";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { bigQueryConfigured, bigQueryProjectId } from "@/lib/bigquery";
import { BUILTIN_TEMPLATES, templateFromRecord } from "@/lib/dashboard-templates";
import { prisma } from "@/lib/prisma";

export default async function AdminHomePage() {
  const [clients, dashboards, savedTemplates, recent] = await Promise.all([
    prisma.client.count(),
    prisma.dashboard.count(),
    prisma.dashboardTemplate.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.dashboard.findMany({
      orderBy: { updatedAt: "desc" },
      include: { client: true },
      take: 6,
    }),
  ]);

  const templates = [
    ...savedTemplates.map((record) => {
      const parsed = templateFromRecord(record);
      return {
        id: parsed.id,
        name: parsed.name,
        description: parsed.description,
        builtin: false,
        widgets: parsed.widgets.length,
      };
    }),
    ...BUILTIN_TEMPLATES.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      builtin: true,
      widgets: template.widgets.length,
    })),
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Início"
        description="Atalhos dos dashboards e a biblioteca de modelos da BlackBeans."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/clients">
          <Card className="p-5 transition hover:border-[var(--bb-accent)]">
            <div className="flex items-center gap-3 text-[var(--bb-gray)]">
              <FolderKanban className="h-5 w-5 text-[var(--bb-accent)]" />
              <p className="text-sm">Clientes</p>
            </div>
            <p className="mt-3 text-3xl font-semibold text-[var(--bb-accent)]">{clients}</p>
          </Card>
        </Link>
        <Card className="p-5">
          <div className="flex items-center gap-3 text-[var(--bb-gray)]">
            <LayoutTemplate className="h-5 w-5 text-[var(--bb-accent)]" />
            <p className="text-sm">Dashboards</p>
          </div>
          <p className="mt-3 text-3xl font-semibold text-[var(--bb-accent)]">{dashboards}</p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-lg font-semibold text-[var(--bb-cream)]">BigQuery</h2>
        <p className="mt-1 text-sm text-[var(--bb-gray)]">
          Projeto {bigQueryProjectId()}, região US. {bigQueryConfigured()
            ? "A chave da conta de serviço está no servidor. Abra um dashboard e escolha o dataset e a view."
            : "Falta a chave JSON em secrets/bigquery-service-account.json. Com ela, cada dashboard escolhe o dataset e a view."}
        </p>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--bb-cream)]">Dashboards recentes</h2>
          <p className="text-sm text-[var(--bb-gray)]">Abra um painel para montar ou publicar.</p>
        </div>
        {recent.length ? (
          <ul className="divide-y divide-[var(--bb-border)] overflow-hidden rounded-[var(--bb-radius-xl)] border border-[var(--bb-border)]">
            {recent.map((dashboard) => (
              <li key={dashboard.id} className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bb-surface)] px-4 py-3">
                <div>
                  <Link
                    href={`/admin/clients/${dashboard.client.slug}/dashboards/${dashboard.slug}`}
                    className="font-medium text-[var(--bb-cream)] hover:text-[var(--bb-accent)]"
                  >
                    {dashboard.title}
                  </Link>
                  <p className="text-sm text-[var(--bb-gray)]">{dashboard.client.name}</p>
                </div>
                <Badge tone={dashboard.isPublic ? "success" : "neutral"}>
                  {dashboard.isPublic ? "público" : "privado"}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--bb-gray)]">Nenhum dashboard ainda.</p>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--bb-cream)]">Modelos</h2>
          <p className="text-sm text-[var(--bb-gray)]">
            Os prontos entram em qualquer cliente. Os que você salva no estúdio podem ser renomeados ou excluídos. Para mudar os blocos, aplique o modelo num dashboard, ajuste e salve de novo.
          </p>
        </div>
        <TemplateManager templates={templates} />
      </section>
    </div>
  );
}
