import type { ReactNode } from "react";

/**
 * Expandir/recolher conteúdo (task §2 `MotionCollapse`): altura animada
 * pelo truque `grid-template-rows` 0fr ↔ 1fr (sem medir alturas em JS),
 * 200 ms. Fechado, o conteúdo fica fora da árvore de acessibilidade e do foco.
 */
export function MotionCollapse({ open, children, className = "" }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"} ${className}`.trim()}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
