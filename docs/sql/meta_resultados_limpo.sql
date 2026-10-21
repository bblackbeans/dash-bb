-- Dados limpos: leads e conversas de WhatsApp por dia, conta e campanha (sem data fixa)
WITH base AS (
  SELECT
    metric_date,
    account_name,
    campaign_name,
    SAFE_CAST(spend AS FLOAT64) AS spend,
    SAFE_CAST(a_onsite_conversion_messaging_conversation_started_7d AS INT64) AS whatsapp,
    SAFE_CAST(a_lead AS INT64) AS lead
  FROM `black-beans-dados.dataset_mgtec.facebook_campaign_insights_25`
)
SELECT metric_date, account_name, campaign_name, 'WhatsApp' AS tipo,
       SUM(whatsapp) AS resultados, SUM(spend) AS custo,
       ROUND(SAFE_DIVIDE(SUM(spend), SUM(whatsapp)), 2) AS custo_por_resultado
FROM base WHERE whatsapp > 0
GROUP BY metric_date, account_name, campaign_name
UNION ALL
SELECT metric_date, account_name, campaign_name, 'Lead' AS tipo,
       SUM(lead), SUM(spend), ROUND(SAFE_DIVIDE(SUM(spend), SUM(lead)), 2)
FROM base WHERE lead > 0
GROUP BY metric_date, account_name, campaign_name
