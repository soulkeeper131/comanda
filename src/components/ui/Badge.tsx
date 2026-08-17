type Tone = "ok" | "warning" | "danger" | "info" | "neutral" | "accent";

const TONES: Record<Tone, string> = {
  ok: "bg-state-ok/15 text-state-ok",
  warning: "bg-state-warning/15 text-state-warning",
  danger: "bg-state-danger/15 text-state-danger",
  info: "bg-brand-primary/15 text-brand-primary",
  accent: "bg-brand-accent/15 text-brand-accent",
  neutral: "bg-line text-ink-2",
};

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
};

export function Badge({ tone = "neutral", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold",
        TONES[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </span>
  );
}
