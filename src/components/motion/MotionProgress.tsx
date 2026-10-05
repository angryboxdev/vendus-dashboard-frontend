import { useAnimatedProgress } from "./motion-hooks.ts";

/**
 * Barra de progresso que preenche até ao valor (task §2 `MotionProgress`,
 * §7, §14): 0 → 85% ao aparecer, 80% → 100% quando muda. Anima `transform`
 * (scaleX), nunca a largura — sem layout shift. Não repete.
 */
export function MotionProgress({
  value,
  label,
  trackClassName = "h-2 rounded-full bg-stone-100",
  barClassName = "rounded-full bg-emerald-500",
}: {
  /** 0–100. */
  value: number;
  label?: string;
  trackClassName?: string;
  barClassName?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const shown = useAnimatedProgress(pct);
  return (
    <div className={`overflow-hidden ${trackClassName}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <div
        className={`h-full w-full origin-left transition-transform duration-[600ms] ease-out motion-reduce:transition-none ${barClassName}`}
        style={{ transform: `scaleX(${shown / 100})` }}
      />
    </div>
  );
}
