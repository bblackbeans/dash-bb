"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";
import { authOptions } from "@/lib/auth";
import {
  bigQueryConfigured,
  bigQueryLocation,
  bigQueryProjectId,
  describeBigQueryTable,
  listBigQueryDatasets,
  listBigQueryTables,
  testBigQueryConnection,
} from "@/lib/bigquery";
import { sanitizeTheme, type DashboardTheme } from "@/lib/dashboard-theme";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import {
  defaultColSpan,
  isWidgetType,
  sanitizeWidgetConfig,
  type WidgetConfig,
} from "@/lib/widget-config";

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Não autenticado");
  return session;
}

function peekFieldsFromRows(rows: Record<string, string | number>[]) {
  const sample = rows[0] || {};
  const metrics: string[] = [];
  const dimensions: string[] = [];
  for (const [key, value] of Object.entries(sample)) {
    if (typeof value === "number") metrics.push(key);
    else dimensions.push(key);
  }
  return { metrics, dimensions };
}

export async function uploadMockJsonAction(formData: FormData): Promise<
  | { ok: true; filename: string; metrics: string[]; dimensions: string[] }
  | { ok: false; error: string }
> {
  await requireSession();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Selecione um arquivo JSON." };
  }
  if (!file.name.toLowerCase().endsWith(".json")) {
    return { ok: false, error: "O arquivo precisa ser .json" };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: "Arquivo muito grande (máx. 5MB)." };
  }

  let parsed: unknown;
  try {
    const text = await file.text();
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "JSON inválido." };
  }

  if (!Array.isArray(parsed) || !parsed.length) {
    return { ok: false, error: "O JSON deve ser um array de objetos não vazio." };
  }
  if (typeof parsed[0] !== "object" || parsed[0] === null) {
    return { ok: false, error: "Cada item do array deve ser um objeto." };
  }

  const base = slugify(file.name.replace(/\.json$/i, "")) || "upload";
  const filename = `${base}-${Date.now()}.json`;
  const dir = path.join(process.cwd(), "data", "mocks");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, filename),
    JSON.stringify(parsed, null, 2),
    "utf8"
  );

  const fields = peekFieldsFromRows(
    parsed as Record<string, string | number>[]
  );
  return { ok: true, filename, ...fields };
}

export async function createClientAction(formData: FormData): Promise<void> {
  await requireSession();
  const name = String(formData.get("name") || "").trim();
  const slugInput = String(formData.get("slug") || "").trim();
  const slug = slugify(slugInput || name);
  if (!name || !slug) return;

  try {
    await prisma.client.create({ data: { name, slug } });
    revalidatePath("/admin/clients");
  } catch {
    // slug duplicado
  }
}

export async function updateClientAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const slug = slugify(String(formData.get("slug") || ""));
  if (!id || !name || !slug) return;

  try {
    await prisma.client.update({ where: { id }, data: { name, slug } });
    revalidatePath("/admin/clients");
    revalidatePath(`/admin/clients/${slug}`);
  } catch {
    // slug duplicado
  }
}

export async function deleteClientAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") || "");
  await prisma.client.delete({ where: { id } });
  revalidatePath("/admin/clients");
}

export type WidgetInput = {
  type: string;
  title: string;
  metric?: string;
  dimension?: string;
  format?: string;
  columns?: string[];
  pageId?: string;
  view?: string;
};

export type DashboardPageInput = {
  id: string;
  title: string;
  views: string[];
};

export async function createDashboardFromWizard(input: {
  clientId: string;
  clientSlug: string;
  title: string;
  slug: string;
  description?: string;
  dataSource: string;
  mockPath: string;
  dataset?: string;
  table?: string;
  pages?: DashboardPageInput[];
  widgets: WidgetInput[];
}): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  await requireSession();
  const title = input.title.trim();
  const slug = slugify(input.slug || title);
  if (!input.clientId || !title || !slug) {
    return { ok: false, error: "Dados inválidos" };
  }

  const useBigQuery = input.dataSource === "bigquery";
  const dataset = input.dataset?.trim() || "";
  const pages = (input.pages || []).filter((page) => page.title.trim() && page.views.length);
  const table = input.table?.trim() || pages[0]?.views[0] || "";
  if (useBigQuery && (!dataset || !pages.length)) {
    return { ok: false, error: "Escolha o dataset e ao menos uma view em cada página." };
  }
  if (useBigQuery && !bigQueryConfigured()) {
    return { ok: false, error: "A chave do BigQuery não está configurada." };
  }

  const dataSource = useBigQuery ? "bigquery" : "mock";
  const mockPath = input.mockPath || "johnson-traffic.json";

  const widgets = (input.widgets.length
    ? input.widgets
    : [
        { type: "kpi", title: "Sessões", metric: "sessions" },
        { type: "line", title: "Tendência", metric: "sessions", dimension: "date" },
      ]
  ).map((w, i) => ({
    type: w.type,
    title: w.title,
    sortOrder: i,
    configJson: JSON.stringify(
        w.type === "table"
        ? {
            colSpan: defaultColSpan(w.type),
            columns:
              w.columns ||
              [
                "date",
                "page",
                "source",
                "device",
                "sessions",
                "users",
                "conversions",
                "revenue",
              ],
            pageId: w.pageId,
            view: w.view,
          }
        : {
            colSpan: defaultColSpan(w.type),
            metric: w.metric || "sessions",
            dimension: w.dimension,
            format: w.format,
            pageId: w.pageId,
            view: w.view,
          }
    ),
  }));

  try {
    const dashboard = await prisma.dashboard.create({
      data: {
        clientId: input.clientId,
        title,
        slug,
        description: input.description?.trim() || null,
        dataSource,
        mockPath,
        sourceJson: useBigQuery
          ? JSON.stringify({
              dataset,
              table,
              location: bigQueryLocation(),
              pages,
            })
          : "{}",
        widgets: { create: widgets },
      },
    });

    revalidatePath(`/admin/clients/${input.clientSlug}`);
    return { ok: true, slug: dashboard.slug };
  } catch {
    return { ok: false, error: "Não foi possível criar. O slug já existe?" };
  }
}

/** @deprecated use wizard — kept for compatibility */
export async function createDashboardAction(formData: FormData): Promise<void> {
  await requireSession();
  const clientId = String(formData.get("clientId") || "");
  const clientSlug = String(formData.get("clientSlug") || "");
  const title = String(formData.get("title") || "").trim();
  const slug = slugify(String(formData.get("slug") || title));
  const mockPath = String(formData.get("mockPath") || "johnson-traffic.json");
  if (!clientId || !title || !slug) return;

  await createDashboardFromWizard({
    clientId,
    clientSlug,
    title,
    slug,
    dataSource: "mock",
    mockPath,
    widgets: [
      { type: "kpi", title: "Sessões", metric: "sessions" },
      { type: "line", title: "Tendência", metric: "sessions", dimension: "date" },
      { type: "bar", title: "Por página", metric: "sessions", dimension: "page" },
    ],
  });
}

export async function deleteDashboardAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") || "");
  const clientSlug = String(formData.get("clientSlug") || "");
  await prisma.dashboard.delete({ where: { id } });
  revalidatePath(`/admin/clients/${clientSlug}`);
}

export async function togglePublicAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("id") || "");
  const isPublic = formData.get("isPublic") === "true";
  const clientSlug = String(formData.get("clientSlug") || "");
  const dashSlug = String(formData.get("dashSlug") || "");
  await prisma.dashboard.update({ where: { id }, data: { isPublic } });
  revalidatePath(`/admin/clients/${clientSlug}/dashboards/${dashSlug}`);
  revalidatePath(`/p/${clientSlug}/${dashSlug}`);
}

export type LayoutWidgetInput = {
  type: string;
  title: string;
  config: WidgetConfig;
};

export async function saveDashboardLayoutAction(input: {
  dashboardId: string;
  clientSlug: string;
  dashSlug: string;
  theme: DashboardTheme;
  widgets: LayoutWidgetInput[];
}): Promise<
  | {
      ok: true;
      widgets: {
        id: string;
        type: string;
        title: string;
        configJson: string;
        sortOrder: number;
      }[];
    }
  | { ok: false; error: string }
> {
  await requireSession();
  if (!input.dashboardId || !input.clientSlug || !input.dashSlug) {
    return { ok: false, error: "Dashboard inválido." };
  }
  if (!input.widgets.length) {
    return { ok: false, error: "O dashboard precisa de ao menos um bloco." };
  }
  if (input.widgets.length > 40) {
    return { ok: false, error: "Limite de 40 blocos por dashboard." };
  }

  const dashboard = await prisma.dashboard.findFirst({
    where: {
      id: input.dashboardId,
      slug: input.dashSlug,
      client: { slug: input.clientSlug },
    },
  });
  if (!dashboard) return { ok: false, error: "Dashboard não encontrado." };

  let data: {
    dashboardId: string;
    type: string;
    title: string;
    sortOrder: number;
    configJson: string;
  }[];
  try {
    data = input.widgets.map((widget, index) => {
      if (!isWidgetType(widget.type)) {
        throw new Error("Tipo de bloco inválido.");
      }
      const title = widget.title.trim().slice(0, 80);
      if (!title) throw new Error("Todo bloco precisa de um título.");
      return {
        dashboardId: dashboard.id,
        type: widget.type,
        title,
        sortOrder: index,
        configJson: JSON.stringify(
          sanitizeWidgetConfig(widget.type, widget.config)
        ),
      };
    });
    await prisma.$transaction([
      prisma.dashboard.update({
        where: { id: dashboard.id },
        data: { themeJson: JSON.stringify(sanitizeTheme(input.theme)) },
      }),
      prisma.widget.deleteMany({ where: { dashboardId: dashboard.id } }),
      prisma.widget.createMany({ data }),
    ]);
  } catch (error) {
    const message =
      error instanceof Error && error.message.startsWith("Tipo")
        ? error.message
        : error instanceof Error && error.message.startsWith("Todo")
          ? error.message
          : "Não foi possível salvar o layout.";
    return { ok: false, error: message };
  }

  const widgets = await prisma.widget.findMany({
    where: { dashboardId: dashboard.id },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      type: true,
      title: true,
      configJson: true,
      sortOrder: true,
    },
  });

  revalidatePath(`/admin/clients/${input.clientSlug}/dashboards/${input.dashSlug}`);
  revalidatePath(`/p/${input.clientSlug}/${input.dashSlug}`);
  return { ok: true, widgets };
}

export async function uploadDashboardImageAction(formData: FormData): Promise<
  { ok: true; src: string } | { ok: false; error: string }
> {
  await requireSession();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Selecione uma imagem." };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "A imagem pode ter no máximo 2MB." };
  const extensions: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const ext = extensions[file.type];
  if (!ext) return { ok: false, error: "Use PNG, JPG, WEBP ou GIF." };
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  return { ok: true, src: `/uploads/${filename}` };
}

export async function saveDashboardTemplateAction(input: {
  name: string;
  description?: string;
  theme: DashboardTheme;
  widgets: LayoutWidgetInput[];
}): Promise<
  | { ok: true; id: string; name: string }
  | { ok: false; error: string }
> {
  await requireSession();
  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: "Dê um nome ao modelo." };
  if (!input.widgets.length) return { ok: false, error: "O modelo precisa de blocos." };

  try {
    const widgets = input.widgets.map((widget) => {
      if (!isWidgetType(widget.type)) throw new Error("Tipo de bloco inválido.");
      const title = widget.title.trim().slice(0, 80);
      if (!title) throw new Error("Todo bloco precisa de um título.");
      return {
        type: widget.type,
        title,
        config: sanitizeWidgetConfig(widget.type, widget.config),
      };
    });
    const template = await prisma.dashboardTemplate.create({
      data: {
        name,
        description: input.description?.trim().slice(0, 180) || null,
        themeJson: JSON.stringify(sanitizeTheme(input.theme)),
        widgetsJson: JSON.stringify(widgets),
      },
    });
    revalidatePath("/admin");
    revalidatePath("/admin/clients");
    return { ok: true, id: template.id, name: template.name };
  } catch (error) {
    const message =
      error instanceof Error && error.message.startsWith("Tipo")
        ? error.message
        : error instanceof Error && error.message.startsWith("Todo")
          ? error.message
          : "Não foi possível salvar o modelo.";
    return { ok: false, error: message };
  }
}

export async function updateDashboardTemplateAction(input: {
  id: string;
  name: string;
  description?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSession();
  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: "Dê um nome ao modelo." };
  const existing = await prisma.dashboardTemplate.findUnique({ where: { id: input.id } });
  if (!existing) return { ok: false, error: "Modelo não encontrado." };
  await prisma.dashboardTemplate.update({
    where: { id: input.id },
    data: {
      name,
      description: input.description?.trim().slice(0, 180) || null,
    },
  });
  revalidatePath("/admin");
  return { ok: true };
}

export async function bigQueryStatusAction(): Promise<
  | { ok: true; projectId: string; configured: true }
  | { ok: false; projectId: string; configured: boolean; error: string }
> {
  await requireSession();
  const projectId = bigQueryProjectId();
  if (!bigQueryConfigured()) {
    return {
      ok: false,
      projectId,
      configured: false,
      error: "Coloque a chave JSON em secrets/bigquery-service-account.json.",
    };
  }
  const result = await testBigQueryConnection();
  if (!result.ok) return { ok: false, projectId, configured: true, error: result.error };
  return { ok: true, projectId, configured: true };
}

export async function listBigQueryDatasetsAction(): Promise<
  { ok: true; datasets: string[] } | { ok: false; error: string }
> {
  await requireSession();
  try {
    return { ok: true, datasets: await listBigQueryDatasets() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Não foi possível listar os datasets." };
  }
}

export async function describeBigQueryTableAction(
  dataset: string,
  table: string
): Promise<
  { ok: true; metrics: string[]; dimensions: string[] } | { ok: false; error: string }
> {
  await requireSession();
  try {
    return { ok: true, ...(await describeBigQueryTable(dataset, table)) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível ler as colunas da view.",
    };
  }
}

export async function listBigQueryTablesAction(dataset: string): Promise<
  { ok: true; tables: { id: string; type: string }[] } | { ok: false; error: string }
> {
  await requireSession();
  try {
    return { ok: true, tables: await listBigQueryTables(dataset) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Não foi possível listar as views." };
  }
}

export async function saveBigQuerySourceAction(input: {
  dashboardId: string;
  clientSlug: string;
  dashSlug: string;
  dataset: string;
  table: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSession();
  const dataset = input.dataset.trim();
  const table = input.table.trim();
  if (!dataset || !table) return { ok: false, error: "Escolha o dataset e a view." };
  const dashboard = await prisma.dashboard.findUnique({ where: { id: input.dashboardId } });
  if (!dashboard) return { ok: false, error: "Dashboard não encontrado." };
  await prisma.dashboard.update({
    where: { id: dashboard.id },
    data: {
      dataSource: "bigquery",
      sourceJson: JSON.stringify({
        dataset,
        table,
        location: process.env.BIGQUERY_LOCATION?.trim() || "US",
      }),
    },
  });
  revalidatePath(`/admin/clients/${input.clientSlug}/dashboards/${input.dashSlug}`);
  revalidatePath(`/p/${input.clientSlug}/${input.dashSlug}`);
  return { ok: true };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createUserAction(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSession();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!name) return { ok: false, error: "Informe o nome." };
  if (!EMAIL.test(email)) return { ok: false, error: "E-mail inválido." };
  if (password.length < 8) {
    return { ok: false, error: "A senha precisa ter pelo menos 8 caracteres." };
  }
  try {
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
  } catch {
    return { ok: false, error: "Já existe um usuário com esse e-mail." };
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function updateUserAction(input: {
  id: string;
  name: string;
  email: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSession();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!input.id || !name) return { ok: false, error: "Informe o nome." };
  if (!EMAIL.test(email)) return { ok: false, error: "E-mail inválido." };
  if (password && password.length < 8) {
    return { ok: false, error: "A senha precisa ter pelo menos 8 caracteres." };
  }
  const existing = await prisma.user.findUnique({ where: { id: input.id } });
  if (!existing) return { ok: false, error: "Usuário não encontrado." };
  try {
    await prisma.user.update({
      where: { id: input.id },
      data: {
        name,
        email,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
    });
  } catch {
    return { ok: false, error: "Já existe um usuário com esse e-mail." };
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteUserAction(input: {
  id: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const currentId = (session.user as { id?: string }).id;
  if (!input.id) return { ok: false, error: "Usuário inválido." };
  if (input.id === currentId) {
    return { ok: false, error: "Você não pode excluir a própria conta." };
  }
  const count = await prisma.user.count();
  if (count <= 1) {
    return { ok: false, error: "Precisa existir pelo menos um usuário." };
  }
  await prisma.user.delete({ where: { id: input.id } });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteDashboardTemplateAction(input: {
  id: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSession();
  const existing = await prisma.dashboardTemplate.findUnique({ where: { id: input.id } });
  if (!existing) return { ok: false, error: "Modelo não encontrado." };
  await prisma.dashboardTemplate.delete({ where: { id: input.id } });
  revalidatePath("/admin");
  return { ok: true };
}
