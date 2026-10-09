import { notFound } from "next/navigation";
import { DashboardViewer } from "@/components/dashboard/dashboard-viewer";
import { parseBigQuerySource } from "@/lib/bigquery";
import { parseTheme } from "@/lib/dashboard-theme";
import { loadDashboardViewRows } from "@/lib/load-dataset";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ clientSlug: string; dashboardSlug: string }>;
};

export default async function PublicDashboardPage({ params }: Props) {
  const { clientSlug, dashboardSlug } = await params;
  const dashboard = await prisma.dashboard.findFirst({
    where: {
      slug: dashboardSlug,
      isPublic: true,
      client: { slug: clientSlug },
    },
    include: { client: true, widgets: true },
  });
  if (!dashboard) notFound();

  const source = parseBigQuerySource(dashboard.sourceJson);
  let rowsByView: Record<string, Awaited<ReturnType<typeof loadDashboardViewRows>>[string]> = {};
  let sourceError = "";
  try {
    rowsByView = await loadDashboardViewRows(dashboard);
  } catch (error) {
    sourceError = error instanceof Error ? error.message : "Não foi possível ler os dados.";
  }
  const rows = source ? rowsByView[source.table] || [] : rowsByView.mock || [];
  if (sourceError) {
    return (
      <main className="mx-auto w-full max-w-[1240px] px-6 py-16">
        <p className="text-sm text-[var(--bb-gray)]">{sourceError}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1240px] px-6 py-8">
      <div className="mb-6">
        <img
          src="/brand/blackbeans.png"
          alt="blackbeans. agência de marketing digital"
          width={991}
          height={180}
          className="h-auto w-[280px]"
        />
      </div>
      <DashboardViewer
        title={dashboard.title}
        subtitle={dashboard.client.name}
        clientName={dashboard.client.name}
        rows={rows}
        rowsByView={dashboard.dataSource === "bigquery" ? rowsByView : undefined}
        pages={source && source.pages.length > 1 ? source.pages : undefined}
        widgets={dashboard.widgets}
        theme={parseTheme(dashboard.themeJson)}
        readOnly
      />
    </main>
  );
}
