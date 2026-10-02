import {
  BLACKBEANS_THEME,
  LIGHT_THEME,
  sanitizeTheme,
  type DashboardTheme,
} from "./dashboard-theme";
import {
  isWidgetType,
  sanitizeWidgetConfig,
  type WidgetConfig,
  type WidgetFrame,
  type WidgetType,
} from "./widget-config";

export type TemplateWidget = {
  type: WidgetType;
  title: string;
  config: WidgetConfig;
};

export type DashboardTemplateDTO = {
  id: string;
  name: string;
  description: string;
  builtin: boolean;
  theme: DashboardTheme;
  widgets: TemplateWidget[];
};

const COL = 276;
const GAP = 16;
const HALF = 568;

function frame(x: number, y: number, w: number, h: number): WidgetFrame {
  return { x, y, w, h };
}

function kpi(
  title: string,
  metric: string,
  index: number,
  format?: "currency"
): TemplateWidget {
  return {
    type: "kpi",
    title,
    config: {
      metric,
      format,
      colSpan: 1,
      frame: frame(24 + index * (COL + GAP), 24, COL, 148),
    },
  };
}

function halfBlock(
  type: WidgetType,
  title: string,
  side: 0 | 1,
  y: number,
  config: WidgetConfig
): TemplateWidget {
  return {
    type,
    title,
    config: {
      ...config,
      colSpan: 2,
      frame: frame(side === 0 ? 24 : 24 + HALF + GAP, y, HALF, 340),
    },
  };
}

export function marketingBoard(): TemplateWidget[] {
  return [
    kpi("Leads", "leads", 0),
    kpi("Investimento", "spend", 1, "currency"),
    kpi("Qualificados", "qualified", 2),
    {
      type: "rate",
      title: "Taxa de qualificação",
      config: {
        numerator: "qualified",
        denominator: "leads",
        colSpan: 1,
        frame: frame(24 + 3 * (COL + GAP), 24, COL, 148),
      },
    },
    halfBlock("funnel", "Funil de conversão", 0, 188, {
      stages: ["clicks", "leads", "qualified", "opportunities", "won"],
    }),
    halfBlock("line", "Leads por dia", 1, 188, {
      metric: "leads",
      dimension: "date",
    }),
    halfBlock("pie", "Origem dos leads (UTM)", 0, 544, {
      metric: "leads",
      dimension: "utmSource",
    }),
    halfBlock("bar", "Leads por faixa etária", 1, 544, {
      metric: "leads",
      dimension: "ageRange",
    }),
  ];
}

function shiftY(widgets: TemplateWidget[], dy: number): TemplateWidget[] {
  return widgets.map((widget) => ({
    ...widget,
    config: {
      ...widget.config,
      frame: widget.config.frame
        ? { ...widget.config.frame, y: widget.config.frame.y + dy }
        : widget.config.frame,
    },
  }));
}

export const BUILTIN_TEMPLATES: DashboardTemplateDTO[] = [
  {
    id: "builtin:executive",
    name: "Executivo BlackBeans",
    description: "Fundo escuro, ouro, KPIs, funil e origem dos leads.",
    builtin: true,
    theme: BLACKBEANS_THEME,
    widgets: marketingBoard(),
  },
  {
    id: "builtin:light",
    name: "Relatório claro",
    description: "Fundo cream para apresentar ao cliente.",
    builtin: true,
    theme: LIGHT_THEME,
    widgets: [
      {
        type: "text",
        title: "Abertura",
        config: {
          content: "Resultado das campanhas, da origem do lead ao CRM.",
          fontSize: 28,
          align: "left",
          bold: true,
          colSpan: 4,
          frame: frame(24, 24, 1152, 88),
        },
      },
      ...shiftY(marketingBoard(), 104),
    ],
  },
  {
    id: "builtin:lean",
    name: "Campanha enxuta",
    description: "Quatro números, um funil e a evolução dos leads.",
    builtin: true,
    theme: BLACKBEANS_THEME,
    widgets: marketingBoard().slice(0, 6),
  },
];

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function parseTemplateWidgets(raw: string): TemplateWidget[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const src = item as Record<string, unknown>;
      if (typeof src.type !== "string" || !isWidgetType(src.type)) return [];
      const title =
        typeof src.title === "string" ? src.title.trim().slice(0, 80) : "";
      if (!title) return [];
      return [
        {
          type: src.type,
          title,
          config: sanitizeWidgetConfig(src.type, src.config),
        },
      ];
    });
  } catch {
    return [];
  }
}

export function templateFromRecord(record: {
  id: string;
  name: string;
  description: string | null;
  themeJson: string;
  widgetsJson: string;
}): DashboardTemplateDTO {
  return {
    id: record.id,
    name: record.name,
    description: record.description || "",
    builtin: false,
    theme: sanitizeTheme(safeJson(record.themeJson)),
    widgets: parseTemplateWidgets(record.widgetsJson),
  };
}
