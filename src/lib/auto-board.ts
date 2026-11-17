// Monta o painel inicial de uma view de anúncios (Meta, LinkedIn, Google Ads) a partir das
// métricas que têm valor de verdade. Serve de ponto de partida; dá para ajustar no "Montar dashboard".

export type BoardWidget = {
  type: "kpi" | "line" | "bar" | "table" | "funnel";
  title: string;
  metric?: string;
  dimension?: string;
  format?: "currency";
  colSpan?: 1 | 2 | 4;
  columns?: string[];
  columnLabels?: Record<string, string>;
  groupBy?: string;
  stages?: string[];
};

type Input = {
  platform: string;
  active: string[];
  dimensions: string[];
};

const LEVEL_LABELS: Record<string, string> = {
  campaign_name: "Campanha",
  adset_name: "Conjunto de anúncios",
  ad_name: "Anúncio",
  creative_name: "Anúncio",
  campaign_group_name: "Campanha",
};

export function buildAdBoard({ platform, active, dimensions }: Input): BoardWidget[] {
  const has = (key: string) => active.includes(key);
  const hasDim = (key: string) => dimensions.includes(key);
  const linkedin = platform === "linkedin";

  const videoKey = has("thruplays") ? "thruplays" : has("video_views") ? "video_views" : null;
  const conversion = has("leads") ? "leads" : has("whatsapp") ? "whatsapp" : null;
  // Campanha de vídeo quando o resultado principal é vídeo e não há leads nem conversas.
  const video = Boolean(videoKey) && !conversion;
  const result = video ? videoKey : conversion;

  const costOfResult =
    result === "thruplays"
      ? "cost_per_thruplay"
      : result === "video_views" && linkedin
        ? "cost_per_video_view"
        : result === "leads"
          ? "cpl"
          : result === "whatsapp"
            ? "cpl_whatsapp"
            : null;

  const board: BoardWidget[] = [];
  const kpi = (title: string, metric: string, format?: "currency") =>
    board.push({ type: "kpi", title, metric, format, colSpan: 1 });

  // KPIs: no máximo seis, só os que têm valor.
  const kpis: [string, string, "currency"?][] = [];
  if (has("spend")) kpis.push(["Investimento", "spend", "currency"]);
  if (has("impressions")) kpis.push(["Impressões", "impressions"]);
  if (result) kpis.push([labelOf(result), result]);
  if (costOfResult) kpis.push([labelOf(costOfResult), costOfResult, "currency"]);
  if (has("clicks")) kpis.push(["Cliques", "clicks"]);
  if (has("ctr")) kpis.push(["CTR (%)", "ctr"]);
  for (const [title, metric, format] of kpis.slice(0, 6)) kpi(title, metric, format);

  // Funil: do alcance do anúncio até o resultado.
  const stages = video
    ? linkedin
      ? ["impressions", "video_views", "video_views_25", "video_views_50", "video_views_75"]
      : ["impressions", "video_views", "video_views_25", "video_views_50", "video_views_75", "video_views_100"]
    : ["impressions", "clicks", ...(result ? [result] : [])];
  const funnel = stages.filter((stage) => has(stage));
  if (funnel.length >= 3) {
    board.push({ type: "funnel", title: video ? "Funil de vídeo" : "Funil de conversão", stages: funnel, colSpan: 2 });
  }

  if (hasDim("date") && has("spend")) {
    board.push({ type: "line", title: "Investimento por dia", metric: "spend", dimension: "date", format: "currency", colSpan: 2 });
  }
  if (hasDim("date") && result) {
    board.push({ type: "line", title: `${labelOf(result)} por dia`, metric: result, dimension: "date", colSpan: 2 });
  }

  const middle = hasDim("adset_name") ? "adset_name" : hasDim("campaign_name") ? "campaign_name" : null;
  if (middle && has("spend")) {
    board.push({
      type: "bar",
      title: `Investimento por ${middle === "adset_name" ? "conjunto de anúncios" : linkedin ? "conjunto de anúncios" : "campanha"}`,
      metric: "spend",
      dimension: middle,
      format: "currency",
      colSpan: 2,
    });
  }

  const columnsFor = (first: string, extra: string[] = []) => {
    const columns = [first, ...extra, ...["impressions", "clicks"].filter(has), ...(result ? [result] : []), ...(costOfResult ? [costOfResult] : []), ...(has("spend") ? ["spend"] : [])];
    return [...new Set(columns)];
  };
  const labels = (columns: string[]): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const column of columns) {
      if (LEVEL_LABELS[column]) out[column] = LEVEL_LABELS[column];
    }
    // No LinkedIn a campanha faz o papel do conjunto de anúncios.
    if (linkedin && out.campaign_name) out.campaign_name = "Conjunto de anúncios";
    return out;
  };
  const table = (title: string, groupBy: string, extra: string[] = []) => {
    const columns = columnsFor(groupBy, extra);
    board.push({ type: "table", title, groupBy, columns, columnLabels: labels(columns), colSpan: 4 });
  };

  if (hasDim("adset_name")) table("Por conjunto de anúncios", "adset_name");
  else if (hasDim("campaign_name")) table(linkedin ? "Por conjunto de anúncios" : "Por campanha", "campaign_name");
  if (hasDim("ad_name")) table("Por anúncio", "ad_name");

  return board;
}

function labelOf(key: string): string {
  const map: Record<string, string> = {
    thruplays: "ThruPlays",
    video_views: "Visualizações de vídeo",
    leads: "Leads",
    whatsapp: "Conversas no WhatsApp",
    cost_per_thruplay: "Custo por ThruPlay",
    cost_per_video_view: "CPV (Custo por Video View)",
    cpl: "CPL (leads)",
    cpl_whatsapp: "CPL (WhatsApp)",
  };
  return map[key] || key;
}
