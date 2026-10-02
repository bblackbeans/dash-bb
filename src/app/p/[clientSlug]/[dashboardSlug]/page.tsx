import { notFound } from "next/navigation";
import { DashboardViewer } from "@/components/dashboard/dashboard-viewer";
import { parseTheme } from "@/lib/dashboard-theme";
import { loadDashboardRows } from "@/lib/load-dataset";
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

  let rows: Awaited<ReturnType<typeof loadDashboardRows>> = [];
  let sourceError = "";
  try {
    rows = await loadDashboardRows(dashboard);
  } catch (error) {
    sourceError = error instanceof Error ? error.message : "Não foi possível ler os dados.";
  }
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
        rows={rows}
        widgets={dashboard.widgets}
        theme={parseTheme(dashboard.themeJson)}
        readOnly
      />
    </main>
  );
}
