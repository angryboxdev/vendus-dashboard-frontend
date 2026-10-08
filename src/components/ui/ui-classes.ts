/**
 * Identidade visual do Mezza ERP — classes partilhadas (Tailwind).
 * Fonte única dos valores usados por `components/ui`; os ecrãs usam os
 * componentes e, quando precisam de um elemento nativo (input, tabela),
 * estas classes. Decisões (2026-10-08): botão principal em gradiente laranja,
 * bordas creme, neutros quentes (`stone`), ícones SVG simples.
 */

/** Cores da marca (para casos que não cabem numa classe). */
export const BRAND = {
  primary: "#ED5C32",
  primaryTo: "#EF8935",
  border: "#F5C992",
  pageBg: "#FAF6F3",
  hoverBg: "#FDF8F5",
} as const;

/** Fundo das páginas da área de gestão. */
export const PAGE_BG = "bg-[#FAF6F3]";
/** Superfície (cartão, tabela, painel): branco, borda creme, sombra mínima. */
export const SURFACE = "rounded-xl border border-[#F5C992]/40 bg-white shadow-sm";
/** Separador entre blocos/linhas. */
export const DIVIDER = "border-[#F5C992]/40";

/** Campos de formulário e filtros — mesma altura e foco discreto. */
export const FIELD = "rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 outline-none transition focus:border-[#ED5C32] disabled:bg-stone-100 disabled:text-stone-500";
export const LABEL = "mb-1 block text-xs font-medium text-stone-600";

/** Tabelas compactas. */
export const TABLE = "min-w-full text-sm";
export const THEAD = "border-b border-[#F5C992]/40 bg-stone-50/60";
export const TH = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500";
export const TD = "px-3 py-2.5 align-middle text-stone-700";
export const TR = "border-b border-stone-100 last:border-0 transition-colors duration-150 hover:bg-[#FDF8F5]";

/** Texto. */
export const TEXT_MUTED = "text-stone-500";
export const SECTION_TITLE = "text-sm font-semibold text-stone-900";

/** Botões: primário = gradiente laranja (decisão 2026-10-08); secundário = branco com borda; terciário = texto; perigo = destrutivo. */
export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger";

const BASE = "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition duration-150 disabled:cursor-not-allowed disabled:opacity-50";
const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-gradient-to-r from-[#ED5C32] to-[#EF8935] text-white shadow-sm hover:opacity-90",
  secondary: "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50",
  tertiary: "text-[#ED5C32] hover:underline",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
};
const SIZE = { sm: "px-2.5 py-1 text-xs", md: "px-3.5 py-2 text-sm" };

export function buttonClass(variant: ButtonVariant = "secondary", size: "sm" | "md" = "md"): string {
  return `${BASE} ${VARIANT[variant]} ${variant === "tertiary" ? "px-0 py-0 text-sm" : SIZE[size]}`;
}
