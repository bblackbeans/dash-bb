import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { BUILTIN_TEMPLATES } from "../src/lib/dashboard-templates";

const prisma = new PrismaClient();

async function main() {
  await prisma.widget.deleteMany();
  await prisma.dashboard.deleteMany();
  await prisma.dashboardTemplate.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("blackbeans123", 10);
  const executive = BUILTIN_TEMPLATES[0];

  const admin = await prisma.user.create({
    data: {
      email: "admin@blackbeans.com.br",
      name: "Admin BlackBeans",
      passwordHash,
    },
  });

  const client = await prisma.client.create({
    data: {
      name: "Johnson & Johnson",
      slug: "johnson",
      createdById: admin.id,
    },
  });

  const dashboard = await prisma.dashboard.create({
    data: {
      clientId: client.id,
      title: "Campanhas, leads e CRM",
      slug: "trafego",
      description: "Demo no modelo Executivo BlackBeans: campanha, UTM, lead e CRM.",
      dataSource: "mock",
      isPublic: true,
      mockPath: "marketing-funnel.json",
      themeJson: JSON.stringify(executive.theme),
      widgets: {
        create: executive.widgets.map((widget, index) => ({
          type: widget.type,
          title: widget.title,
          sortOrder: index,
          configJson: JSON.stringify(widget.config),
        })),
      },
    },
  });

  console.log("Seed OK:", {
    admin: admin.email,
    password: "blackbeans123",
    client: client.slug,
    dashboard: dashboard.slug,
    template: executive.name,
    publicUrl: `/p/${client.slug}/${dashboard.slug}`,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
