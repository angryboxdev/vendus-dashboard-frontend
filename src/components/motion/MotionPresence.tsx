import { useEffect, useState, type ReactNode } from "react";
import { prefersReducedMotion } from "./motion-core.ts";
import { LeavingContext } from "./motion-hooks.ts";

const EXIT_MS = 180;

/**
 * Mantém um modal/drawer montado durante a animação de saída (task §15 —
 * "fechamento igualmente suave"). Substitui `{open && <Modal/>}` por
 * `<MotionPresence show={open}><Modal/></MotionPresence>`; o modal lê
 * `useMotionLeaving()` para escolher a classe de entrada/saída
 * (`motionModal`/`motionDrawer`/`motionOverlay`). Sem animação (movimento
 * reduzido, testes), desmonta logo.
 */
export function MotionPresence({ show, children }: { show: boolean; children: ReactNode }) {
  const [prevShow, setPrevShow] = useState(show);
  const [lingering, setLingering] = useState(false);
  if (show !== prevShow) {
    // Ajuste durante o render (padrão React) — evita um render a mais.
    setPrevShow(show);
    setLingering(!show && !prefersReducedMotion());
  }

  useEffect(() => {
    if (!lingering) return;
    const t = setTimeout(() => setLingering(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [lingering]);

  if (!show && !lingering) return null;
  return <LeavingContext.Provider value={!show}>{children}</LeavingContext.Provider>;
}
