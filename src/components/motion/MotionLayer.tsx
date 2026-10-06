import type { HTMLAttributes } from "react";
import { motionDrawer, motionModal, motionOverlay } from "./motion-core.ts";
import { useMotionLeaving } from "./motion-hooks.ts";

type MotionLayerProps = {
  as?: "div" | "aside" | "section" | "form";
  /** `overlay` = fundo escurecido; `drawer` = painel lateral; `modal` = caixa centrada. */
  kind: "overlay" | "drawer" | "modal";
} & HTMLAttributes<HTMLElement>;

const CLASS_BY_KIND = { overlay: motionOverlay, drawer: motionDrawer, modal: motionModal };

/**
 * Camada de modal/drawer com o padrão global de entrada e saída (task
 * §15): troca o `<div>`/`<aside>` exterior por `<MotionLayer kind=…>`
 * mantendo todas as props. Dentro de `MotionPresence` anima também a
 * saída; fora dela, só a entrada.
 */
export function MotionLayer({ as: Tag = "div", kind, className = "", ...rest }: MotionLayerProps) {
  const leaving = useMotionLeaving();
  return <Tag className={`${className} ${CLASS_BY_KIND[kind](leaving)}`.trim()} {...rest} />;
}
