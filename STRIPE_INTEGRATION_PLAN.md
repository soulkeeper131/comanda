# Stripe Интеграция — Архитектурен План за Ко Манда

> **Дата:** 2026-08-10  
> **Автор:** AI Agent (Hermes)  
> **Проект:** Ко Манда (comanda.blv.bg) — Next.js 14 + TypeScript + Drizzle ORM + SQLite  

---

## 📋 Съдържание
1. [Текущо състояние](#1-текущо-състояние)
2. [Stripe SDK инсталация и конфигурация](#2-stripe-sdk-инсталация-и-конфигурация)
3. [Промени в базата данни](#3-промени-в-базата-данни)
4. [API ендпойнти](#4-api-ендпойнти)
5. [Frontend промени](#5-frontend-промени)
6. [Автоматично генериране на фактура](#6-автоматично-генериране-на-фактура)
7. [Отказ от бутафорния mock](#7-отказ-от-бутафорния-mock)
8. [План за имплементация (checklist)](#8-план-за-имплементация-checklist)

---

## 1. Текущо състояние

### 1.1. Как работи сега (бутафорно)

| Компонент | Как работи |
|-----------|-----------|
| `PaymentPanel.tsx` | Показва цена + два радио бутона (💳 Карта / 🏦 Банков превод). При натискане на "Плати" → `POST /api/payments` → записва ред в таблица `payments` със статус `pending` → показва ✅ "Платено!" |
| `POST /api/payments` | Взема `amount`, `method`, `offer_id` от body-то, insert-ва в `payments` със статус `pending` — **реално плащане не се случва** |
| `PATCH /api/payments/[id]` | Позволява ръчно сменяне на статус на `paid` (за тестове) |
| `OffersPanel.tsx` | При статус `accepted` показва бутон "💳 Плати сега" → вика `onPay(offerId)` → dashboard отваря `PaymentPanel` |

### 1.2. Ценови модел

| Тип | Примери | Цена | Период |
|-----|---------|------|--------|
| **Абонаментни планове** (plans таблица) | Месечно почистване, обход 4x/месец | 60/40/50/20/25 EUR | месечно |
| **Еднократни услуги/оферти** (offers таблица) | Ремонт, отстраняване на проблем | 75/15/80/20 EUR | еднократно |

**Внимание:** Сега сумите се показват като **"лв"** в UI-а, но планът е всичко да е в **EUR**. Трябва да се смени `"лв"` → `"€"` в `PaymentPanel.tsx` и `OffersPanel.tsx`.

### 1.3. Засегнати таблици

```
payments         — съществува (id, user_id, offer_id, amount, status, method, paid_at, created_at)
offers           — съществува (decision: "paid" маркира платена оферта)
invoices         — съществува (id, user_id, payment_id, number, amount, description, pdf_path, created_at)
plans            — съществува (абонаменти: property_id, template_id, name, per_month, price, active)
```

---

## 2. Stripe SDK инсталация и конфигурация

### 2.1. Инсталация

```bash
cd /root/comanda
npm install stripe
npm install --save-dev @types/stripe
```

`stripe` e **server-side only** пакет. НЕ се import-ва в `"use client"` компоненти. За frontend се използва **Stripe Checkout redirect flow** (няма нужда от `@stripe/stripe-js`).

### 2.2. Environment променливи

В `.env` и Coolify env vars:

```env
STRIPE_SECRET_KEY=sk_live_xxxxxxxxx        # или sk_test_ за dev
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxx   # или pk_test_ за dev
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxx      # от Stripe Dashboard → Webhooks
```

Добави и `.env.example`:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2.3. Stripe клиент (singleton)

Създай `src/lib/stripe.ts`:

```typescript
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27", // ползвай актуалната версия
  typescript: true,
});
```

**Coolify бележка:** Persistent volume е на `/app/data` — env променливите се задават в Coolify UI, а не във файл.

---

## 3. Промени в базата данни

### 3.1. Актуализация на `payments` таблица (schema.ts)

```typescript
// Промени в payments (ред 242–251 в schema.ts)
export const payments = sqliteTable("payments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").references(() => users.id).notNull(),
  offer_id: text("offer_id").references(() => offers.id),
  plan_id: text("plan_id").references(() => plans.id),      // 🆕 за абонаментни плащания
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("eur"),        // 🆕 eur / bgn
  status: text("status").notNull().default("pending"),        // pending → paid → refunded / cancelled
  method: text("method").notNull().default("stripe"),         // "stripe" | "transfer" | "cash"
  stripe_session_id: text("stripe_session_id"),               // 🆕
  stripe_payment_intent_id: text("stripe_payment_intent_id"), // 🆕
  billing_reason: text("billing_reason"),                     // 🆕 "offer_payment" | "subscription" | "one_time"
  paid_at: text("paid_at"),
  created_at: text("created_at").default(sql`(datetime('now'))`),
});
```

### 3.2. Актуализация на `offers` таблица (schema.ts)

Добавяне на ново поле за проследяване на плащането:

```typescript
export const offers = sqliteTable("offers", {
  // ... съществуващи колони (ред 188–196)
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  finding_id: text("finding_id").references(() => findings.id).notNull(),
  price: real("price"),
  days: integer("days"),
  scope: text("scope"),
  sent_at: text("sent_at").default(sql`(datetime('now'))`),
  decision: text("decision").default("pending"), // "pending"|"accepted"|"declined"|"paid"|"in_progress"|"done"
  stripe_price_id: text("stripe_price_id"),     // 🆕 Stripe Price ID (за Checkout)
  stripe_product_id: text("stripe_product_id"), // 🆕 Stripe Product ID
});
```

### 3.3. Актуализация на `plans` таблица (schema.ts)

```typescript
export const plans = sqliteTable("plans", {
  // ... съществуващи колони (ред 99–108)
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  property_id: text("property_id").references(() => properties.id).notNull(),
  template_id: text("template_id").references(() => serviceTemplates.id).notNull(),
  name: text("name").notNull(),
  per_month: integer("per_month").default(4),
  price: real("price").default(0),
  active: integer("active", { mode: "boolean" }).default(true),
  started_at: text("started_at").default(sql`(datetime('now'))`),
  stripe_price_id: text("stripe_price_id"),     // 🆕
  stripe_product_id: text("stripe_product_id"), // 🆕
});
```

### 3.4. Миграция

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

**Важно:** Трябва да се добавят и `ALTER TABLE` редове в `src/db/index.ts` (в блока `migrate()`) за обратна съвместимост с вече съществуващи бази:

```typescript
migrate("payments", "plan_id", "TEXT REFERENCES plans(id)");
migrate("payments", "currency", "TEXT DEFAULT 'eur'");
migrate("payments", "stripe_session_id", "TEXT");
migrate("payments", "stripe_payment_intent_id", "TEXT");
migrate("payments", "billing_reason", "TEXT");
migrate("offers", "stripe_price_id", "TEXT");
migrate("offers", "stripe_product_id", "TEXT");
migrate("plans", "stripe_price_id", "TEXT");
migrate("plans", "stripe_product_id", "TEXT");
```

---

## 4. API ендпойнти

### 4.1. `POST /api/stripe/checkout` — създава Stripe Checkout Session

**Файл:** `src/app/api/stripe/checkout/route.ts`

#### Логика:

1. **Автентикация** — проверка на сесия чрез `getSession()`
2. **Парсване на body** — приема:
   ```typescript
   {
     offer_id?: string,    // за оферти
     plan_id?: string,     // за абонаменти
     amount: number,       // в EUR (в евроцентове за Stripe: amount * 100)
     description: string,
     success_url: string,  // къде да върне потребителя при успех (напр. /dashboard?paid=ok)
     cancel_url: string,   // къде при отказ (напр. /dashboard?paid=cancel)
   }
   ```
3. **Валидация** — проверка дали офертата/планът съществува и не е вече платен
4. **Създаване на Stripe Checkout Session:**
   ```typescript
   const session = await stripe.checkout.sessions.create({
     payment_method_types: ["card"],
     line_items: [{
       price_data: {
         currency: "eur",
         product_data: { name: description },
         unit_amount: Math.round(amount * 100), // EUR → центове
       },
       quantity: 1,
     }],
     mode: "payment", // или "subscription" за абонаменти
     success_url,
     cancel_url,
     metadata: {
       user_id: session.uid,
       offer_id: offer_id || "",
       plan_id: plan_id || "",
       billing_reason: offer_id ? "offer_payment" : "subscription",
     },
   });
   ```
5. **Запис в `payments` таблицата** (статус `pending`, свързан със `stripe_session_id`)
6. **Връща** `{ url: session.url }` — frontend пренасочва към Stripe

#### Код (скелет):

```typescript
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { payments, offers, plans } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Не сте влезли" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { offer_id, plan_id, amount, description, success_url, cancel_url } = body;

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Невалидна сума" }, { status: 400 });
  }

  // Валидация на оферта (ако е през offer)
  if (offer_id) {
    const offer = db.select().from(offers).where(eq(offers.id, offer_id)).get();
    if (!offer) return NextResponse.json({ error: "Офертата не е намерена" }, { status: 404 });
    if (offer.decision !== "accepted") {
      return NextResponse.json({ error: "Офертата не е приета" }, { status: 400 });
    }
  }

  // Създаване на Stripe Checkout Session
  const stripeSession = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "eur",
        product_data: { name: description || "Плащане към Ко Манда" },
        unit_amount: Math.round(amount * 100),
      },
      quantity: 1,
    }],
    mode: "payment",
    success_url: success_url || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?paid=ok`,
    cancel_url: cancel_url || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?paid=cancel`,
    metadata: {
      user_id: session.uid,
      offer_id: offer_id || "",
      plan_id: plan_id || "",
      billing_reason: offer_id ? "offer_payment" : plan_id ? "subscription" : "one_time",
    },
  });

  // Запис в payments таблицата
  const paymentId = crypto.randomUUID();
  db.insert(payments).values({
    id: paymentId,
    user_id: session.uid,
    offer_id: offer_id || null,
    plan_id: plan_id || null,
    amount,
    currency: "eur",
    status: "pending",
    method: "stripe",
    stripe_session_id: stripeSession.id,
    billing_reason: offer_id ? "offer_payment" : plan_id ? "subscription" : "one_time",
  }).run();

  return NextResponse.json({ url: stripeSession.url });
}
```

---

### 4.2. `POST /api/stripe/webhook` — обработва webhook събития

**Файл:** `src/app/api/stripe/webhook/route.ts`

#### Stripe изпраща събития като:
- `checkout.session.completed` — най-важното: плащането е завършено
- `payment_intent.succeeded` — payment intent е успял
- `payment_intent.payment_failed` — неуспешно плащане
- `invoice.paid` — за subscription invoices

#### Логика при `checkout.session.completed`:
1. **Верификация на подписа** (`stripe.webhooks.constructEvent`)
2. **Извличане** на `session.id` и `metadata` (user_id, offer_id, plan_id)
3. **Намиране на payment записа** по `stripe_session_id`
4. **Ъпдейт на payment:** `status = "paid"`, `paid_at = now()`, `stripe_payment_intent_id`
5. **Ъпдейт на offer** (ако има): `decision = "paid"`
6. **Генериране на фактура** (автоматично, виж секция 6)
7. **In-app нотификация** до потребителя и админа
8. **Email нотификация** до админа
9. **Връща `200 OK`** на Stripe

#### Важно за webhook в dev среда:
Stripe webhooks не могат да стигнат до `localhost` директно. Използва се **Stripe CLI**:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
Това дава различен `STRIPE_WEBHOOK_SECRET` за dev — слага се в `.env.local`.

#### Webhook код (скелет):

```typescript
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { payments, offers, invoices, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail, getNotifyEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// Stripe изисква raw body — Next.js трябва да го подаде сурово
export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature")!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error("[stripe-webhook] Signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("[stripe-webhook] Event:", event.type);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      await handleCheckoutCompleted(session);
      break;
    }
    case "payment_intent.succeeded": {
      // Резервно хващане (ако checkout.session.completed пропусне)
      const pi = event.data.object;
      console.log("[stripe-webhook] PaymentIntent succeeded:", pi.id);
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object;
      const payment = db.select().from(payments)
        .where(eq(payments.stripe_payment_intent_id, pi.id)).get();
      if (payment) {
        db.update(payments).set({ status: "failed" })
          .where(eq(payments.id, payment.id)).run();
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: any) {
  const { user_id, offer_id, plan_id } = session.metadata || {};

  // Намиране на payment записа
  const payment = db.select().from(payments)
    .where(eq(payments.stripe_session_id, session.id)).get();
  if (!payment) {
    console.error("[stripe-webhook] Payment not found for session:", session.id);
    return;
  }

  // Предпазване от двоен ъпдейт (идемпотентност)
  if (payment.status === "paid") return;

  const piId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;

  // Ъпдейт на payment
  db.update(payments).set({
    status: "paid",
    paid_at: new Date().toISOString(),
    stripe_payment_intent_id: piId || null,
  }).where(eq(payments.id, payment.id)).run();

  // Ъпдейт на offer (ако има)
  if (offer_id) {
    db.update(offers).set({ decision: "paid" })
      .where(eq(offers.id, offer_id)).run();
  }

  // Генериране на фактура
  await generateInvoice(payment.id, user_id, payment.amount);

  // In-app нотификация
  if (user_id) {
    createNotification(user_id, "offer_decided",
      "✅ Плащането е успешно",
      `Плащане от ${payment.amount.toFixed(2)} EUR е обработено.`,
      "/dashboard"
    );
  }

  // Email до админ
  sendEmail({
    to: (await getNotifyEmail()) || "",
    subject: `💰 Ново плащане: ${payment.amount.toFixed(2)} EUR`,
    html: `<div style="font-family:sans-serif;padding:24px;">
      <h2 style="color:#16a34a;">💰 Ново плащане</h2>
      <p>Сума: <strong>${payment.amount.toFixed(2)} EUR</strong></p>
      <p>Stripe PaymentIntent: ${piId || "—"}</p>
      <p>Оферта: ${offer_id || "—"}</p>
    </div>`,
  }).catch(() => {});
}
```

#### ⚠️ Важно за Next.js 14 App Router:

Stripe webhook изисква **сурово (raw) body**. В Next.js App Router, трябва да изключиш body parsing за този route:

```typescript
export const config = {
  api: {
    bodyParser: false,
  },
};
```

**За App Router** това става чрез `request.text()` — горният код вече го прави. Не е нужно допълнително.

---

### 4.3. Модификация на `POST /api/payments` (съществуващ)

Сегашният `POST /api/payments` трябва да се **преработи**:

- При `method === "transfer"` — запазва се като банков превод (не минава през Stripe), ръчно потвърждение от админ
- При `method === "stripe"` — **вече не се извиква директно от PaymentPanel**. Вместо това PaymentPanel вика `POST /api/stripe/checkout`.

```typescript
// Обновена логика за POST /api/payments (само за method=transfer)
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Не сте влезли" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { offer_id, amount } = body;

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Сумата е задължителна" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  db.insert(payments).values({
    id,
    user_id: session.uid,
    offer_id: offer_id || null,
    amount,
    currency: "eur",
    method: "transfer",
    status: "pending",     // админа ръчно потвърждава
    billing_reason: "offer_payment",
  }).run();

  const payment = db.select().from(payments).where(eq(payments.id, id)).get();
  return NextResponse.json(payment, { status: 201 });
}
```

---

## 5. Frontend промени

### 5.1. `PaymentPanel.tsx` — основна преработка

**Какво се променя:**
- **"лв" → "€"** навсякъде
- Вместо `POST /api/payments` → извиква `POST /api/stripe/checkout`
- Stripe връща `{ url }` → пренасочване с `window.location.href = url`
- Добавя се loading state докато се създава checkout сесията
- Интерфейсът се опростява — Stripe Checkout се грижи за картата

```typescript
// Промени в handlePay:
const handlePay = async () => {
  setStatus("loading");
  setErrorMsg("");

  try {
    // 1. Създаване на Stripe Checkout Session
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offer_id: offerId,
        amount,
        description,
        success_url: `${window.location.origin}/dashboard?paid=ok`,
        cancel_url: `${window.location.origin}/dashboard?paid=cancel`,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setErrorMsg(data.error || "Грешка при създаване на плащане");
      setStatus("error");
      return;
    }

    const { url } = await res.json();

    // 2. Пренасочване към Stripe Checkout
    window.location.href = url;
    // След завършване, Stripe пренасочва към success_url
  } catch {
    setErrorMsg("Възникна грешка. Опитай отново.");
    setStatus("error");
  }
};
```

**Интерфейсни промени:**
- Методът на плащане е фиксиран на Stripe (💳 Карта). Бутонът за банков превод остава, но при него се ползва старият `POST /api/payments` с метод `transfer`.
- Цената се показва в EUR: `{amount.toFixed(2)} €`

### 5.2. `OffersPanel.tsx` — малки промени

- `"лв"` → `"€"` в редове 181 и 226
- Ред 181: `{offer.price ? offer.price.toFixed(0) : "0"} €`
- Ред 226: `{offer.price ? offer.price.toFixed(0) : "0"} €`

### 5.3. `src/app/dashboard/page.tsx` — промени

**Ново: обработка на `?paid=ok` и `?paid=cancel` query params**

При зареждане на страницата (или във `useEffect`):

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("paid") === "ok") {
    showToast("✅ Плащането е успешно!");
    // Изчистване на URL параметъра (без презареждане)
    window.history.replaceState({}, "", "/dashboard");
    // Презареждане на оферти/данни
    loadFindings();
  } else if (params.get("paid") === "cancel") {
    showToast("❌ Плащането беше отказано");
    window.history.replaceState({}, "", "/dashboard");
  }
}, []);
```

**handleOpenPayment** остава същият — намира офертата и отваря PaymentPanel.

**handlePaymentComplete** вече не се вика директно след плащане (защото потребителят се връща през success_url). Може да се опрости или премахне.

### 5.4. Flow диаграма

```
Потребител в OffersPanel
  │
  ├─ Вижда оферта със статус "accepted"
  ├─ Натиска "💳 Плати сега (75€)"
  │
  ▼
Dashboard отваря PaymentPanel с amount/description/offerId
  │
  ├─ Потребител избира метод:
  │   ├─ 💳 Карта (Stripe) ───► POST /api/stripe/checkout
  │   │                            │
  │   │                            ├─ Stripe създава Checkout Session
  │   │                            ├─ Записва payment (pending) в DB
  │   │                            └─ Връща checkout URL
  │   │                            │
  │   │                            ▼
  │   │                         window.location.href = url
  │   │                            │
  │   │                            ▼
  │   │                         Stripe Checkout страница (hosted от Stripe)
  │   │                            │
  │   │                            ├─ Успех ──► success_url (/dashboard?paid=ok)
  │   │                            │              │
  │   │                            │              ├─ Stripe webhook → checkout.session.completed
  │   │                            │              ├─ DB: payment.status = "paid"
  │   │                            │              ├─ DB: offer.decision = "paid"
  │   │                            │              ├─ Генериране на фактура (PDF)
  │   │                            │              ├─ In-app нотификация
  │   │                            │              └─ Email до админ
  │   │                            │
  │   │                            └─ Отказ ──► cancel_url (/dashboard?paid=cancel)
  │   │
  │   └─ 🏦 Банков превод ───► POST /api/payments (method=transfer)
  │                               │
  │                               ├─ Записва payment (pending) в DB
  │                               └─ Админ ръчно потвърждава през админ панел
```

---

## 6. Автоматично генериране на фактура

### 6.1. Къде се случва

В **webhook handler**-а (`handleCheckoutCompleted`), след като плащането е маркирано като `paid`.

### 6.2. Функция `generateInvoice` (в `src/lib/invoices.ts` или в webhook файла)

```typescript
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { generateInvoicePdf } from "@/lib/pdf-invoice"; // нова функция

async function generateInvoice(paymentId: string, userId: string, amount: number) {
  const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

  const invoiceId = crypto.randomUUID();

  // Генериране на PDF
  let pdfPath: string | null = null;
  try {
    const pdfBuffer = await generateInvoicePdf({
      invoiceNumber,
      amount,
      currency: "EUR",
      userId,
      date: new Date(),
      paymentId,
    });
    const fs = await import("fs");
    const path = await import("path");
    const pdfDir = path.join(process.cwd(), "data", "invoices");
    if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
    pdfPath = path.join(pdfDir, `${invoiceId}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);
  } catch (e) {
    console.error("[invoice] PDF generation failed:", e);
  }

  // Запис в invoices таблица
  db.insert(invoices).values({
    id: invoiceId,
    user_id: userId,
    payment_id: paymentId,
    number: invoiceNumber,
    amount,
    description: `Фактура за плащане ${invoiceNumber}`,
    pdf_path: pdfPath,
  }).run();
}
```

### 6.3. PDF генериране за фактура (`src/lib/pdf-invoice.ts`)

Нова библиотечна функция, която създава професионална фактура с jsPDF:

- Заглавие "ФАКТУРА" с номер
- Дата на издаване
- Данни за клиента (от users таблицата: име, компания, ЕИК, VAT)
- Данни за доставчика (от organizations: име, адрес)
- Таблица с ред: описание, сума, ДДС
- Обща сума
- Бележка "Платено чрез Stripe"

---

## 7. Отказ от бутафорния mock

### 7.1. Какво се премахва / променя

| Компонент | Старо поведение | Ново поведение |
|-----------|----------------|----------------|
| `POST /api/payments` | Винаги insert-ва payment с status `pending` и клиентът вижда "✅ Платено!" веднага | Само за `method=transfer` (банков превод). За `method=stripe` клиентът се пренасочва към Stripe. |
| `PATCH /api/payments/[id]` | Позволява ръчна смяна на статус (за тестове) | Остава, но само за админи. Добавя се валидация за роля `admin`. |
| `PaymentPanel` статус "paid" | Показва се веднага след POST заявка | Показва се само след връщане от Stripe (чрез success_url query param), или остава скрит — Stripe hosted страницата показва свой success. |

### 7.2. Нова константа за статуси

```typescript
// src/lib/constants.ts (нов файл)
export const PAYMENT_STATUSES = {
  PENDING: "pending",      // чака плащане (Stripe session създадена)
  PAID: "paid",            // платено успешно
  FAILED: "failed",        // неуспешно плащане
  REFUNDED: "refunded",    // възстановено
  CANCELLED: "cancelled",  // отказано
} as const;

export const PAYMENT_METHODS = {
  STRIPE: "stripe",
  TRANSFER: "transfer",
  CASH: "cash",
} as const;
```

---

## 8. План за имплементация (checklist)

### Фаза 1: Подготовка (30 мин)

- [ ] **1.1.** Инсталиране на `stripe` npm пакет: `npm install stripe`
- [ ] **1.2.** Създаване на `src/lib/stripe.ts` (Stripe клиент singleton)
- [ ] **1.3.** Добавяне на `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` в `.env` / Coolify
- [ ] **1.4.** Обновяване на `.env.example`

### Фаза 2: База данни (20 мин)

- [ ] **2.1.** Обновяване на `src/db/schema.ts`:
  - `payments`: добавяне на `plan_id`, `currency`, `stripe_session_id`, `stripe_payment_intent_id`, `billing_reason`
  - `offers`: добавяне на `stripe_price_id`, `stripe_product_id`
  - `plans`: добавяне на `stripe_price_id`, `stripe_product_id`
- [ ] **2.2.** Обновяване на `src/db/index.ts` — `ALTER TABLE` редове за обратна съвместимост
- [ ] **2.3.** Генериране на миграция: `npx drizzle-kit generate` + `npx drizzle-kit push`

### Фаза 3: API ендпойнти (40 мин)

- [ ] **3.1.** Създаване на `src/app/api/stripe/checkout/route.ts`
- [ ] **3.2.** Създаване на `src/app/api/stripe/webhook/route.ts`
- [ ] **3.3.** Преработка на `src/app/api/payments/route.ts` (само за банков превод)
- [ ] **3.4.** Обновяване на `src/app/api/payments/[id]/route.ts` (admin-only validation)

### Фаза 4: Frontend (30 мин)

- [ ] **4.1.** Преработка на `PaymentPanel.tsx`:
  - `лв` → `€`
  - `handlePay` → извиква `/api/stripe/checkout` и пренасочва
  - Stripe метод е основен; банков превод остава като алтернатива
- [ ] **4.2.** Обновяване на `OffersPanel.tsx` — `лв` → `€`
- [ ] **4.3.** Обновяване на `dashboard/page.tsx`:
  - Обработка на `?paid=ok` и `?paid=cancel` query params
  - Премахване на излишния `handlePaymentComplete`

### Фаза 5: Автоматична фактура (20 мин)

- [ ] **5.1.** Създаване на `src/lib/pdf-invoice.ts` (генериране на фактура PDF)
- [ ] **5.2.** Интегриране на `generateInvoice()` в webhook handler

### Фаза 6: Тестване (30 мин)

- [ ] **6.1.** Локално тестване със Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
- [ ] **6.2.** Тестова карта `4242 4242 4242 4242` в Stripe test mode
- [ ] **6.3.** Проверка на:
  - [ ] Създаване на checkout session
  - [ ] Пренасочване към Stripe
  - [ ] Webhook обработка
  - [ ] Ъпдейт на payment статус
  - [ ] Ъпдейт на offer статус
  - [ ] Генериране на фактура PDF
  - [ ] Нотификации
  - [ ] Банков превод fallback

### Фаза 7: Деплой (15 мин)

- [ ] **7.1.** `npm run build` за проверка на грешки
- [ ] **7.2.** Push към GitHub → Coolify auto-deploy
- [ ] **7.3.** Задаване на production Stripe ключове в Coolify env vars
- [ ] **7.4.** Конфигуриране на production webhook endpoint в Stripe Dashboard: `https://comanda.blv.bg/api/stripe/webhook`

---

## 📁 Нови и променени файлове

```
НОВИ:
  src/lib/stripe.ts                          — Stripe клиент singleton
  src/app/api/stripe/checkout/route.ts       — POST — създава Checkout Session
  src/app/api/stripe/webhook/route.ts        — POST — обработва webhook събития
  src/lib/pdf-invoice.ts                     — генерира фактура PDF
  src/lib/constants.ts                       — статус/метод константи

ПРОМЕНЕНИ:
  src/db/schema.ts                           — нови колони в payments, offers, plans
  src/db/index.ts                            — ALTER TABLE за обратна съвместимост
  src/app/api/payments/route.ts              — само за банков превод
  src/app/api/payments/[id]/route.ts         — admin-only PATCH
  src/components/PaymentPanel.tsx            — Stripe redirect flow, EUR
  src/components/OffersPanel.tsx             — EUR вместо лв
  src/app/dashboard/page.tsx                 — обработка на ?paid=ok/cancel
  .env.example                               — Stripe env vars
  package.json                               — stripe dependency
```

---

## 🔒 Бележки за сигурност

1. **STRIPE_SECRET_KEY** никога не се expose-ва на клиента. Използва се само в API routes и `src/lib/stripe.ts`.
2. **STRIPE_WEBHOOK_SECRET** гарантира, че само Stripe може да извиква webhook-а.
3. **STRIPE_PUBLISHABLE_KEY** не е тайна — може да се ползва във frontend, но в този flow не е нужна (Stripe Checkout е hosted).
4. Всички API routes проверяват автентикация чрез `getSession()`.
5. Webhook handler **не** проверява автентикация (Stripe не изпраща нашата сесия). Верификацията е чрез подписа (`stripe.webhooks.constructEvent`).

---

## ⚡ Stripe CLI за локално тестване

```bash
# Инсталация (macOS)
brew install stripe/stripe-cli/stripe

# Linux
curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | sudo tee /usr/share/keyrings/stripe.gpg
echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | sudo tee /etc/apt/sources.list.d/stripe.list
sudo apt update && sudo apt install stripe

# Стартиране на webhook forwarding
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Ще изведе webhook signing secret — добави го в .env.local като STRIPE_WEBHOOK_SECRET

# Тригериране на тестово събитие
stripe trigger checkout.session.completed
```
