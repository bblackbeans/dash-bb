import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { BigQuerySource } from "@/components/admin/bigquery-source";
import { CopyPublicUrl } from "@/components/admin/copy-public-url";
import { DashboardBuilder } from "@/components/admin/dashboard-builder";
import { EditPagesButton } from "@/components/admin/edit-pages-button";
import { togglePublicAction } from "@/lib/actions";
import {
  bigQueryConfigured,
  bigQueryProjectId,
  parseBigQuerySource,
} from "@/lib/bigquery";
import { parseTheme } from "@/lib/dashboard-theme";
import { BUILTIN_TEMPLATES, templateFromRecord } from "@/lib/dashboard-templates";
import { loadDashboardViewRows } from "@/lib/load-dataset";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Tooltip } from "@/components/ui/tooltip";

type Props = {
  params: Promise<{ slug: string; dashSlug: string }>;
};

export default async function AdminDashboardPage({ params }: Props) {
  const { slug, dashSlug } = await params;
  const dashboard = await prisma.dashboard.findFirst({
    where: { slug: dashSlug, client: { slug } },
    include: { client: true, widgets: true },
  });
  if (!dashboard) notFound();

  const source = parseBigQuerySource(dashboard.sourceJson);
  let rowsByView: Record<string, Awaited<ReturnType<typeof loadDashboardViewRows>>[string]> = {};
  let sourceError = "";
  try {
    rowsByView = await loadDashboardViewRows(dashboard);
  } catch (error) {
    sourceError = error instanceof Error ? error.message : "Não foi possível ler a fonte de dados.";
  }
  const rows = source ? rowsByView[source.table] || [] : rowsByView.mock || [];
  const savedTemplates = await prisma.dashboardTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });
  const templates = [
    ...BUILTIN_TEMPLATES,
    ...savedTemplates.map(templateFromRecord),
  ];
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "http";
  const publicUrl = `${proto}://${host}/p/${dashboard.client.slug}/${dashboard.slug}`;

  return (
    <div className="bb-dash-page space-y-6">
      <PageHeader
        title={dashboard.title}
        description={
          dashboard.description ||
          (dashboard.dataSource === "bigquery" && source
            ? `BigQuery · ${source.dataset}.${source.table}`
            : `Preview admin · JSON · ${dashboard.mockPath}`)
        }
        breadcrumbs={[
          { href: "/admin/clients", label: "Clientes" },
          {
            href: `/admin/clients/${dashboard.client.slug}`,
            label: dashboard.client.name,
          },
          { label: dashboard.title },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={dashboard.isPublic ? "success" : "neutral"}>
              {dashboard.isPublic ? "público" : "privado"}
            </Badge>
            <Badge tone="info">{dashboard.dataSource}</Badge>
            <EditPagesButton />
            <form action={togglePublicAction}>
              <input type="hidden" name="id" value={dashboard.id} />
              <input
                type="hidden"
                name="clientSlug"
                value={dashboard.client.slug}
              />
              <input type="hidden" name="dashSlug" value={dashboard.slug} />
              <input
                type="hidden"
                name="isPublic"
                value={dashboard.isPublic ? "false" : "true"}
              />
              <Tooltip
                content={
                  dashboard.isPublic
                    ? "Remove o acesso pela URL pública"
                    : "Libera a URL pública somente leitura"
                }
              >
                <Button type="submit" variant="secondary" size="sm">
                  {dashboard.isPublic ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      Despublicar
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Publicar
                    </>
                  )}
                </Button>
              </Tooltip>
            </form>
            {dashboard.isPublic ? (
              <Tooltip content="Copia o link para enviar ao cliente">
                <span>
                  <CopyPublicUrl url={publicUrl} />
                </span>
              </Tooltip>
            ) : null}
            {dashboard.isPublic ? (
              <Link href={`/p/${dashboard.client.slug}/${dashboard.slug}`} target="_blank">
                <Button variant="ghost" size="sm">
                  Abrir público
                </Button>
              </Link>
            ) : null}
          </div>
        }
      />

      <BigQuerySource
        dashboardId={dashboard.id}
        clientSlug={dashboard.client.slug}
        dashSlug={dashboard.slug}
        projectId={bigQueryProjectId()}
        configured={bigQueryConfigured()}
        connectionError={dashboard.dataSource === "bigquery" ? sourceError : ""}
        dataset={source?.dataset || ""}
        table={source?.table || ""}
        pages={source?.pages || []}
      />

      <DashboardBuilder
        dashboardId={dashboard.id}
        clientSlug={dashboard.client.slug}
        dashSlug={dashboard.slug}
        title={dashboard.title}
        subtitle={`${dashboard.client.name} · /p/${dashboard.client.slug}/${dashboard.slug}`}
        rows={rows}
        rowsByView={dashboard.dataSource === "bigquery" ? rowsByView : undefined}
        pages={source?.pages}
        datasetId={dashboard.dataSource === "bigquery" ? source?.dataset : undefined}
        initialTheme={parseTheme(dashboard.themeJson)}
        initialTemplates={templates}
        initialWidgets={[...dashboard.widgets]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((widget) => ({
            id: widget.id,
            type: widget.type,
            title: widget.title,
            configJson: widget.configJson,
            sortOrder: widget.sortOrder,
          }))}
      />
    </div>
  );
}
