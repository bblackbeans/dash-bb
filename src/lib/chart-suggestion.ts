export type ChartSuggestion = {
  type: string;
  metric: string;
  dimension: string;
  columns?: string[];
  hint: string;
};

const RATE_METRIC = /frequency|ctr|cpc|cpm|cpp|rate|roas|cost_per|percent/i;
export const MONEY_METRIC = /spend|cost|amount|budget|revenue|action_values_value|^cpm$|^cpc$|^cpp$/i;

export function pickMetric(metrics: string[]): string {
  const usable = metrics.filter((metric) => !RATE_METRIC.test(metric));
  const preferred = [
    "impressions",
    "metrics_impressions",
    "spend",
    "metrics_cost",
    "clicks",
    "metrics_clicks",
    "reach",
    "reactions",
    "actions_value",
    "action_values_value",
    "totalbudget_amount",
  ];
  for (const name of preferred) {
    if (usable.includes(name)) return name;
  }
  const volume = usable.find((metric) =>
    /impressions|clicks|spend|reach|reactions|conversions|sessions|revenue|amount|cost|value|leads/i.test(metric)
  );
  return volume || usable[0] || metrics[0] || "";
}

export function pickDate(dimensions: string[]): string {
  return (
    dimensions.find((dimension) => /^(date|metric_date|day)$/i.test(dimension) || /date/i.test(dimension)) ||
    ""
  );
}

export function pickCategory(dimensions: string[]): string {
  return (
    dimensions.find((dimension) => /actions_action_type|action_values_action_type/i.test(dimension)) ||
    dimensions.find((dimension) => /searchterm/i.test(dimension)) ||
    dimensions.find((dimension) => /keyword/i.test(dimension) && !/date/i.test(dimension)) ||
    dimensions.find((dimension) => /_name$/i.test(dimension) && !/url|thumbnail|currency/i.test(dimension)) ||
    ""
  );
}

export function tableColumns(metrics: string[], dimensions: string[]): string[] {
  const picked = [
    pickDate(dimensions),
    ...dimensions.filter((dimension) => /action_type|search_term|keyword|_name$|status/i.test(dimension)).slice(0, 4),
    ...metrics.filter((metric) => !RATE_METRIC.test(metric)).slice(0, 3),
  ].filter(Boolean);
  const unique = [...new Set(picked)];
  if (unique.length) return unique.slice(0, 8);
  return [...dimensions, ...metrics].slice(0, 8);
}

export function suggestChart(view: string, metrics: string[], dimensions: string[]): ChartSuggestion {
  const metric = pickMetric(metrics);
  const date = pickDate(dimensions);
  const category = pickCategory(dimensions);
  const catalog = /_details$/.test(view) || (metrics.length <= 3 && dimensions.length >= 8 && !date);
  if (!metrics.length || catalog) {
    return {
      type: "table",
      metric: "",
      dimension: "",
      columns: tableColumns(metrics, dimensions),
      hint: "Cadastro com várias colunas. A tabela mostra o registro em vez de somar um número.",
    };
  }
  const breakdown = dimensions.find((dimension) =>
    /actions_action_type|action_values_action_type|searchterm/i.test(dimension)
  );
  if ((/action_values|_actions$|search_terms/i.test(view) || breakdown) && (breakdown || category)) {
    return {
      type: "bar",
      metric,
      dimension: breakdown || category,
      hint: "Os valores estão quebrados por categoria. Barras comparam um grupo com o outro.",
    };
  }
  if (date) {
    return {
      type: "line",
      metric,
      dimension: date,
      hint: "Existe coluna de data. A linha mostra como a métrica anda ao longo do tempo.",
    };
  }
  if (category) {
    return {
      type: "bar",
      metric,
      dimension: category,
      hint: "Dá para agrupar por nome ou tipo. Barras comparam essas categorias.",
    };
  }
  return {
    type: "kpi",
    metric,
    dimension: "",
    hint: "A view entrega um volume que faz sentido somar. O KPI mostra esse total.",
  };
}
