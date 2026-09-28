# Ко Манда — AI Agent Context

> Автоматично зареждано от Claude Code, Cursor, Hermes и други агенти.

## Идентичност
- **Име:** Ко Манда (Ko Manda)
- **Продукт:** Платформа за управление на имоти — почистване, обходи, инспекции, ремонти
- **Домейн:** comanda.bg
- **GitHub:** soulkeeper131/comanda

## Стек
- Next.js 14 (App Router) + TypeScript
- Drizzle ORM + SQLite (better-sqlite3)
- Tailwind CSS + Framer Motion
- Zustand (state), Better Auth (auth)
- Coolify деплой с persistent volume /app/data

## Бранд цветове
| Variable | Hex | Tailwind |
|----------|-----|----------|
| bg | #e8f1f2 | brand-bg |
| primary | #1b98e0 | brand-primary |
| secondary | #247ba0 | brand-secondary |
| dark | #006494 | brand-dark |
| accent | #a663cc | brand-accent |

## База данни
organizations, users, properties, zones, service_templates,
template_items, packages, package_items, plans, jobs, job_items,
job_reschedules, evidence, findings, finding_photos, offers,
offer_photos, inquiries, notifications, push_subscriptions,
payments, invoices, settings, overrides

## Файлова структура
```
src/
  app/          — Next.js App Router pages + API routes
  features/     — екраните по роля: client/, inspector/, admin/
  components/   — споделени компоненти; ui/ — примитиви и Icon
  db/
    schema.ts   — Drizzle schema
    index.ts    — DB connection + auto-migrate
  lib/          — auth, email, периодични задачи
  lib/domain/   — чиста бизнес логика с тестове
data/           — SQLite DB (local dev, gitignored)
```

## Команди
```bash
npm run dev       # старт с hot reload
npm run build     # production build
npx drizzle-kit generate  # нова миграция (прилага се сама при старт)
npm test                  # vitest
```

## Coolify
- App UUID: bgrs9g4j5wbpup5qj6za39ph
- Project: Chisto (xrqax7jm5vwj)
- Persistent storage: /app/data
- Domain: comanda.bg (custom_labels за Traefik)
- Scheduled Tasks: бекъп и `node /app/scripts/cron.mjs` — виж docs/DEPLOY.md

## Правила
- Mobile-first: 16px inputs, 44px touch targets, safe-area insets
- Без emoji в UI — `Icon` от components/ui; цени в евро (`lib/format.ts`)
- Всеки API route с `withAuth` (тестът route-coverage го проверява)
- Single-page client experience с Framer Motion
- Всички API routes с `export const dynamic = 'force-dynamic'`
- Снимки → local filesystem (data/photos/)
- Без Supabase dependency, self-hosted SQLite
