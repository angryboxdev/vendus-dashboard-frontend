import type { CSSProperties, ElementType, ReactNode } from "react";
import { MOTION_ENTER, MOTION_FADE } from "./motion-core.ts";

/**
 * Entrada suave (task §2 `MotionFade`). `variant="fade"` não desloca —
 * para conteúdo de tabs e trocas de estado (use `key` para reanimar quando
 * o conteúdo muda, ex.: `<MotionFade key={tab}>`).
 */
export function MotionFade({
  as: Tag = "div",
  variant = "fade-up",
  delayMs,
  className = "",
  style,
  children,
}: {
  as?: ElementType;
  variant?: "fade" | "fade-up";
  delayMs?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <Tag className={`${variant === "fade" ? MOTION_FADE : MOTION_ENTER} ${className}`.trim()} style={delayMs ? { ...style, animationDelay: `${delayMs}ms` } : style}>
      {children}
    </Tag>
  );
}
