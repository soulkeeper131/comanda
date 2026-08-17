"use client";

import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-gradient-to-br from-brand-primary to-brand-dark text-white shadow-card-1 hover:brightness-105 active:brightness-95",
  secondary:
    "bg-white text-brand-secondary border border-brand-primary/20 hover:bg-brand-bg",
  ghost: "bg-transparent text-brand-secondary hover:bg-brand-bg",
  danger: "bg-state-danger text-white hover:brightness-90 active:brightness-95",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-[36px] px-3 text-sm",
  md: "min-h-touch px-4 text-base",
  lg: "min-h-[52px] px-6 text-lg",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", fullWidth = false, className = "", ...props }, ref) => (
    <button
      ref={ref}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-card font-semibold",
        "transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  ),
);
Button.displayName = "Button";
