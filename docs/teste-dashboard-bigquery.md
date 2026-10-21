# Como testar: dashboard lendo tabelas do BigQuery

## Antes de começar
1. Banco local ligado: `docker start bbdash-pg-dev` (porta 55432).
2. App: `npm run dev` e abrir http://localhost:3000/admin
3. Login de desenvolvimento: `admin@blackbeans.com.br` / `blackbeans123` (vem de `prisma/seed.ts`).
4. A chave do BigQuery fica em `data/bigquery-service-account.json` (já configurada no `.env`).

## Teste 1: dashboard pronto (MG Tec, coluna de conversões na própria tabela)
Abrir `/admin/clients/teste/dashboards/teste-21-10`.

| Item | Esperado |
|---|---|
| Investimento | R$ 465.203,38 |
| Cliques | 275.718 |
| Leads | 12.033 |
| Conversas no WhatsApp | 10.945 |
| CPL (leads) | R$ 38,66 |
| CPL (WhatsApp) | R$ 42,50 |

Filtro de período: escolha "Mês passado" quando o mês anterior for setembro de 2026.
Esperado: Investimento R$ 11.326,59, Cliques 6.323, Leads 100, WhatsApp 505, CPL leads R$ 113,27, CPL WhatsApp R$ 22,43.
Para outros períodos, compare com o BigQuery:
`SELECT SUM(spend), SUM(clicks), SUM(a_lead) FROM dataset_mgtec.facebook_campaign_insights_25 WHERE metric_date BETWEEN '...' AND '...'`
(location southamerica-east1).

Teste também o filtro "Campanha" e o botão "Baixar PDF".

## Teste 2: criar dashboard novo pelo wizard (Pinotti, conversões em tabela separada)
1. Cliente > Novo dashboard. Título: qualquer um.
2. Fonte: BigQuery. Dataset: `dataset_pinotti`. Dê um nome à página e marque `facebook_campaign_insights`.
   - A lista deve mostrar só as tabelas principais (sem `_actions` nem `_action_values`).
3. Passo 2: as métricas devem aparecer em português (Investimento, Cliques, Leads, Conversas no WhatsApp, CPL...).
4. Criar. Totais esperados do Pinotti (todo o período): Investimento R$ 57.479,58, Leads 275, WhatsApp 2.001, Visualizações da página 30.969.
   Para ver leads, WhatsApp e CPL no gráfico ou KPI, use "Montar dashboard" e adicione os widgets com essas métricas.

## Teste 3: outras plataformas e localizações
No wizard, escolha:
- `dataset_jnj_y26` > `linkedin_adstatistics` (LinkedIn, dataset em localização US). Esperado: Investimento R$ 38.410,80, Impressões 6.784.102, Cliques 5.915.
- `dataset_jnj_y26` > `gads_keyword_perf_daily` (Google Ads). Esperado: Investimento 59,21, Cliques 31.
- `dataset_neobrasil` > `facebook_campaign_insights` (US). Esperado: Investimento 43.533,49, Leads 1.428.

## Teste 4: view antiga continua igual
`dataset_mgtec` > `vw_facebook_campaign_insights_objetivos` deve continuar mostrando `total_whatsapp`, `total_spend_whatsapp` e `CPL_Whatsapp`.

## O que olhar
- Os números batem com o BigQuery? Se não, anote dataset, tabela, período e valores.
- Cada dashboard abre em poucos segundos? A primeira abertura consulta o BigQuery. Reabrir em até 5 minutos usa o cache.
- Tabelas com mais de 20.000 linhas agregadas mostram um aviso laranja no topo. Nos testes feitos, nenhuma tabela chegou a isso.

## Limitações conhecidas
- LinkedIn: a coluna de leads (`oneclickleads`) está vazia na tabela testada.
- Plataformas fora de Meta, LinkedIn e Google Ads precisam de uma regra nova (`src/lib/bigquery-platforms.ts`).
- Cache de 5 minutos: dados novos do BigQuery podem demorar até 5 minutos para aparecer.
- Colunas fora do padrão aparecem com o nome técnico até alguém dar um nome amigável (`src/lib/widget-config.ts`).
