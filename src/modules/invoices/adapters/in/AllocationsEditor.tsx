import { NumericInput } from "../../../../components/NumericInput.tsx";
import { LocationSelect } from "../../../../components/LocationSelect.tsx";
import type { CostCenterGroup, CostCenterCategory } from "../../../financial-base/domain/entities/cost-center.ts";
import {
  allocationsState, newDraftAllocation, proposeFromLines, type DraftAllocation,
} from "../../domain/services/allocations-draft.ts";
import { CostCenterCascadeSelect } from "./CostCenterCascadeSelect.tsx";

function fromCents(c: number): string {
  return (c / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

interface Props {
  rows: DraftAllocation[];
  /** Base líquida (sem IVA, já com descontos) que as repartições têm de somar. */
  netBaseCents: number;
  groups: CostCenterGroup[];
  categories: CostCenterCategory[];
  /** Linhas do documento com subcategoria, para «Propor a partir das linhas». */
  lines: { key: string; categoryId: string | null; locationId: string | null; netCents: number }[];
  onChange(rows: DraftAllocation[]): void;
}

/**
 * Modo «Por valores» (F2 v1.2 §2.2): repartições por subcategoria (e loja) com
 * montante líquido — não são artigos, sem quantidade nem IVA. A soma tem de
 * igualar a base líquida; «Por distribuir» mostra o que falta (ou sobra).
 * Mudar a base não redistribui nada: a diferença aparece aqui para rever.
 */
export function AllocationsEditor({ rows, netBaseCents, groups, categories, lines, onChange }: Props) {
  const state = allocationsState(rows, netBaseCents);
  const fieldCls = "w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]";
  const canPropose = lines.some((l) => l.categoryId && l.netCents > 0);

  function update(key: string, patch: Partial<DraftAllocation>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function propose() {
    const proposal = proposeFromLines(lines, categories.map((c) => ({ id: c.id, groupId: c.groupId, name: c.name })));
    if (rows.some((r) => r.description.trim() || r.amount.trim()) && !window.confirm("Substituir as repartições atuais pela proposta a partir das linhas?")) return;
    onChange(proposal);
  }

  const remaining = state.remainingCents;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-stone-500">Repartição por valores</p>
        <button
          type="button"
          onClick={propose}
          disabled={!canPropose}
          title={canPropose ? "Soma as linhas com subcategoria; as restantes ficam por distribuir" : "Nenhuma linha tem subcategoria — classifique-as em «Por artigo» ou reparta à mão"}
          className="text-xs font-medium text-[#ED5C32] hover:underline disabled:cursor-not-allowed disabled:text-stone-300 disabled:no-underline"
        >
          Propor a partir das linhas
        </button>
      </div>

      {rows.map((r, i) => (
        <div key={r.key} className="space-y-2 rounded-lg border border-stone-200 bg-white p-3">
          <div className="grid grid-cols-[1fr_8rem_auto] items-center gap-2">
            <input
              type="text"
              value={r.description}
              onChange={(e) => update(r.key, { description: e.target.value })}
              placeholder="Descrição *"
              aria-label={`Descrição da repartição ${i + 1}`}
              className={fieldCls}
            />
            <NumericInput
              value={r.amount}
              onChange={(e) => update(r.key, { amount: e.target.value })}
              placeholder="0.00"
              aria-label={`Montante líquido da repartição ${i + 1}`}
              className={`${fieldCls} text-right tabular-nums`}
            />
            <button
              type="button"
              onClick={() => onChange(rows.filter((x) => x.key !== r.key))}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Eliminar
            </button>
          </div>
          <CostCenterCascadeSelect
            groups={groups}
            categories={categories}
            groupId={r.groupId}
            categoryId={r.categoryId}
            onChange={(groupId, categoryId) => update(r.key, { groupId, categoryId })}
            inputCls={fieldCls}
          />
          <LocationSelect
            value={r.locationId}
            onChange={(locationId) => update(r.key, { locationId })}
            allowUnset
            label="Loja"
            className={fieldCls}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...rows, newDraftAllocation(crypto.randomUUID())])}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-300 py-2 text-xs font-medium text-stone-500 hover:border-[#ED5C32] hover:text-[#ED5C32]"
      >
        <span className="text-base leading-none">+</span> Adicionar repartição
      </button>

      <div className="space-y-1 rounded-lg border border-stone-200 p-3 text-xs">
        <div className="flex justify-between gap-4 text-stone-600">
          <span>Base líquida a repartir</span>
          <span className="tabular-nums">{fromCents(netBaseCents)}</span>
        </div>
        <div className="flex justify-between gap-4 text-stone-600">
          <span>Distribuído</span>
          <span className="tabular-nums">{fromCents(state.distributedCents)}</span>
        </div>
        <div
          data-testid="allocations-remaining"
          className={`flex justify-between gap-4 rounded-md px-2 py-1.5 font-bold ${remaining === 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
        >
          <span>{remaining < 0 ? "Excesso" : "Por distribuir"}</span>
          <span className="tabular-nums">{fromCents(Math.abs(remaining))}</span>
        </div>
        {!state.ok && (
          <p className="text-red-600">
            {rows.length === 0
              ? "Adicione pelo menos uma repartição."
              : !state.rowsComplete
                ? "Cada repartição precisa de descrição, subcategoria e montante."
                : "A soma das repartições tem de ser igual à base líquida."}
          </p>
        )}
      </div>
    </div>
  );
}
