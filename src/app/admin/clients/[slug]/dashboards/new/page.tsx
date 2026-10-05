import { notFound } from "next/navigation";
import { DashboardWizard } from "@/components/admin/dashboard-wizard";
import { PageHeader } from "@/components/ui/page-header";
import { bigQueryConfigured } from "@/lib/bigquery";
import { listMockFiles, peekMockFields } from "@/lib/mocks";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ slug: string }> };

export default async function NewDashboardPage({ params }: Props) {
  const { slug } = await params;
  const client = await prisma.client.findUnique({ where: { slug } });
  if (!client) notFound();

  const mockFiles = await listMockFiles();
  const fieldMap: Record<string, { metrics: string[]; dimensions: string[] }> =
    {};
  for (const file of mockFiles) {
    fieldMap[file] = await peekMockFields(file);
  }

  return (
    <div>
      <PageHeader
        title="Novo dashboard"
        description="Informe os dados, escolha a fonte e monte os widgets."
        breadcrumbs={[
          { href: "/admin/clients", label: "Clientes" },
          { href: `/admin/clients/${client.slug}`, label: client.name },
          { label: "Novo dashboard" },
        ]}
      />
      <DashboardWizard
        clientId={client.id}
        clientSlug={client.slug}
        clientName={client.name}
        mockFiles={mockFiles}
        fieldMap={fieldMap}
        bigQueryReady={bigQueryConfigured()}
      />
    </div>
  );
}
