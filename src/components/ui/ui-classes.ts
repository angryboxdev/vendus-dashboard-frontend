/**
 * Design System Mezza (premium) — classes partilhadas (Tailwind) ligadas aos
 * tokens de `src/styles/index.css` (cores `navy`, `brand`, `surface`, `ink`,
 * `line`). Fonte única dos valores usados por `components/ui`; os ecrãs usam
 * os componentes e, quando precisam de um elemento nativo (input, tabela),
 * estas classes. Cobre = ação principal e destaque; navy = estrutura e
 * texto; verde/âmbar/vermelho só para estados. Sem HEX soltos.
 */

/** Cores da marca em HEX — só para casos que não aceitam classes (ex.: PDF, canvas, `style`). */
export const BRAND = {
  primary: "#C9643A",
  primaryHover: "#D67549",
  primarySoft: "#F7E8DF",
  navy: "#19213A",
  border: "#E6E8EC",
  pageBg: "#F8F7F4",
  hoverBg: "#F3F4F3",
} as const;

/** Fundo das páginas da área de gestão. */
export const PAGE_BG = "bg-surface-app";
/** Superfície (painel, tabela): branco, borda suave, sombra quase impercetível. */
export const SURFACE = "rounded-2xl border border-line bg-surface-card shadow-card";
/** Separador entre blocos/linhas. */
export const DIVIDER = "border-line-subtle";

/** Foco visível por teclado (cobre subtil, sem glow). */
export const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1";

/** Campos de formulário e filtros — mesma altura, raio 12, foco cobre subtil. */
export const FIELD =
  "h-10 rounded-xl border border-line bg-surface-card px-3 text-sm text-ink outline-none transition duration-150 placeholder:text-ink-muted hover:border-navy-900/25 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-ink-muted aria-[invalid=true]:border-red-400";
export const LABEL = "mb-1.5 block text-xs font-medium text-ink-secondary";

/** Tabelas: linhas confortáveis, pouca borda, sem divisórias verticais. */
export const TABLE = "min-w-full text-sm";
export const THEAD = "border-b border-line-subtle";
export const TH = "px-4 py-3 text-left text-xs font-medium text-ink-secondary";
export const TD = "px-4 py-3 align-middle text-ink";
export const TR = "border-b border-line-subtle last:border-0 transition-colors duration-150 hover:bg-surface-soft/60";

/** Texto. */
export const TEXT_MUTED = "text-ink-secondary";
export const PAGE_TITLE = "text-[28px] font-bold leading-tight tracking-tight text-navy-900 sm:text-[36px]";
export const SECTION_TITLE = "text-sm font-semibold text-navy-900";
/** Horas, percentagens e números alinhados. */
export const NUMERIC = "tabular-nums";

/** Popovers, menus e dropdowns: branco, raio alto, sombra leve. */
export const POPOVER = "rounded-2xl border border-line bg-surface-card p-1.5 shadow-pop";
export const MENU_ITEM =
  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-ink transition-colors duration-150 hover:bg-surface-soft focus-visible:bg-surface-soft focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

/** Botões: primário = cobre preenchido (um dominante por contexto); secundário = contorno navy; terciário = texto; perigo = destrutivo. */
export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger";

const BASE = `inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`;
const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-600",
  secondary: "border border-navy-900/20 bg-surface-card text-navy-900 hover:border-navy-900/35 hover:bg-surface-soft",
  tertiary: "text-brand-600 hover:text-brand-500 hover:underline",
  danger: "border border-red-200 bg-surface-card text-red-700 hover:bg-red-50",
};
const SIZE = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm" };

export function buttonClass(variant: ButtonVariant = "secondary", size: "sm" | "md" = "md"): string {
  return `${BASE} ${VARIANT[variant]} ${variant === "tertiary" ? "px-0 py-0 text-sm" : SIZE[size]}`;
}

/** Botão só com ícone (precisa de `aria-label`). */
export function iconButtonClass(size: "sm" | "md" = "md"): string {
  return `inline-flex shrink-0 items-center justify-center rounded-xl text-ink-secondary transition-colors duration-150 hover:bg-surface-soft hover:text-navy-900 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING} ${size === "sm" ? "h-8 w-8" : "h-10 w-10"}`;
}
