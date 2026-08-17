import { forwardRef } from "react";

// 16px+ font-size is required on all inputs — below that, iOS Safari zooms
// in on focus. See AGENTS.md "Mobile-first" rule.
const BASE =
  "w-full min-h-touch px-4 py-3 rounded-xl border border-line bg-white text-field " +
  "transition-colors outline-none focus:border-brand-primary focus:shadow-[0_0_0_3px_rgba(27,152,224,0.1)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-muted";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", ...props }, ref) => (
    <input ref={ref} className={[BASE, className].filter(Boolean).join(" ")} {...props} />
  ),
);
Input.displayName = "Input";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", ...props }, ref) => (
    <textarea
      ref={ref}
      className={[BASE, "min-h-[80px] resize-y", className].filter(Boolean).join(" ")}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", children, ...props }, ref) => (
    <select
      ref={ref}
      className={[BASE, "appearance-none bg-no-repeat", className].filter(Boolean).join(" ")}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2378879E' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 14px center",
      }}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";
