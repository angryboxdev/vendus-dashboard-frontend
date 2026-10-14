import { lazy, Suspense, useCallback, useRef, useState } from "react";
import type { AppliedBatch } from "../../../domain/entities/assistant.ts";
import { isDrag } from "../../../domain/services/assistant.service.ts";
import { MezzaIcon } from "./MezzaIcon.tsx";

// O chat (e a voz) só é carregado quando a pessoa abre o assistente.
const AssistantPanel = lazy(() => import("./AssistantPanel.tsx"));

export interface AssistantHostContext {
  rosterId: string;
  rosterName: string;
  from: string;
  to: string;
  pending: number;
}

const SNAP_MS = 250;
/** Tamanho da bolinha (56 px − 30%). */
const SIZE = 40;
/** Luz traseira cobre/laranja (não néon). */
const GLOW = { background: "radial-gradient(circle, rgba(248,155,70,0.9) 0%, rgba(240,100,45,0.5) 45%, rgba(237,92,50,0) 72%)" };
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Bolinha do Assistente Mezza (começa no canto inferior direito). Custo quase
 * zero: só o ícone. Arrastar move-a (transform, sem estado React por frame);
 * ao soltar volta sempre à lateral direita, à altura onde foi largada (dentro
 * do ecrã; não fica guardada entre visitas). Clicar (sem arrastar) abre o chat.
 */
export function MezzaAssistantButton({
  context,
  onApplied,
  onTemplatesChanged,
  onPublishFlow,
}: {
  context: AssistantHostContext;
  onApplied: (a: AppliedBatch) => void;
  onTemplatesChanged: () => void;
  onPublishFlow: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(false);
  const openRef = useRef(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; id: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const off = currentOffset(e.currentTarget);
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y, id: e.pointerId, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.currentTarget.style.transition = "none";
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && !isDrag(dx, dy)) return;
    d.moved = true;
    // Só dentro da área visível (o canto inferior direito é a posição base).
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const off = currentOffset(el);
    const left = r.left - off.x;
    const top = r.top - off.y;
    const x = Math.min(Math.max(d.ox + dx, -left + 8), window.innerWidth - left - r.width - 8);
    const y = Math.min(Math.max(d.oy + dy, -top + 8), window.innerHeight - top - r.height - 8);
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };
  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    suppressClick.current = true;
    const el = e.currentTarget;
    el.style.transition = reducedMotion() ? "none" : `transform ${SNAP_MS}ms cubic-bezier(.2,.7,.2,1)`;
    // Volta à lateral direita, mantendo a altura onde foi largada.
    el.style.transform = `translate3d(0px, ${currentOffset(el).y}px, 0)`;
  };
  const onClick = () => {
    // Um arrasto termina com um "click" do browser: não abre o chat.
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setLoaded(true);
    setOpen(true);
    openRef.current = true;
    setUnread(false);
  };
  const close = useCallback(() => {
    setOpen(false);
    openRef.current = false;
  }, []);
  const onReply = useCallback(() => {
    if (!openRef.current) setUnread(true);
  }, []);

  return (
    <>
      <div className="pointer-events-none fixed bottom-6 right-6 z-30">
        <button
          type="button"
          aria-label="Assistente Mezza"
          aria-haspopup="dialog"
          aria-expanded={open}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={onClick}
          className="group pointer-events-auto relative block h-10 w-10 touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2"
        >
          {/* Brilho cobre por trás (luz traseira, não néon); pulsa só a processar. */}
          <span aria-hidden="true" style={GLOW} className={`absolute -inset-3 rounded-full blur-[5px] transition-transform duration-200 group-hover:scale-110 ${busy ? "motion-safe:animate-pulse" : ""}`} />
          <span aria-hidden="true" className="absolute inset-0 rounded-full shadow-[0_4px_12px_rgba(10,22,63,0.35)]" />
          <MezzaIcon size={SIZE} className="relative" />
          {unread && <span data-testid="assistant-unread" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#ED5C32]" />}
          <span className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-navy-900 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-pop transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
            Assistente Mezza
          </span>
        </button>
      </div>
      {loaded && (
        <Suspense fallback={null}>
          <AssistantPanel open={open} onClose={close} context={context} onApplied={onApplied} onTemplatesChanged={onTemplatesChanged} onPublishFlow={onPublishFlow} onBusy={setBusy} onReply={onReply} />
        </Suspense>
      )}
    </>
  );
}

function currentOffset(el: HTMLElement): { x: number; y: number } {
  const m = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec(el.style.transform);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 0, y: 0 };
}
