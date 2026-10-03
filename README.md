# Ко Манда

Платформа за стопанисване на имоти: редовни обходи със снимково
доказателство, констатации, оферти за ремонт. Три роли — клиент,
инспектор, админ. Домейн: [comanda.bg](https://comanda.bg).

**Стек:** Next.js 14 (App Router) · TypeScript · Drizzle + SQLite ·
Tailwind · деплой на Coolify.

## Документи

| | |
|---|---|
| [docs/PLAN.md](docs/PLAN.md) | Какво е направено, какво остава |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Настройка на сървъра: променливи, бекъп, периодични задачи |
| [docs/DESIGN.md](docs/DESIGN.md) | Екрани, токени, примитиви |
| [AGENTS.md](AGENTS.md) | Контекст за AI агенти |

## Локално

```bash
npm install
echo "SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" >> .env.local
npm run db:seed        # тестови акаунти и имоти (отпечатва паролите)
npm run dev
```

## Проверки

```bash
npm test               # vitest
npx tsc --noEmit
npm run lint
npm run build
```

## Структура

```
src/app/api/        API (всеки route е зад withAuth — тест го проверява)
src/features/       екраните по роля: client/, inspector/, admin/
src/components/ui/  примитиви (Button, Card, Badge, Sheet, Icon…)
src/lib/domain/     чиста бизнес логика с тестове (оферти, график, празници…)
src/db/             схема и връзка; миграциите са в drizzle/
scripts/            бекъп, възстановяване, периодични задачи (cron.mjs)
```
