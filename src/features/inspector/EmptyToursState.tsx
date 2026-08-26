import { Card } from "@/components/ui/Card";

/**
 * Инспектор без нито един възложен обход (нито просрочен, нито предстоящ).
 * Не счупен екран, не празна страница — обяснение какво означава това.
 */
export default function EmptyToursState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <Card padding="lg" shadow="sm" className="max-w-md w-full space-y-3">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-bg text-3xl">
          📋
        </div>
        <h2 className="text-lg font-bold text-ink">Нямате възложени обходи</h2>
        <p className="text-sm text-muted">
          Тук ще виждате седмичния си график, щом ви бъде възложен обход —
          адрес, клиент и какво трябва да проверите.
        </p>
      </Card>
    </div>
  );
}
