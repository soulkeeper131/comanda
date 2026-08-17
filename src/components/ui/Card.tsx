import { forwardRef } from "react";

type Padding = "none" | "sm" | "md" | "lg";
type Shadow = "none" | "sm" | "md" | "lg";

const PADDING: Record<Padding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const SHADOW: Record<Shadow, string> = {
  none: "",
  sm: "shadow-card-1",
  md: "shadow-card-2",
  lg: "shadow-card-3",
};

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  padding?: Padding;
  shadow?: Shadow;
  bordered?: boolean;
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ padding = "md", shadow = "sm", bordered = true, className = "", ...props }, ref) => (
    <div
      ref={ref}
      className={[
        "bg-white rounded-lg",
        bordered ? "border border-line" : "",
        PADDING[padding],
        SHADOW[shadow],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  ),
);
Card.displayName = "Card";
