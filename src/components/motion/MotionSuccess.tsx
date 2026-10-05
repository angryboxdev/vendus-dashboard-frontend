import { MOTION_FADE } from "./motion-core.ts";

/** "✓ Guardado" discreto (task §16) — sem confettis nem animações longas. Use com `useSuccessFlash()`. */
export function MotionSuccess({ visible, label = "Guardado" }: { visible: boolean; label?: string }) {
  if (!visible) return null;
  return (
    <span role="status" className={`inline-flex items-center gap-1 text-xs font-medium text-emerald-700 ${MOTION_FADE}`}>
      <span aria-hidden="true">✓</span>
      {label}
    </span>
  );
}
