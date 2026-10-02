# BBDash — BlackBeans Dashboards

Plataforma própria de dashboards da BlackBeans (MVP).

## Stack

Next.js 15 · NextAuth · Prisma/SQLite · Recharts · Tailwind · BMad Method

## Setup

```bash
cp .env.example .env
# Ajuste DATABASE_URL para caminho absoluto se o SQLite não abrir, ex.:
# DATABASE_URL="file:/caminho/completo/bbdash/prisma/dev.db"

npm install
npx prisma db push
npm run seed
npm run dev
```

Abra http://localhost:3000 (ou a porta que o Next indicar se 3000 estiver ocupada).

### Credenciais seed

- E-mail: `admin@blackbeans.com.br`
- Senha: `blackbeans123`

### Demo pública

`/p/johnson/trafego`

## BMAD

Artefatos em `_bmad-output/`:

- PRD, Architecture Spine, Epics, Readiness, Sprint status

## Brand

| Token | Hex |
|-------|-----|
| Accent | `#DA9330` |
| Black | `#141312` |
| Gray | `#B1B0B1` |
| Cream | `#F4F0ED` |
