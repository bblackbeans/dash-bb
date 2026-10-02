# Addendum — BBDash MVP

Conteúdo técnico e decisões que não pertencem ao PRD (capabilities).

## Stack (confirmada)

| Camada | Escolha | Motivo |
|--------|---------|--------|
| App | Next.js 15 App Router + TypeScript | SSR + rotas públicas e admin no mesmo deploy |
| UI | Tailwind + shadcn/ui | Velocidade + consistência |
| Auth | NextAuth (Auth.js) Credentials | Simples para time interno |
| DB | Prisma + SQLite | Zero ops no local; migrável |
| Charts | Recharts | Bom fit React |
| Dados MVP | JSON em `data/mocks/` | Desacoplado; troca por BQ depois |

## Brand tokens

```css
--bb-accent: #DA9330;
--bb-black: #141312;
--bb-gray: #B1B0B1;
--bb-cream: #F4F0ED;
```

## Rotas

- `/login` — autenticação
- `/admin` — home admin
- `/admin/clients` — lista/cria Clientes
- `/admin/clients/[slug]` — Dashboards do Cliente
- `/admin/clients/[slug]/dashboards/[dashSlug]` — editor/preview
- `/p/[clientSlug]/[dashboardSlug]` — viewer público
- `/api/auth/[...nextauth]` — NextAuth

## Schema Prisma (alvo)

- User: id, email, passwordHash, name
- Client: id, name, slug (unique), createdAt
- Dashboard: id, clientId, title, slug, isPublic, mockPath, layoutJson, createdAt
- Widget: id, dashboardId, type, title, configJson, order

## Alternativas rejeitadas

- Looker embed — contradiz o objetivo de plataforma própria.
- Django + Plotly dash — stack menos alinhada ao time web atual; Next escolhido.
- Filtragem só no BigQuery — sem BQ no MVP.
