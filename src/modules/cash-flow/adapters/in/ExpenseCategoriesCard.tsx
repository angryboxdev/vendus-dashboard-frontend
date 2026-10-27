import { useState } from "react";
import { Link } from "react-router-dom";
import { IconChevronDown, SURFACE, SECTION_TITLE, StatusBadge, buttonClass } from "../../../../components/ui/index.ts";
import type { CashFlowCategory } from "../../domain/entities/cash-flow.ts";
import { pctChange, sharePct } from "../../domain/services/cash-flow-view.ts";
import { Delta } from "./cash-flow-ui.tsx";
import { euros, kindLabel } from "./cash-flow-format.ts";

const TOP = 3;
const BAR_TONES = ["bg-brand-600", "bg-brand-500/70", "bg-brand-500/45"];

const categoryName = (c: CashFlowCategory) => (c.type === "group" ? (c.name ?? "Sem nome") : kindLabel(c.movementKind));

function CategoryRow({ category, index, total, prevMonth }: { category: CashFlowCategory; index: number; total: number; prevMonth: string }) {
  const [open, setOpen] = useState(false);
  const share = sharePct(category.amountCents, total);
  const expandable = category.children.length > 0;
  const tone = category.type === "unclassified" ? "bg-ink-muted/40" : (BAR_TONES[index] ?? BAR_TONES[BAR_TONES.length - 1]);

  return (
    <li className="py-3">
      <button
        type="button"
        className="grid w-full grid-cols-[1fr_auto] items-start gap-x-4 text-left disabled:cursor-default"
        onClick={() => setOpen(!open)}
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
      >
        <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
          <span className="truncate">{categoryName(category)}</span>
          {category.type === "unclassified" && <StatusBadge tone="warning">Por classificar</StatusBadge>}
          {expandable && <IconChevronDown size={14} className={`shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} />}
        </span>
        <span className="flex items-baseline justify-end gap-2">
          <Delta pct={pctChange(category.amountCents, category.previousAmountCents)} goodWhenDown />
          <span className="text-sm font-semibold tabular-nums text-navy-900">{euros(category.amountCents)}</span>
        </span>
        <span className="mt-2 block h-1.5 w-full max-w-md rounded-full bg-transparent">
          <span className={`block h-full rounded-full ${tone}`} style={{ width: `${Math.max(share, 2)}%` }} />
        </span>
        <span className="mt-1 text-right text-xs tabular-nums text-ink-secondary">{share}%</span>
      </button>
      {open && (
        <ul className="ml-1 mt-2 space-y-1.5 border-l border-line-subtle pl-3" aria-label={`Detalhe de ${categoryName(category)} vs ${prevMonth}`}>
          {category.children.map((ch) => (
            <li key={ch.key} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate text-ink-secondary">{ch.name ?? "Sem subcategoria"}</span>
              <span className="flex items-baseline gap-2">
                <Delta pct={pctChange(ch.amountCents, ch.previousAmountCents)} goodWhenDown />
                <span className="font-medium tabular-nums text-ink">{euros(ch.amountCents)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Despesas por grupo de centro de custo; as saídas sem categoria aparecem pelo tipo do banco. */
export function ExpenseCategoriesCard({ categories, totalCents, prevMonth }: { categories: CashFlowCategory[]; totalCents: number; prevMonth: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? categories : categories.slice(0, TOP);
  const hidden = categories.length - TOP;

  return (
    <section className={`${SURFACE} p-6`}>
      <h2 className={SECTION_TITLE}>Despesas por categoria</h2>
      <p className="mt-0.5 text-xs text-ink-secondary">
        {all ? "Todas as categorias" : `As ${Math.min(TOP, categories.length)} maiores do período`}, variação vs {prevMonth}
      </p>
      {categories.length === 0 ? (
        <p className="mt-4 text-sm text-ink-secondary">Sem saídas neste período.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line-subtle">
          {shown.map((c, i) => (
            <CategoryRow key={c.key} category={c} index={i} total={totalCents} prevMonth={prevMonth} />
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-line-subtle pt-4">
        {hidden > 0 ? (
          <button type="button" className={buttonClass("secondary", "sm")} onClick={() => setAll(!all)} aria-expanded={all}>
            {all ? "Ver menos" : `Ver mais ${hidden}`}
            <IconChevronDown size={14} className={all ? "rotate-180" : ""} />
          </button>
        ) : (
          <span />
        )}
        <Link to="/financial/bank-statements" className="text-xs font-medium text-navy-900 underline-offset-4 hover:underline">
          Classificar movimentos
        </Link>
      </div>
    </section>
  );
}
