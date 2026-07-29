# Ко Манда — AI Agent Context

> Автоматично зареждано от Claude Code, Cursor, Hermes и други агенти.

## Идентичност
- **Име:** Ко Манда (Ko Manda)
- **Продукт:** Платформа за управление на имоти — почистване, обходи, инспекции, ремонти
- **Домейн:** comanda.blv.bg
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

## База данни (14 таблици)
organizations, users, properties, zones, service_templates,
template_items, plans, jobs, job_items, evidence, findings,
finding_photos, offers, inquiries

## Файлова структура
```
src/
  app/          — Next.js App Router pages
  components/   — React components (ui/, features/)
  db/
    schema.ts   — Drizzle schema (14 tables)
    index.ts    — DB connection
  lib/          — utilities, auth, store
data/           — SQLite DB (local dev, gitignored)
```

## Команди
```bash
npm run dev       # старт с hot reload
npm run build     # production build
npx drizzle-kit generate  # нова миграция
npx drizzle-kit push      # приложи миграция
```

## Coolify
- App UUID: bgrs9g4j5wbpup5qj6za39ph
- Project: Chisto (xrqax7jm5vwj)
- Persistent storage: /app/data
- Domain: comanda.blv.bg (custom_labels за Traefik)

## Правила
- Mobile-first: 16px inputs, 44px touch targets, safe-area insets
- Single-page client experience с Framer Motion
- Всички API routes с `export const dynamic = 'force-dynamic'`
- Снимки → local filesystem (data/photos/)
- Без Supabase dependency, self-hosted SQLite
