import { useAnimatedNumber } from "./motion-hooks.ts";

/**
 * Mostra `value` animado do valor anterior para o atual (task §2
 * `MotionNumber`, §5), com a mesma formatação de sempre (`format`) — só o
 * número muda durante a animação; o texto à volta não anima. Números
 * inteiros mostram-se inteiros durante a contagem; termina sempre no
 * valor real.
 */
export function MotionNumber({ value, format, durationMs }: { value: number; format?: (n: number) => string; durationMs?: number }) {
  const animated = useAnimatedNumber(value, durationMs);
  const shown = Number.isInteger(value) ? Math.round(animated) : animated;
  return <span className="tabular-nums">{format ? format(shown) : String(shown)}</span>;
}
