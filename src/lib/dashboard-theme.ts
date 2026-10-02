export type DashboardTheme = {
  background: string;
  card: string;
  text: string;
  muted: string;
  palette: string[];
  canvasWidth: number;
};

export const CANVAS_WIDTH = 1200;

export const BLACKBEANS_THEME: DashboardTheme = {
  background: "#141312",
  card: "#1C1B1A",
  text: "#F4F0ED",
  muted: "#B1B0B1",
  palette: ["#DA9330", "#F4F0ED", "#C9A06A", "#8B6914", "#B1B0B1", "#5C5B5C"],
  canvasWidth: CANVAS_WIDTH,
};

export const LIGHT_THEME: DashboardTheme = {
  background: "#F4F0ED",
  card: "#FFFFFF",
  text: "#141312",
  muted: "#5C5B5C",
  palette: ["#DA9330", "#141312", "#8B6914", "#5C5B5C", "#B1B0B1", "#C9A06A"],
  canvasWidth: CANVAS_WIDTH,
};

export function isHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

function cleanColor(value: unknown, fallback: string): string {
  if (typeof value === "string" && isHexColor(value)) return value.toUpperCase();
  return fallback;
}

function cleanPalette(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const colors = value
    .filter((item): item is string => typeof item === "string" && isHexColor(item))
    .map((item) => item.toUpperCase())
    .slice(0, 6);
  if (!colors.length) return fallback;
  const next = [...colors];
  while (next.length < fallback.length && next.length < 6) {
    next.push(fallback[next.length] || fallback[0]);
  }
  return next;
}

export function sanitizeTheme(input: unknown): DashboardTheme {
  const src =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  const width = Number(src.canvasWidth);
  return {
    background: cleanColor(src.background, BLACKBEANS_THEME.background),
    card: cleanColor(src.card, BLACKBEANS_THEME.card),
    text: cleanColor(src.text, BLACKBEANS_THEME.text),
    muted: cleanColor(src.muted, BLACKBEANS_THEME.muted),
    palette: cleanPalette(src.palette, BLACKBEANS_THEME.palette),
    canvasWidth:
      Number.isFinite(width) && width >= 800 && width <= 1600
        ? Math.round(width)
        : CANVAS_WIDTH,
  };
}

export function parseTheme(raw: string | null | undefined): DashboardTheme {
  try {
    return sanitizeTheme(raw ? JSON.parse(raw) : {});
  } catch {
    return sanitizeTheme({});
  }
}
