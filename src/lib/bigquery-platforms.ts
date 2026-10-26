export type SchemaField = { name?: string; type?: string };

type MetricRule = {
  key: string;
  column: string;
  kind: "money" | "count";
  // Quando vem da tabela de ações do Meta: tipo da ação (ex.: "lead").
  action?: string;
};

type PlatformRule = {
  id: "meta" | "linkedin" | "google_ads";
  date: string;
  campaign: string;
  group?: string;
  account: string[];
  metrics: MetricRule[];
};

export type PlatformPlan = {
  platform: PlatformRule["id"];
  dateColumn: string;
  campaignColumn: string;
  groupColumn: string | null;
  accountColumn: string | null;
  metrics: MetricRule[];
  campaignIdColumn: string | null;
  actionsTable: string | null;
  derived: string[];
  sourceColumns: Set<string>;
  extras: { name: string; type: string }[];
};

const RULES: PlatformRule[] = [
  {
    id: "meta",
    date: "metric_date",
    campaign: "campaign_name",
    account: ["account_name", "account_id"],
    metrics: [
      { key: "spend", column: "spend", kind: "money" },
      { key: "impressions", column: "impressions", kind: "count" },
      { key: "clicks", column: "clicks", kind: "count" },
      { key: "link_clicks", column: "inline_link_clicks", kind: "count" },
      { key: "leads", column: "a_lead", kind: "count" },
      {
        key: "whatsapp",
        column: "a_onsite_conversion_messaging_conversation_started_7d",
        kind: "count",
      },
      { key: "landing_page_views", column: "a_landing_page_view", kind: "count" },
      { key: "thruplays", column: "a_video_thruplay_watched_actions_video_view", kind: "count" },
      { key: "video_views", column: "a_video_view", kind: "count" },
    ],
  },
  {
    id: "linkedin",
    date: "metric_date",
    campaign: "campaign_name",
    group: "campaign_group_name",
    account: ["account_name", "account_id"],
    metrics: [
      { key: "spend", column: "costinlocalcurrency", kind: "money" },
      { key: "impressions", column: "impressions", kind: "count" },
      { key: "clicks", column: "clicks", kind: "count" },
      { key: "leads", column: "oneclickleads", kind: "count" },
      { key: "conversions", column: "externalwebsiteconversions", kind: "count" },
      { key: "engagements", column: "totalengagements", kind: "count" },
      { key: "video_views", column: "videoviews", kind: "count" },
      { key: "video_views_25", column: "videofirstquartilecompletions", kind: "count" },
      { key: "video_views_50", column: "videomidpointcompletions", kind: "count" },
      { key: "video_views_75", column: "videothirdquartilecompletions", kind: "count" },
    ],
  },
  {
    id: "google_ads",
    date: "segments_date",
    campaign: "campaign_name",
    account: ["_kdd_account_id"],
    metrics: [
      { key: "spend", column: "metrics_cost", kind: "money" },
      { key: "impressions", column: "metrics_impressions", kind: "count" },
      { key: "clicks", column: "metrics_clicks", kind: "count" },
      { key: "conversions", column: "metrics_conversions", kind: "count" },
    ],
  },
];

const NUMERIC = new Set(["INTEGER", "INT64", "FLOAT", "FLOAT64", "NUMERIC", "BIGNUMERIC", "DECIMAL"]);

// Taxas e contagens que não podem ser somadas entre dias: ficam de fora das métricas extras.
const NOT_ADDITIVE =
  /^(ctr|cpc|cpm|cpp|frequency|reach|averagecpc|approximatememberreach|searchimpressionshare)$|^(cost_per_|estimated_|unique_|metrics_(ctr|averagecpc|searchimpressionshare))|roas|_rate$|^(costinusd|costinlocalcurrency|conversionvalueinlocalcurrency)$/;

export const DERIVED_LABELS: Record<string, string> = {
  ctr: "CTR",
  cpc: "CPC",
  cpm: "CPM",
  cpl: "CPL (leads)",
  cpl_whatsapp: "CPL (WhatsApp)",
};

export function planPlatform(fields: SchemaField[]): PlatformPlan | null {
  const names = new Map<string, string>();
  const types = new Map<string, string>();
  for (const field of fields) {
    if (!field.name) continue;
    names.set(field.name.toLowerCase(), field.name);
    types.set(field.name, String(field.type || "").toUpperCase());
  }

  for (const rule of RULES) {
    const date = names.get(rule.date);
    const campaign = names.get(rule.campaign);
    if (!date || !campaign) continue;
    const metrics = rule.metrics
      .map((metric) => ({ ...metric, column: names.get(metric.column) || "" }))
      .filter((metric) => metric.column);
    const keys = new Set(metrics.map((metric) => metric.key));
    if (!keys.has("spend") || !keys.has("impressions") || !keys.has("clicks")) continue;

    const accountName = rule.account.map((column) => names.get(column)).find(Boolean) || null;
    const derived = ["ctr", "cpc", "cpm"];
    if (keys.has("leads")) derived.push("cpl");
    if (keys.has("whatsapp")) derived.push("cpl_whatsapp");
    if (rule.id === "linkedin" && keys.has("video_views")) derived.push("cost_per_video_view");

    const groupName = (rule.group && names.get(rule.group)) || null;
    const sourceColumns = new Set<string>([date, campaign, ...metrics.map((m) => m.column)]);
    if (groupName) sourceColumns.add(groupName);
    if (accountName) sourceColumns.add(accountName);
    const extras: { name: string; type: string }[] = [];
    for (const field of fields) {
      const name = field.name || "";
      const type = String(field.type || "").toUpperCase();
      if (!name || sourceColumns.has(name) || !NUMERIC.has(type)) continue;
      if (NOT_ADDITIVE.test(name.toLowerCase())) continue;
      extras.push({ name, type });
    }

    return {
      platform: rule.id,
      campaignIdColumn: names.get("campaign_id") || null,
      actionsTable: null,
      dateColumn: date,
      campaignColumn: campaign,
      groupColumn: (rule.group && names.get(rule.group)) || null,
      accountColumn: accountName,
      metrics,
      derived,
      sourceColumns,
      extras,
    };
  }
  return null;
}

// Conversões que, em alguns clientes, ficam numa tabela à parte (uma linha por tipo de ação).
const ACTION_METRICS: { key: string; action: string }[] = [
  { key: "leads", action: "lead" },
  { key: "whatsapp", action: "onsite_conversion.messaging_conversation_started_7d" },
  { key: "landing_page_views", action: "landing_page_view" },
  { key: "thruplays", action: "video_thruplay_watched_actions__video_view" },
  { key: "video_views", action: "video_view" },
];

// Métricas do Meta que podem vir da tabela de ações; se faltar alguma, procuramos essa tabela.
export const ACTION_KEYS = ACTION_METRICS.map((metric) => metric.key);

export function actionsTableName(table: string): string | null {
  const match = /^(facebook_(?:campaign|ad)_insights)(_\d+)?$/.exec(table);
  return match ? `${match[1]}_actions${match[2] || ""}` : null;
}

export function withActions(
  plan: PlatformPlan,
  actionsTable: string,
  actionFields: SchemaField[]
): PlatformPlan {
  const have = new Set(actionFields.map((field) => field.name));
  const ok = ["metric_date", "campaign_id", "actions_action_type", "actions_value"].every((name) =>
    have.has(name)
  );
  if (!ok || !plan.campaignIdColumn || plan.platform !== "meta") return plan;
  const existing = new Set(plan.metrics.map((metric) => metric.key));
  const added = ACTION_METRICS.filter((metric) => !existing.has(metric.key)).map(
    (metric): MetricRule => ({ key: metric.key, column: "", kind: "count", action: metric.action })
  );
  if (!added.length) return plan;
  const keys = new Set([...existing, ...added.map((metric) => metric.key)]);
  const derived = ["ctr", "cpc", "cpm"];
  if (keys.has("leads")) derived.push("cpl");
  if (keys.has("whatsapp")) derived.push("cpl_whatsapp");
  return { ...plan, actionsTable, metrics: [...plan.metrics, ...added], derived };
}

export function platformDimensions(plan: PlatformPlan): string[] {
  return [
    "date",
    ...(plan.accountColumn ? ["account_name"] : []),
    ...(plan.groupColumn ? ["campaign_group_name"] : []),
    "campaign_name",
  ];
}

export function platformMetrics(plan: PlatformPlan, extras: string[]): string[] {
  return [...plan.metrics.map((metric) => metric.key), ...plan.derived, ...extras];
}

const tick = (name: string) => `\`${name}\``;

export function buildPlatformSql(
  plan: PlatformPlan,
  tablePath: string,
  extraColumns: string[],
  limit: number,
  hasNameFilter = false
): string {
  const dims = [
    `${tick(plan.dateColumn)} AS date`,
    ...(plan.accountColumn ? [`CAST(${tick(plan.accountColumn)} AS STRING) AS account_name`] : []),
    ...(plan.groupColumn ? [`${tick(plan.groupColumn)} AS campaign_group_name`] : []),
    `${tick(plan.campaignColumn)} AS campaign_name`,
  ];
  // Filtro fixo por nome: só entra campanha (ou grupo) cujo nome contém o texto. O texto vai como parâmetro.
  const nameColumns = [plan.campaignColumn, ...(plan.groupColumn ? [plan.groupColumn] : [])];
  const where = hasNameFilter
    ? `WHERE ${nameColumns
        .map((column) => `STRPOS(UPPER(CAST(${tick(column)} AS STRING)), UPPER(@nameFilter)) > 0`)
        .join(" OR ")}`
    : "";
  const fromTable = plan.metrics.filter((metric) => !metric.action);
  const fromActions = plan.metrics.filter((metric) => metric.action);
  const sumOf = (expr: string, metric: MetricRule) =>
    metric.kind === "money"
      ? `ROUND(SUM(${expr}), 2) AS ${metric.key}`
      : `CAST(ROUND(SUM(${expr})) AS INT64) AS ${metric.key}`;
  const allowed = new Set(plan.extras.map((extra) => extra.name));
  const extras = extraColumns
    .filter((column) => allowed.has(column))
    .map((column) => `SUM(SAFE_CAST(${tick(column)} AS FLOAT64)) AS ${tick(column)}`);

  const keys = new Set(plan.metrics.map((metric) => metric.key));
  const derived = [
    `ROUND(SAFE_DIVIDE(clicks, impressions) * 100, 2) AS ctr`,
    `ROUND(SAFE_DIVIDE(spend, clicks), 2) AS cpc`,
    `ROUND(SAFE_DIVIDE(spend, impressions) * 1000, 2) AS cpm`,
    ...(keys.has("leads") ? [`ROUND(SAFE_DIVIDE(spend, leads), 2) AS cpl`] : []),
    ...(keys.has("whatsapp") ? [`ROUND(SAFE_DIVIDE(spend, whatsapp), 2) AS cpl_whatsapp`] : []),
    ...(plan.platform === "linkedin" && keys.has("video_views")
      ? [`ROUND(SAFE_DIVIDE(spend, video_views), 4) AS cost_per_video_view`]
      : []),
  ];
  const groupBy = dims.map((_, index) => index + 1).join(", ");
  const tableSums = fromTable.map((metric) =>
    sumOf(`SAFE_CAST(${tick(metric.column)} AS FLOAT64)`, metric)
  );

  if (!fromActions.length || !plan.actionsTable || !plan.campaignIdColumn) {
    return `SELECT *, ${derived.join(", ")}
FROM (
  SELECT ${[...dims, ...tableSums, ...extras].join(", ")}
  FROM \`${tablePath}\`
  ${where}
  GROUP BY ${groupBy}
)
ORDER BY date DESC
LIMIT ${limit}`;
  }

  // Meta com ações em tabela à parte: soma as ações por dia e campanha e junta pelo id da campanha.
  const dataset = tablePath.split(".").slice(0, 2).join(".");
  const actionsPath = `${dataset}.${plan.actionsTable}`;
  const actionSums = fromActions.map(
    (metric) =>
      `SUM(IF(actions_action_type = '${metric.action}', actions_value, 0)) AS ${metric.key}`
  );
  const outerDims = platformDimensions(plan);
  const baseDims = [
    ...dims,
    `CAST(${tick(plan.campaignIdColumn)} AS STRING) AS campaign_key`,
  ];
  const outerSums = [
    ...fromTable.map((metric) => sumOf(`base.${metric.key}`, metric)),
    ...fromActions.map((metric) => sumOf(`act.${metric.key}`, metric)),
    ...extras.map((_, index) => {
      const name = extraColumns.filter((column) => allowed.has(column))[index];
      return `SUM(base.${tick(name)}) AS ${tick(name)}`;
    }),
  ];
  return `WITH base AS (
  SELECT ${[...baseDims, ...fromTable.map((metric) => sumOf(`SAFE_CAST(${tick(metric.column)} AS FLOAT64)`, metric)), ...extras].join(", ")}
  FROM \`${tablePath}\`
  ${where}
  GROUP BY ${baseDims.map((_, index) => index + 1).join(", ")}
), act AS (
  SELECT metric_date AS date, CAST(campaign_id AS STRING) AS campaign_key, ${actionSums.join(", ")}
  FROM \`${actionsPath}\`
  GROUP BY 1, 2
)
SELECT *, ${derived.join(", ")}
FROM (
  SELECT ${[...outerDims.map((name) => `base.${name}`), ...outerSums].join(", ")}
  FROM base LEFT JOIN act ON base.date = act.date AND base.campaign_key = act.campaign_key
  GROUP BY ${outerDims.map((_, index) => index + 1).join(", ")}
)
ORDER BY date DESC
LIMIT ${limit}`;
}
