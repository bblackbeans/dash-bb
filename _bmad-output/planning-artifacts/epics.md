---
stepsCompleted: [validate, design-epics, create-stories, final-validation]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-bbdash-2026-07-20/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-bbdash-2026-07-20/ARCHITECTURE-SPINE.md
status: final
created: 2026-07-20
updated: 2026-07-20
---

# bbdash - Epic Breakdown

## Overview

Decomposição do MVP BBDash (PRD + Architecture Spine) em 6 epics e stories implementáveis.

## Requirements Inventory

### Functional Requirements

FR-1 Login Credentials · FR-2 Logout · FR-3 Criar Cliente · FR-4 Listar Cliente · FR-5 Editar/Excluir Cliente · FR-6 Criar Dashboard · FR-7 Widgets · FR-8 Preview · FR-9 CRUD Dashboard · FR-10..15 Filtros · FR-16 Motor · FR-17 Publicar · FR-18 URL Pública · FR-19 Read-only · FR-20 Brand

### NonFunctional Requirements

NFR: tokens BlackBeans; SQLite local; sessões seguras bcrypt; cascata deletes (AD-6)

### FR Coverage Map

| FR | Epic | Stories |
|----|------|---------|
| FR-20 | E1 | 1.2 |
| Foundation DB | E1 | 1.1, 1.3 |
| FR-1, FR-2 | E2 | 2.1, 2.2 |
| FR-3..5 | E3 | 3.1, 3.2 |
| FR-6..9, FR-7 | E4 | 4.1, 4.2, 4.3 |
| FR-10..16 | E5 | 5.1, 5.2 |
| FR-17..19 | E6 | 6.1, 6.2 |

## Epic List

1. **Foundation** — scaffold, brand, Prisma, seed
2. **Auth** — login, logout, middleware
3. **Clients** — CRUD pastas
4. **Dashboards** — CRUD + widgets + mock
5. **Filters** — Looker-like + engine
6. **Public Share** — URL pública + copiar link

---

## Epic 1: Foundation

Bootstrap do app Next.js com identidade BlackBeans, Prisma/SQLite e seed mínimo.

### Story 1.1: Scaffold Next.js + TypeScript + Tailwind

As a developer,
I want o projeto Next.js 15 App Router tipado com Tailwind,
So that temos base para Admin e viewer.

**Acceptance Criteria:**

**Given** repo vazio (exceto BMAD)
**When** scaffold é criado
**Then** `npm run dev` sobe em localhost
**And** TypeScript strict e Tailwind ativos

### Story 1.2: Tokens de marca BlackBeans

As a designer interno,
I want CSS variables `#DA9330 #141312 #B1B0B1 #F4F0ED`,
So that a UI respeita o brand book (FR-20).

**Acceptance Criteria:**

**Given** app rodando
**When** abro a home
**Then** fundo/texto/accent usam as variáveis `--bb-*`

### Story 1.3: Prisma schema + seed

As a developer,
I want User/Client/Dashboard/Widget no SQLite com seed,
So that há dados demo para desenvolver.

**Acceptance Criteria:**

**Given** `npx prisma db push && npm run seed`
**When** consulto o DB
**Then** existe admin, cliente demo e dashboard com widgets
**And** cascade delete está configurado (AD-6)

---

## Epic 2: Auth

### Story 2.1: NextAuth Credentials + login page

As a Usuário Interno,
I want login e-mail/senha,
So that acesso o Admin (FR-1).

**Acceptance Criteria:**

**Given** seed admin
**When** login com credenciais válidas
**Then** sessão criada e redirect `/admin`
**When** inválidas
**Then** erro genérico

### Story 2.2: Middleware + logout

As a sistema,
I want proteger `/admin/*` e permitir logout,
So that rotas internas não vazam (FR-1, FR-2, AD-2).

**Acceptance Criteria:**

**Given** sem sessão
**When** acesso `/admin`
**Then** redirect `/login`
**Given** autenticado
**When** logout
**Then** sessão encerrada

---

## Epic 3: Clients

### Story 3.1: Listar e criar Cliente

As an Admin,
I want listar e criar Clientes com nome/slug,
So that organizo pastas (FR-3, FR-4).

**Acceptance Criteria:**

**Given** Admin autenticado
**When** crio Cliente com slug único
**Then** aparece na lista
**When** slug duplicado
**Then** erro claro

### Story 3.2: Editar e excluir Cliente

As an Admin,
I want editar/excluir Cliente,
So that mantenho o catálogo (FR-5).

**Acceptance Criteria:**

**Given** Cliente existente
**When** edito nome/slug válido
**Then** persiste
**When** excluo
**Then** Dashboards/Widgets em cascata somem

---

## Epic 4: Dashboards

### Story 4.1: CRUD Dashboard no Cliente

As an Admin,
I want criar/listar/editar/excluir Dashboards sob um Cliente,
So that entrego um board por necessidade (FR-6, FR-9).

**Acceptance Criteria:**

**Given** Cliente
**When** crio Dashboard com slug único no Cliente
**Then** listado sob o Cliente
**And** `isPublic` default false

### Story 4.2: Widgets + mock binding

As an Admin,
I want Widgets tipados ligados ao Dataset mock,
So that indicadores não são fixos no código (FR-7, AD-5).

**Acceptance Criteria:**

**Given** Dashboard com `mockPath`
**When** renderizo widgets kpi/line/bar/pie/table
**Then** leem campos do JSON via config
**And** nenhum KPI hard-coded

### Story 4.3: Preview no Admin

As an Admin,
I want preview do Dashboard no admin,
So that valido antes de publicar (FR-8).

**Acceptance Criteria:**

**Given** Dashboard com widgets
**When** abro a página do Dashboard no admin
**Then** vejo os gráficos com dados mock

---

## Epic 5: Filters

### Story 5.1: Motor de filtros puro

As a developer,
I want `filterDataset(rows, filters)`,
So that todos os Widgets usam o mesmo resultado (FR-16, AD-4).

**Acceptance Criteria:**

**Given** rows mock
**When** aplico período + origem + página
**Then** retorno é AND das condições
**And** função é pura/testável

### Story 5.2: Barra de filtros Looker-like

As a viewer,
I want período, página, origem, dispositivo, campanha e comparar,
So that exploro os dados (FR-10..15).

**Acceptance Criteria:**

**Given** Dashboard renderizado
**When** altero qualquer filtro
**Then** todos os Widgets atualizam
**And** compare mostra delta nos KPIs

---

## Epic 6: Public Share

### Story 6.1: Rota pública read-only

As a cliente final,
I want abrir `/p/{client}/{dashboard}` sem login,
So that vejo o board (FR-17..19, UJ-2).

**Acceptance Criteria:**

**Given** `isPublic=true`
**When** abro a URL
**Then** vejo filtros + widgets
**And** sem controles de edição
**Given** `isPublic=false`
**When** abro a URL
**Then** 404

### Story 6.2: Toggle publicar + copiar URL

As an Admin,
I want publicar e copiar o link,
So that entrego ao cliente (FR-17, FR-18).

**Acceptance Criteria:**

**Given** Dashboard
**When** marco público
**Then** URL funciona
**When** clico copiar
**Then** clipboard recebe a URL absoluta

---

## Epic 7: UX Polish & Dashboard Wizard

Elevar UI Untitled-inspired (BlackBeans), wizard de criação de dashboard e teaser GA/BigQuery.

### Story 7.1: Design system primitives

As a developer,
I want Button/Input/Card/Badge/PageHeader/EmptyState/Tooltip/PasswordInput,
So that a UI fica consistente.

### Story 7.2: Shell, Login e listas

As an Admin,
I want login com PasswordInput, nav com ícones e empty states,
So that a operação fica clara e acessível.

### Story 7.3: Wizard novo dashboard

As an Admin,
I want um wizard (dados → widgets → revisar),
So that passo as infos do dashboard com clareza.

### Story 7.4: Teaser Google Analytics / BigQuery

As an Admin,
I want ver fontes GA e BigQuery como "Em breve",
So that a integração futura fica comunicada.

### Story 7.5: Migrar telas para DS + tooltips

As a user,
I want ícones e tooltips nos filtros e telas principais,
So that entendo cada controle ao passar o mouse.
