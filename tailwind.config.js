/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // Design System Mezza — cores ligadas às variáveis de src/styles/index.css.
      colors: {
        navy: { 950: "rgb(var(--navy-950) / <alpha-value>)", 900: "rgb(var(--navy-900) / <alpha-value>)", 800: "rgb(var(--navy-800) / <alpha-value>)" },
        brand: { 600: "rgb(var(--brand-600) / <alpha-value>)", 500: "rgb(var(--brand-500) / <alpha-value>)", 100: "rgb(var(--brand-100) / <alpha-value>)", 50: "rgb(var(--brand-50) / <alpha-value>)" },
        surface: { app: "rgb(var(--surface-app) / <alpha-value>)", soft: "rgb(var(--surface-soft) / <alpha-value>)", card: "rgb(var(--surface-card) / <alpha-value>)" },
        ink: { DEFAULT: "rgb(var(--text-primary) / <alpha-value>)", secondary: "rgb(var(--text-secondary) / <alpha-value>)", muted: "rgb(var(--text-muted) / <alpha-value>)" },
        line: { DEFAULT: "rgb(var(--border-soft) / <alpha-value>)", subtle: "rgb(var(--border-subtle) / <alpha-value>)" },
        shift: {
          "morning-bg": "rgb(var(--shift-morning-bg) / <alpha-value>)", "morning-line": "rgb(var(--shift-morning-line) / <alpha-value>)", "morning-ink": "rgb(var(--shift-morning-ink) / <alpha-value>)",
          "afternoon-bg": "rgb(var(--shift-afternoon-bg) / <alpha-value>)", "afternoon-line": "rgb(var(--shift-afternoon-line) / <alpha-value>)", "afternoon-ink": "rgb(var(--shift-afternoon-ink) / <alpha-value>)",
          "night-bg": "rgb(var(--shift-night-bg) / <alpha-value>)", "night-line": "rgb(var(--shift-night-line) / <alpha-value>)", "night-ink": "rgb(var(--shift-night-ink) / <alpha-value>)",
          "split-bg": "rgb(var(--shift-split-bg) / <alpha-value>)", "split-line": "rgb(var(--shift-split-line) / <alpha-value>)", "split-ink": "rgb(var(--shift-split-ink) / <alpha-value>)",
          "other-bg": "rgb(var(--shift-other-bg) / <alpha-value>)", "other-line": "rgb(var(--shift-other-line) / <alpha-value>)", "other-ink": "rgb(var(--shift-other-ink) / <alpha-value>)",
        },
      },
      borderRadius: { "2.5xl": "20px" },
      boxShadow: {
        // Quase impercetível em cartões; um pouco mais em popovers, menus e drawers.
        card: "0 1px 2px rgb(18 24 43 / 0.04)",
        pop: "0 8px 24px -6px rgb(18 24 43 / 0.12), 0 2px 6px rgb(18 24 43 / 0.05)",
      },
      fontFamily: {
        sans: ["Poppins", "Amsi Pro AKS", "ui-sans-serif", "system-ui", "sans-serif"],
        // Barra lateral mantém a fonte de antes (pedido do utilizador, 2026-10-12).
        legacy: ["Amsi Pro AKS", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      // UI Motion MVP (src/components/motion) — só opacity/transform; usar
      // sempre com o prefixo `motion-safe:` (prefers-reduced-motion).
      // As entradas acabam em `transform: none`: com fill-mode "both", um
      // transform final deixaria cada bloco num contexto de empilhamento
      // próprio e os menus/popovers ficariam por trás do bloco seguinte.
      keyframes: {
        "motion-fade": { from: { opacity: "0" }, to: { opacity: "1" } },
        "motion-fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
        "motion-fade-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "motion-slide-in-right": { from: { opacity: "0", transform: "translateX(16px)" }, to: { opacity: "1", transform: "none" } },
        "motion-slide-out-right": { from: { opacity: "1", transform: "translateX(0)" }, to: { opacity: "0", transform: "translateX(16px)" } },
        "motion-pop-in": { from: { opacity: "0", transform: "translateY(8px) scale(0.99)" }, to: { opacity: "1", transform: "none" } },
        "motion-pop-out": { from: { opacity: "1", transform: "translateY(0) scale(1)" }, to: { opacity: "0", transform: "translateY(8px) scale(0.99)" } },
        "motion-rise": { from: { opacity: "0", transform: "translateY(18px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        "motion-fade": "motion-fade 200ms ease-out both",
        "motion-fade-up": "motion-fade-up 220ms ease-out both",
        "motion-fade-out": "motion-fade-out 180ms ease-in both",
        "motion-slide-in-right": "motion-slide-in-right 220ms ease-out both",
        "motion-slide-out-right": "motion-slide-out-right 180ms ease-in both",
        "motion-pop-in": "motion-pop-in 200ms ease-out both",
        "motion-pop-out": "motion-pop-out 160ms ease-in both",
        "motion-rise": "motion-rise 280ms ease-out both",
      },
    },
  },
  plugins: [],
};
