import type { Config } from "tailwindcss";

// PredictMind design tokens (see predictmind/app docs/13-design-system.md)
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: "#7B61FF",
        secondary: "#00D4FF",
        accent: "#8B5CF6",
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444",
        info: "#3B82F6",
        background: "#0B1020",
        surface: "#121A2D",
        elevated: "#1A243B",
        border: "#26324D",
      },
    },
  },
  plugins: [],
};

export default config;
