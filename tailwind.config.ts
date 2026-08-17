import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#e8f1f2",
          primary: "#1b98e0",
          secondary: "#247ba0",
          dark: "#006494",
          accent: "#a663cc",
        },
        state: {
          ok: "#16a34a",
          warning: "#d97706",
          danger: "#dc2626",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Bridge to the existing CSS custom properties in globals.css so
        // components can use utility classes instead of inline style={{}}.
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        muted: "var(--muted)",
        line: "var(--line)",
        "line-2": "var(--line-2)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        "accent-ink": "var(--accent-ink)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      spacing: {
        touch: "44px",
      },
      borderRadius: {
        sm: "var(--r-sm)",
        DEFAULT: "var(--r)",
        card: "12px",
        lg: "var(--r-lg)",
        xl: "var(--r-xl)",
        sheet: "20px",
      },
      boxShadow: {
        "card-1": "var(--sh-1)",
        "card-2": "var(--sh-2)",
        "card-3": "var(--sh-3)",
      },
      fontSize: {
        field: ["16px", "1.4"], // под 16px iOS зумва
      },
    },
  },
  plugins: [],
};
export default config;
