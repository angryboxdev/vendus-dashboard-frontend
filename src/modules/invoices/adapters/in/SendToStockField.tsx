import type { StockRoutingSuggestion } from "../../domain/entities/invoice.ts";
import type { StockDecision } from "../../domain/services/stock-decision.ts";

interface Props {
  suggestion: StockRoutingSuggestion | null;
  decision: StockDecision;
  choice: boolean | null;
  reason: string;
  onChoice(choice: boolean): void;
  onReason(reason: string): void;
  inputCls: string;
}

/**
 * «Enviar para Stock» (F2 v1.2 §2.1): substitui «Impacto no stock». Mostra o
 * motivo da predefinição de forma discreta; «Decidir no documento» pede uma
 * escolha explícita; desmarcar contra «Enviar» pede um motivo curto.
 */
export function SendToStockField({ suggestion, decision, choice, reason, onChoice, onReason, inputCls }: Props) {
  const needsDecision = choice === null && !!suggestion?.requiresDecision;
  return (
    <div className="space-y-2">
      {needsDecision ? (
        <fieldset className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <legend className="px-1 text-xs font-medium text-amber-800">Enviar para Stock?</legend>
          <p className="text-xs text-amber-700">{suggestion!.reason}: escolha para este documento.</p>
          <div className="flex gap-4 text-sm text-stone-700">
            <label className="flex items-center gap-2">
              <input type="radio" name="send-to-stock" onChange={() => onChoice(true)} /> Enviar
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="send-to-stock" onChange={() => onChoice(false)} /> Não enviar
            </label>
          </div>
        </fieldset>
      ) : (
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={decision.checked}
            onChange={(e) => onChoice(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 text-[#ED5C32] focus:ring-[#ED5C32]"
          />
          Enviar para Stock
          {suggestion?.reason && choice === null && (
            <span className="text-xs text-stone-400">· {suggestion.reason}</span>
          )}
        </label>
      )}
      {decision.contrary && (
        <input
          type="text"
          value={reason}
          onChange={(e) => onReason(e.target.value)}
          className={inputCls}
          placeholder={`Motivo para não enviar (obrigatório — predefinição: ${suggestion?.reason ?? "enviar"})`}
          aria-label="Motivo para não enviar para o Stock"
        />
      )}
      <p className="text-[11px] text-stone-400">Cria uma revisão em «Compras por rever» — nunca uma entrada automática de inventário.</p>
    </div>
  );
}
