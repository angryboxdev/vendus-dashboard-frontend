/**
 * UI Motion MVP — núcleo partilhado (task "UI Motion MVP — Visão Geral +
 * Colaboradores"). Sem biblioteca externa: animações CSS (só `opacity` e
 * `transform`, keyframes em `tailwind.config.js`) sempre com o prefixo
 * `motion-safe:` — com `prefers-reduced-motion` nada se desloca. As
 * classes ficam aqui, num só sítio, para todas as telas usarem o mesmo
 * padrão (nunca animações avulsas por componente).
 *
 * Velocidades (task §3): hover 150 ms · fade 200 ms · cartões/painéis
 * 220 ms · tabs 200 ms · KPIs/progresso 600 ms.
 */

/** Movimento reduzido pedido pelo sistema — ou ambiente sem `matchMedia` (testes/SSR): nesse caso não se anima nada. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Entrada de cartões/linhas/blocos: fade + 6 px para cima. */
export const MOTION_ENTER = "motion-safe:animate-motion-fade-up";
/**
 * Linha que "sobe de baixo" (16 px, 250 ms) — listas dentro de um painel
 * (ex.: Alertas prioritários). O contentor deve recortar (`overflow-hidden`)
 * para nada aparecer fora do painel durante a animação.
 */
export const MOTION_RISE = "motion-safe:animate-motion-rise";
/** Intervalo entre linhas que sobem (70–90 ms pedidos). */
export const RISE_STAGGER_MS = 80;
/** Só fade — conteúdo de tabs (sem deslocamento, nunca layout shift) e trocas de estado. */
export const MOTION_FADE = "motion-safe:animate-motion-fade";

/** Hover discreto de cartões (pequena elevação + sombra) e pressão subtil nos clicáveis. */
export const MOTION_CARD_HOVER =
  "transition-[transform,box-shadow,background-color,border-color] duration-150 ease-out motion-safe:hover:-translate-y-0.5 hover:shadow-md motion-safe:active:translate-y-0 motion-safe:active:scale-[0.995]";
/** Hover de linhas de lista/tabela: só cor de fundo — nunca desloca a linha. */
export const MOTION_ROW_HOVER = "transition-colors duration-150 hover:bg-[#FDF8F5]";

/** Fundo escurecido de modais/drawers. */
export function motionOverlay(leaving: boolean): string {
  return leaving ? "motion-safe:animate-motion-fade-out" : "motion-safe:animate-motion-fade";
}
/** Drawer lateral (entra da direita). */
export function motionDrawer(leaving: boolean): string {
  return leaving ? "motion-safe:animate-motion-slide-out-right" : "motion-safe:animate-motion-slide-in-right";
}
/** Modal centrado (fade + pequeno deslocamento). */
export function motionModal(leaving: boolean): string {
  return leaving ? "motion-safe:animate-motion-pop-out" : "motion-safe:animate-motion-pop-in";
}

export const STAGGER_STEP_MS = 50;
/** A partir daqui não há mais atraso — listas grandes nunca entram "linha a linha" devagar (task §9). */
export const STAGGER_MAX_ITEMS = 8;

/** Atraso de entrada do item `index` num grupo (limitado: o stagger total fica ≤ 350 ms). */
export function staggerDelay(index: number, step = STAGGER_STEP_MS, maxItems = STAGGER_MAX_ITEMS): string {
  return `${Math.min(index, maxItems - 1) * step}ms`;
}
