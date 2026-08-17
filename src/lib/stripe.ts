import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Lazy Stripe клиент — инициализира се само при нужда.
 * Избягва build-time грешки когато env променливите липсват.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY || "";
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    _stripe = new Stripe(key, {
      // Версията трябва да съвпада с тази, която инсталираният SDK очаква.
      apiVersion: "2026-07-29.dahlia",
      typescript: true,
    });
  }
  return _stripe;
}

/**
 * Като `getStripe()`, но връща `null` вместо да хвърля, когато ключът липсва.
 * За routes, които трябва да отговорят с "плащанията не са настроени",
 * а не да се сринат.
 */
export function getStripeOrNull(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return getStripe();
}

/**
 * Проверява дали Stripe е конфигуриран.
 */
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;
}

/**
 * Валидира минимална сума за Stripe (0.50 EUR).
 */
export function validateStripeAmount(amount: number): boolean {
  return amount >= 0.5;
}

/**
 * Stripe обработва суми в най-малката валутна единица (центове за EUR).
 * Преобразува евро → центове.
 */
export function eurToCents(eur: number): number {
  return Math.round(eur * 100);
}

/**
 * Връща Stripe webhook secret от env.
 */
export function getWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET || "";
}
