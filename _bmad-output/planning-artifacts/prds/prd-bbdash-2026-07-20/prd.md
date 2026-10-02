---
title: BBDash — Plataforma de Dashboards BlackBeans
status: final
created: 2026-07-20
updated: 2026-07-20
project: bbdash
---

# PRD: BBDash — Plataforma de Dashboards BlackBeans

## 0. Document Purpose

Este PRD define o MVP da plataforma interna BlackBeans para criar e publicar dashboards web próprios (substituto operacional do Looker Studio). Destina-se a PM, arquitetura e implementação via BMad Method. Vocabulário ancorado no Glossário; features com FRs numerados globalmente; decisões de stack em `addendum.md`.

## 1. Vision

A BlackBeans precisa entregar dashboards de performance para clientes (Johnson & Johnson, Arca e futuros) sem depender do Looker Studio. O BBDash é a plataforma própria: o time interno organiza clientes, monta dashboards em código/configuração, aplica filtros no estilo Looker e publica cada dashboard em uma URL pública que o cliente só visualiza.

No MVP, a criação é assistida por configuração + dados mock (não por IA). A arquitetura já separa dados, widgets e filtros para, em fases seguintes, conectar BigQuery e geração por IA.

## 2. Target User

### 2.1 Jobs To Be Done

- **Funcional:** como analista BlackBeans, quero criar pastas de cliente e dashboards reutilizáveis e publicá-los rápido.
- **Funcional:** como cliente final, quero abrir um link e ver meus indicadores com filtros, sem login Google/Looker.
- **Emocional:** reduzir o tempo manual da equipe (ex.: Babi) montando dashboards no Looker.
- **Social:** posicionar a BlackBeans como Martech com produto próprio de BI.

### 2.2 Non-Users (v1)

- Clientes finais com conta de edição (só leitura pública).
- Equipes que precisam de SQL ad-hoc ou modelagem Looker completa.
- Usuários que exigem SSO corporativo no MVP.

### 2.3 Key User Journeys

- **UJ-1. Kauê publica o dashboard da Johnson.**
  - **Persona + context:** Kauê, analista BlackBeans, já autenticado no admin.
  - **Entry state:** `/admin` após login.
  - **Path:** cria cliente “Johnson”, cria dashboard “Tráfego”, associa mock, configura widgets, copia URL pública.
  - **Climax:** abre `/p/johnson/trafego` em aba anônima e vê gráficos.
  - **Resolution:** envia o link ao cliente.

- **UJ-2. Cliente filtra por período e origem.**
  - **Persona + context:** gestor de marketing do cliente, sem conta BBDash.
  - **Entry state:** abre URL pública.
  - **Path:** altera período (últimos 30 dias), filtra origem Paid, dispositivo Mobile.
  - **Climax:** KPIs e gráficos atualizam.
  - **Resolution:** fecha a aba; sem editar nada.

- **UJ-3. Admin protege a área interna.**
  - **Persona + context:** visitante sem sessão.
  - **Entry state:** tenta `/admin/clients`.
  - **Path:** redirecionado para `/login`, autentica com credenciais internas.
  - **Climax:** acessa lista de clientes.
  - **Edge case:** credencial inválida mostra erro sem revelar se o e-mail existe.

## 3. Glossary

- **Cliente** — Pasta/local lógico que agrupa Dashboards de uma marca (ex.: Johnson). Tem `name` e `slug` únicos.
- **Dashboard** — Conjunto de Widgets + Filtros + layout, pertencente a um Cliente. Tem `slug` único por Cliente e URL Pública.
- **Widget** — Bloco visual (KPI, linha, barra, pizza, tabela) ligado a dimensões/métricas do Dataset.
- **Dataset** — Fonte tabular do Dashboard no MVP (JSON mock). Sem indicadores fixos no código.
- **Filtro** — Controle global (período, página, origem, dispositivo, campanha, comparar período) aplicado ao Dataset antes dos Widgets.
- **URL Pública** — Rota `/p/{clientSlug}/{dashboardSlug}` acessível sem autenticação, somente leitura.
- **Admin** — Área autenticada `/admin/*` usada pelo time BlackBeans.
- **Usuário Interno** — Conta Credentials do time BlackBeans.

## 4. Features

### 4.1 Autenticação interna

**Description:** Usuários Internos acessam o Admin via e-mail/senha. Rotas `/admin/*` exigem sessão. Realiza UJ-3.

**Functional Requirements:**

#### FR-1: Login com Credentials

Usuário Interno pode autenticar com e-mail e senha válidos. Realiza UJ-3.

**Consequences (testable):**
- Credenciais válidas criam sessão e redirecionam para `/admin`.
- Credenciais inválidas retornam erro genérico.
- Sem sessão, `/admin/*` redireciona para `/login`.

#### FR-2: Logout

Usuário Interno autenticado pode encerrar a sessão.

**Consequences (testable):**
- Após logout, `/admin` exige novo login.

### 4.2 Gestão de Clientes

**Description:** CRUD de Clientes (pastas) com nome e slug. Realiza UJ-1.

**Functional Requirements:**

#### FR-3: Criar Cliente

Admin pode criar Cliente com nome e slug.

**Consequences (testable):**
- Slug único; conflito retorna erro claro.
- Cliente aparece na listagem.

#### FR-4: Listar e abrir Cliente

Admin pode listar Clientes e navegar para seus Dashboards.

#### FR-5: Editar e excluir Cliente

Admin pode renomear/alterar slug (com validação) e excluir Cliente (e Dashboards associados ou bloquear se houver — ver ASSUMPTION).

### 4.3 Gestão de Dashboards

**Description:** CRUD de Dashboards dentro de um Cliente, com widgets e binding a Dataset mock. Realiza UJ-1.

**Functional Requirements:**

#### FR-6: Criar Dashboard

Admin pode criar Dashboard com título e slug sob um Cliente.

#### FR-7: Configurar Widgets

Admin pode definir Widgets (tipos: kpi, line, bar, pie, table) com métricas/dimensões do schema do Dataset — sem hardcode de indicadores de negócio.

#### FR-8: Preview no Admin

Admin pode visualizar o Dashboard com os mesmos Filtros do viewer público.

#### FR-9: Listar / editar / excluir Dashboard

Admin gerencia ciclo de vida do Dashboard.

### 4.4 Filtros estilo Looker

**Description:** Barra de Filtros no topo do Dashboard (admin e público). Realiza UJ-2.

**Functional Requirements:**

#### FR-10: Filtro de período

Usuário (Admin ou visitante público) pode filtrar por presets (hoje, 7d, 30d, 90d) ou intervalo custom.

#### FR-11: Filtro de página

Multi-select de paths/páginas presentes no Dataset filtrado.

#### FR-12: Filtro de origem

Filtro por source/medium (Organic, Paid, Direct, Referral, Social, etc.).

#### FR-13: Filtro de dispositivo

desktop / mobile / tablet.

#### FR-14: Filtro de campanha

utm_campaign quando presente no Dataset.

#### FR-15: Comparar período anterior

Toggle que calcula delta de KPIs vs período imediatamente anterior de mesma duração.

#### FR-16: Motor de Filtros

Sistema aplica Filtros ao Dataset antes de agregar Widgets.

**Consequences (testable):**
- Alterar um Filtro atualiza todos os Widgets visíveis.
- Combinações de Filtros são AND.

### 4.5 URL Pública

**Description:** Cada Dashboard publicado tem URL Pública somente leitura. Realiza UJ-1 e UJ-2.

**Functional Requirements:**

#### FR-17: Publicar / despublicar

Admin pode marcar Dashboard como público (`isPublic`).

#### FR-18: Acessar URL Pública

Visitante acessa `/p/{clientSlug}/{dashboardSlug}` sem login se `isPublic=true`.

**Consequences (testable):**
- Dashboard não público retorna 404 (ou 403 genérico).
- Admin pode copiar a URL Pública na UI.

#### FR-19: Viewer somente leitura

URL Pública não expõe ações de edição.

### 4.6 Identidade visual BlackBeans

**Description:** UI Admin e pública usam tokens do brand book.

**Functional Requirements:**

#### FR-20: Tokens de marca

Sistema aplica `#DA9330` (accent), `#141312` (preto), `#B1B0B1` (cinza), `#F4F0ED` (off-white) via CSS variables / tema.

## 5. Non-Goals (Explicit)

- Não é Looker Studio completo (modelagem, joins SQL, scheduled reports).
- Não gera Dashboard por prompt de IA no MVP.
- Não conecta Google Analytics / BigQuery no MVP.
- Não oferece contas de cliente com permissões.
- Não faz white-label completo por Cliente no MVP.
- Não exporta PDF/CSV no MVP.

## 6. MVP Scope

### 6.1 In Scope

- Login Credentials + proteção `/admin`
- CRUD Cliente e Dashboard
- Widgets KPI/line/bar/pie/table + Dataset JSON mock
- Filtros: período, página, origem, dispositivo, campanha, comparar
- URL Pública `/p/...`
- Brand tokens BlackBeans
- Seed demo (1 admin, 1 Cliente, 1 Dashboard)

### 6.2 Out of Scope for MVP

- Geração por IA (v2)
- Conectores BigQuery/GA (v2)
- SSO / OAuth Google (v2)
- Multi-usuário com roles granulares (v2)
- Exportação e alertas (v2+)

## 7. Success Metrics

**Primary**

- **SM-1**: Time interno consegue criar Cliente + Dashboard + URL Pública em &lt; 10 minutos no ambiente local. Valida FR-3, FR-6, FR-18.
- **SM-2**: Visitante aplica Filtros e vê Widgets atualizarem sem erro. Valida FR-10–FR-16.

**Secondary**

- **SM-3**: Zero dependência de Looker para o demo seed. Valida visão.

**Counter-metrics**

- **SM-C1**: Não otimizar número de tipos de Widget além dos 5 do MVP (evita scope creep).

## 8. Open Questions

1. Exclusão de Cliente com Dashboards: cascade vs bloquear? `[ASSUMPTION: cascade delete]`
2. Slug imutável após criação? `[ASSUMPTION: editável com validação de unicidade]`
3. Hosting/domínio `dashboard.blackbeans.com.br` fica fora do MVP local.

## 9. Assumptions Index

- `[ASSUMPTION]` Dataset MVP = JSON mock local, filtragem client-side ou server-side simples.
- `[ASSUMPTION]` Cascade delete Cliente → Dashboards → Widgets.
- `[ASSUMPTION]` Um Usuário Interno seed basta (`admin@blackbeans.com.br`).
- `[ASSUMPTION]` SQLite + Prisma adequado para MVP local; Postgres depois.
- `[ASSUMPTION]` NextAuth Credentials sem e-mail magic link.
