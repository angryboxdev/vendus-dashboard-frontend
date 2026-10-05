import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { MOTION_ENTER, MOTION_FADE, MOTION_RISE, RISE_STAGGER_MS, prefersReducedMotion, staggerDelay } from "./motion-core.ts";

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * Valor numérico animado do anterior para o atual (task §5). Na 1.ª
 * montagem parte de 0; depois parte sempre do valor mostrado (ex.: ao
 * mudar filtros, 12 → 9, não 0 → 9). Termina sempre exatamente no valor
 * real. Sem animação com movimento reduzido ou sem `requestAnimationFrame`.
 */
export function useAnimatedNumber(value: number, durationMs = 600): number {
  const reduced = prefersReducedMotion() || typeof requestAnimationFrame !== "function";
  const [display, setDisplay] = useState(() => (reduced ? value : 0));
  const displayRef = useRef(display);
  useEffect(() => {
    displayRef.current = display;
  });

  useEffect(() => {
    if (reduced) return;
    const from = displayRef.current;
    if (from === value) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setDisplay(t < 1 ? from + (value - from) * easeOutCubic(t) : value);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs, reduced]);

  return reduced ? value : display;
}

/**
 * Valor de progresso a mostrar: parte de 0 na montagem e acompanha `pct`
 * um frame depois (para a transição CSS correr). Com movimento reduzido é
 * sempre o valor atual.
 */
export function useAnimatedProgress(pct: number): number {
  const reduced = prefersReducedMotion() || typeof requestAnimationFrame !== "function";
  const [shown, setShown] = useState(reduced ? pct : 0);
  useEffect(() => {
    if (reduced) return;
    const frame = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(frame);
  }, [pct, reduced]);
  return reduced ? pct : shown;
}

/** Props de entrada para um item que não pode ser embrulhado (ex.: `<tr>`). */
export function motionItem(index: number): { className: string; style: { animationDelay: string } } {
  return { className: MOTION_ENTER, style: { animationDelay: staggerDelay(index) } };
}

const NO_IDS: ReadonlySet<string> = new Set();

/**
 * Listas (task §9–§10): as linhas do 1.º lote carregado entram com stagger
 * curto; as que aparecem depois (pesquisa, filtros, página) só com um fade
 * de 200 ms, sem atraso — e as que já estavam não voltam a animar (não são
 * remontadas). Use: `const firstBatch = useFirstBatch(rows.map(r => r.id))`
 * e `{...motionListItem(i, firstBatch.has(row.id))}` em cada linha.
 */
export function useFirstBatch(ids: readonly string[]): ReadonlySet<string> {
  const [first, setFirst] = useState<ReadonlySet<string> | null>(null);
  if (first === null && ids.length > 0) setFirst(new Set(ids));
  return first ?? NO_IDS;
}

export function motionListItem(index: number, inFirstBatch: boolean): { className: string; style?: { animationDelay: string } } {
  return inFirstBatch ? motionItem(index) : { className: MOTION_FADE };
}

/**
 * Linha de uma lista que sobe de baixo: as do 1.º lote em sequência (80 ms
 * entre cada, depois de `baseDelayMs`); uma que apareça depois (ex.: alerta
 * novo num refresh) sobe sozinha, sem atraso. As que já estavam não reanimam.
 */
export function motionRiseItem(index: number, inFirstBatch: boolean, baseDelayMs = 0): { className: string; style?: { animationDelay: string } } {
  if (!inFirstBatch) return { className: MOTION_RISE };
  return { className: MOTION_RISE, style: { animationDelay: `${baseDelayMs + parseInt(staggerDelay(index, RISE_STAGGER_MS), 10)}ms` } };
}

/** Microfeedback de sucesso (task §16): `flash()` mostra "✓ Guardado" durante ~1,8 s. */
export function useSuccessFlash(durationMs = 1800): { visible: boolean; flash: () => void } {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flash = useCallback(() => {
    setVisible(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), durationMs);
  }, [durationMs]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { visible, flash };
}

export const LeavingContext = createContext(false);

/** `true` enquanto o modal/drawer está a sair (dentro de `MotionPresence`). */
export function useMotionLeaving(): boolean {
  return useContext(LeavingContext);
}

/**
 * Último valor não nulo — para o conteúdo de um modal continuar visível
 * durante a saída depois de o estado que o abriu já ter sido limpo
 * (ex.: `const panel = useRetained(activePanel)`).
 */
export function useRetained<T>(value: T | null | undefined): T | null {
  const [retained, setRetained] = useState<T | null>(value ?? null);
  if (value !== null && value !== undefined && value !== retained) setRetained(value);
  return value ?? retained;
}
