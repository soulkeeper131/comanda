import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";

/** Обща рамка за секциите на екрана на имота. */
export function Section({
  title,
  icon,
  action,
  children,
  emphasis = false,
}: {
  title: string;
  icon: IconName;
  action?: ReactNode;
  children: ReactNode;
  /** Водеща секция (последният обход) — по-силна сянка и рамка. */
  emphasis?: boolean;
}) {
  return (
    <Card
      padding="md"
      shadow={emphasis ? "md" : "sm"}
      className={emphasis ? "border-brand-primary/30" : ""}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
          <Icon name={icon} size={16} className={emphasis ? "text-brand-primary" : ""} />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning" | "danger" | "ok";
  children: ReactNode;
}) {
  const cls = {
    info: "bg-brand-primary/10 text-brand-dark",
    warning: "bg-state-warning/10 text-state-warning",
    danger: "bg-state-danger/10 text-state-danger",
    ok: "bg-state-ok/10 text-state-ok",
  }[tone];
  return <div className={`rounded-card px-3 py-2 text-sm ${cls}`}>{children}</div>;
}
