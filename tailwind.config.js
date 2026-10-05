/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Amsi Pro AKS", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      // UI Motion MVP (src/components/motion) — só opacity/transform; usar
      // sempre com o prefixo `motion-safe:` (prefers-reduced-motion).
      keyframes: {
        "motion-fade": { from: { opacity: "0" }, to: { opacity: "1" } },
        "motion-fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "motion-fade-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "motion-slide-in-right": { from: { opacity: "0", transform: "translateX(16px)" }, to: { opacity: "1", transform: "translateX(0)" } },
        "motion-slide-out-right": { from: { opacity: "1", transform: "translateX(0)" }, to: { opacity: "0", transform: "translateX(16px)" } },
        "motion-pop-in": { from: { opacity: "0", transform: "translateY(8px) scale(0.99)" }, to: { opacity: "1", transform: "translateY(0) scale(1)" } },
        "motion-pop-out": { from: { opacity: "1", transform: "translateY(0) scale(1)" }, to: { opacity: "0", transform: "translateY(8px) scale(0.99)" } },
      },
      animation: {
        "motion-fade": "motion-fade 200ms ease-out both",
        "motion-fade-up": "motion-fade-up 220ms ease-out both",
        "motion-fade-out": "motion-fade-out 180ms ease-in both",
        "motion-slide-in-right": "motion-slide-in-right 220ms ease-out both",
        "motion-slide-out-right": "motion-slide-out-right 180ms ease-in both",
        "motion-pop-in": "motion-pop-in 200ms ease-out both",
        "motion-pop-out": "motion-pop-out 160ms ease-in both",
      },
    },
  },
  plugins: [],
};
