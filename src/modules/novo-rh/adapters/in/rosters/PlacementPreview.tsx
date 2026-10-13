import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ShiftCard } from "../../../../../components/ui/index.ts";
import type { ShiftTemplate } from "../../../domain/entities/rosters.ts";
import { hoursLabel, segmentLabel, segmentsMinutes, templateTone } from "../../../domain/services/roster-board.service.ts";

/**
 * O turno escolhido em "Atribuir turnos" acompanha o cursor até se escolher
 * a célula. Leve: um só `pointermove` enquanto está aberto, posição escrita
 * no estilo por `requestAnimationFrame` (sem estado React → a grelha não
 * volta a desenhar), `pointer-events: none` (não tapa os cliques).
 */
export function PlacementPreview({ tone, label }: { tone: ShiftTemplate | null; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      el.style.transform = `translate3d(${x + 14}px, ${y + 16}px, 0)`;
      el.style.opacity = "1";
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  const segs = tone?.segments ?? [];
  return createPortal(
    <div ref={ref} aria-hidden="true" data-testid="placement-preview" className="ds pointer-events-none fixed left-0 top-0 z-50 font-sans opacity-0 transition-opacity duration-100" style={{ transform: "translate3d(-999px, -999px, 0)" }}>
      {tone ? (
        <ShiftCard variant="placement-preview" tone={templateTone(tone)} title={label} times={segs.map(segmentLabel)} hours={hoursLabel(segmentsMinutes(segs))} />
      ) : (
        <div className="w-28 rounded-lg bg-surface-soft px-2 py-2 text-[12px] font-semibold text-ink-secondary opacity-90 shadow-pop">{label}</div>
      )}
    </div>,
    document.body,
  );
}
