import { isHexColor } from "./dashboard-theme";

export const WIDGET_TYPES = [
  "kpi",
  "line",
  "bar",
  "pie",
  "table",
  "funnel",
  "rate",
  "text",
  "image",
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];
export type ColSpan = 1 | 2 | 4;
export type TextAlign = "left" | "center" | "right";

export type WidgetFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type WidgetStyle = {
  palette?: string[];
  card?: string;
  titleColor?: string;
};

export type WidgetConfig = {
  colSpan?: ColSpan;
  metric?: string;
  dimension?: string;
  format?: "currency";
  columns?: string[];
  stages?: string[];
  numerator?: string;
  denominator?: string;
  frame?: WidgetFrame;
  style?: WidgetStyle;
  content?: string;
  fontSize?: number;
  align?: TextAlign;
  bold?: boolean;
  src?: string;
};

const FIELD_LABELS: Record<string, string> = {
  date: "Data",
  campaign: "Campanha",
  utmSource: "Origem (UTM)",
  utmMedium: "Mídia (UTM)",
  utmCampaign: "Campanha UTM",
  utmContent: "Conteúdo UTM",
  adset: "Conjunto de anúncios",
  ageRange: "Faixa etária",
  leads: "Leads",
  qualified: "Qualificados",
  opportunities: "Oportunidades",
  won: "Ganhos",
  spend: "Investimento",
  revenue: "Receita",
  clicks: "Cliques",
  impressions: "Impressões",
  sessions: "Sessões",
  users: "Usuários",
  conversions: "Conversões",
  page: "Página",
  source: "Origem",
  medium: "Mídia",
  device: "Dispositivo",
};

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] || key;
}

export function isWidgetType(value: string): value is WidgetType {
  return (WIDGET_TYPES as readonly string[]).includes(value);
}

export function defaultColSpan(type: string): ColSpan {
  if (type === "table" || type === "text") return 4;
  if (type === "kpi" || type === "rate") return 1;
  return 2;
}

export function colSpanClass(span: ColSpan): string {
  if (span === 4) return "col-span-1 md:col-span-2 xl:col-span-4";
  if (span === 2) return "col-span-1 md:col-span-2 xl:col-span-2";
  return "col-span-1";
}

function cleanKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return undefined;
  return key.slice(0, 40);
}

function cleanKeys(value: unknown, limit: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const keys = value
    .map((item) => cleanKey(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, limit);
  return keys.length ? keys : undefined;
}

function cleanColor(value: unknown): string | undefined {
  if (typeof value !== "string" || !isHexColor(value)) return undefined;
  return value.toUpperCase();
}

function cleanPalette(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const colors = value
    .map((item) => cleanColor(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 6);
  return colors.length ? colors : undefined;
}

function cleanFrame(value: unknown): WidgetFrame | undefined {
  if (!value || typeof value !== "object") return undefined;
  const src = value as Record<string, unknown>;
  const nums = ["x", "y", "w", "h"].map((key) => Number(src[key]));
  if (nums.some((num) => !Number.isFinite(num))) return undefined;
  const [x, y, w, h] = nums;
  return {
    x: Math.round(Math.min(4000, Math.max(0, x))),
    y: Math.round(Math.min(8000, Math.max(0, y))),
    w: Math.round(Math.min(4000, Math.max(80, w))),
    h: Math.round(Math.min(2000, Math.max(48, h))),
  };
}

function cleanStyle(value: unknown): WidgetStyle | undefined {
  if (!value || typeof value !== "object") return undefined;
  const src = value as Record<string, unknown>;
  const style: WidgetStyle = {};
  const palette = cleanPalette(src.palette);
  const card = cleanColor(src.card);
  const titleColor = cleanColor(src.titleColor);
  if (palette) style.palette = palette;
  if (card) style.card = card;
  if (titleColor) style.titleColor = titleColor;
  return Object.keys(style).length ? style : undefined;
}

function cleanSrc(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!/^\/uploads\/[A-Za-z0-9._-]+$/.test(value)) return undefined;
  return value;
}

export function parseWidgetConfig(raw: string): WidgetConfig {
  try {
    const parsed = JSON.parse(raw || "{}") as Record<string, unknown>;
    const config = sanitizeWidgetConfig("kpi", parsed);
    if (parsed.colSpan !== 1 && parsed.colSpan !== 2 && parsed.colSpan !== 4) {
      delete config.colSpan;
    }
    if (!parsed.frame) delete config.frame;
    return config;
  } catch {
    return {};
  }
}

export function resolveColSpan(type: string, config: WidgetConfig): ColSpan {
  if (config.colSpan === 1 || config.colSpan === 2 || config.colSpan === 4) {
    return config.colSpan;
  }
  return defaultColSpan(type);
}

export function sanitizeWidgetConfig(type: string, input: unknown): WidgetConfig {
  const src =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  const colSpan =
    src.colSpan === 1 || src.colSpan === 2 || src.colSpan === 4
      ? src.colSpan
      : defaultColSpan(type);
  const format = src.format === "currency" ? "currency" : undefined;
  const fontSize = Number(src.fontSize);
  const align =
    src.align === "center" || src.align === "right" || src.align === "left"
      ? src.align
      : undefined;
  const content =
    typeof src.content === "string"
      ? src.content.replace(/\u0000/g, "").slice(0, 800)
      : undefined;

  return {
    colSpan,
    metric: cleanKey(src.metric),
    dimension: cleanKey(src.dimension),
    format,
    columns: cleanKeys(src.columns, 20),
    stages: cleanKeys(src.stages, 8),
    numerator: cleanKey(src.numerator),
    denominator: cleanKey(src.denominator),
    frame: cleanFrame(src.frame),
    style: cleanStyle(src.style),
    content,
    fontSize:
      Number.isFinite(fontSize) && fontSize >= 12 && fontSize <= 96
        ? Math.round(fontSize)
        : undefined,
    align,
    bold: src.bold === true ? true : undefined,
    src: cleanSrc(src.src),
  };
}
