import { Children, type ReactNode } from "react";
import { MOTION_ENTER, staggerDelay } from "./motion-core.ts";

/**
 * Entrada sequencial de um grupo de cartões (task §2 `MotionStagger`, §4):
 * cada filho entra ~50 ms depois do anterior, com o total limitado. Os
 * filhos ficam embrulhados numa caixa que ocupa a célula toda da grelha
 * (`[&>*]:h-full`), por isso a disposição não muda. Para linhas de
 * tabela (onde não pode haver embrulho) use `motionItem` (motion-hooks).
 */
export function MotionStagger({
  children,
  className = "",
  itemClassName = "",
  startIndex = 0,
}: {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
  /** Para continuar a sequência de um grupo anterior (ex.: 2.ª coluna de KPIs). */
  startIndex?: number;
}) {
  return (
    <div className={className}>
      {Children.toArray(children).map((child, i) => (
        <div key={i} className={`${MOTION_ENTER} [&>*]:h-full ${itemClassName}`.trim()} style={{ animationDelay: staggerDelay(startIndex + i) }}>
          {child}
        </div>
      ))}
    </div>
  );
}

