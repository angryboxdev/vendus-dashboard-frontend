/**
 * Paleta do POS (especificação de 2026-11-04, bege e laranja do Mezza), só
 * dentro do POS. Classes completas — o Tailwind só gera o que vê escrito.
 */
export const POS = {
  page: "bg-[#f6efe5] text-[#2b2420]",
  card: "bg-[#fffbf5]",
  secondary: "bg-[#efe4d4]",
  muted: "bg-[#f0e6d8]",
  mutedText: "text-[#7d6b5a]",
  border: "border-[#e7d9c6]",
  accent: "bg-[#f5dfc8] text-[#9a3412]",
  primary: "bg-[oklch(0.5925_0.1959_35.779)] text-white hover:brightness-95 disabled:opacity-50",
  primaryRing: "ring-2 ring-[oklch(0.5925_0.1959_35.779)]",
  primaryText: "text-[oklch(0.5925_0.1959_35.779)]",
  key: "bg-[#3b2f28] text-white active:brightness-125",
  green: "bg-emerald-700/15 text-emerald-700",
  red: "bg-red-600/10 text-red-700",
  amber: "bg-amber-800/20 text-amber-800",
  radius: "rounded-2xl",
  num: "tabular-nums",
} as const;

/** Botão grande para toque (48–64 px). */
export const TOUCH = "min-h-12 rounded-xl px-4 font-semibold transition";
