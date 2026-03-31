import { formatInvoiceDate, formatMoney } from "../../../../lib/format";
import type { InvoiceImportHeader } from "../invoiceImport.types";
import type { InvoiceImportValidation } from "../invoiceImport.validation";

export function ConfirmImportModal({
  open,
  header,
  validation,
  activeLinesCount,
  duplicateWarning,
  overrideDuplicateAcknowledged,
  onOverrideDuplicateAcknowledgedChange,
  movementDate,
  onMovementDateChange,
  acknowledged,
  onAcknowledgedChange,
  onCancel,
  onConfirm,
  confirming,
}: {
  open: boolean;
  header: InvoiceImportHeader;
  validation: InvoiceImportValidation;
  activeLinesCount: number;
  duplicateWarning: boolean;
  overrideDuplicateAcknowledged: boolean;
  onOverrideDuplicateAcknowledgedChange: (v: boolean) => void;
  /** `YYYY-MM-DD` — data atribuída às movimentações de compra. */
  movementDate: string;
  onMovementDateChange: (value: string) => void;
  acknowledged: boolean;
  onAcknowledgedChange: (v: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  if (!open) return null;

  const ccy = header.currency || "EUR";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Fechar"
        onClick={confirming ? undefined : onCancel}
      />
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-import-title"
      >
        <h3
          id="confirm-import-title"
          className="text-lg font-semibold text-slate-900"
        >
          Confirmar aplicação no stock
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Esta ação vai criar movimentações de <strong>compra</strong> no stock com base nas
          linhas que não estão ignoradas. Não pode ser desfeita automaticamente.
        </p>

        <ul className="mt-4 space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          <li>
            <span className="text-slate-500">Fornecedor:</span>{" "}
            {header.supplier_name || "—"}
          </li>
          <li>
            <span className="text-slate-500">Fatura:</span>{" "}
            {header.invoice_number || "—"} ·{" "}
            {header.invoice_date ? formatInvoiceDate(header.invoice_date) : "—"}
          </li>
          <li>
            <span className="text-slate-500">Linhas a aplicar:</span>{" "}
            <strong>{activeLinesCount}</strong>
          </li>
          {header.total != null && (
            <li>
              <span className="text-slate-500">Total documento:</span>{" "}
              {formatMoney(header.total, ccy)}
            </li>
          )}
        </ul>

        <div className="mt-4">
          <label
            htmlFor="invoice-import-movement-date"
            className="block text-sm font-medium text-slate-700"
          >
            Data dos movimentos no stock
          </label>
          <p className="mt-0.5 text-xs text-slate-500">
            As compras ficam registadas neste dia (formato acordado com o servidor:
            fim do dia em Lisboa). Por omissão usa-se a data da fatura, se existir;
            caso contrário a data de hoje.
          </p>
          <input
            id="invoice-import-movement-date"
            type="date"
            disabled={confirming}
            value={movementDate}
            onChange={(e) => onMovementDateChange(e.target.value)}
            className="mt-2 w-full max-w-[11rem] rounded-lg border border-slate-200 px-2 py-1.5 text-sm tabular-nums disabled:opacity-50"
          />
        </div>

        {validation.warnings.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">Avisos</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {validation.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {duplicateWarning && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50/90 p-3 text-sm text-amber-950">
            <p className="font-medium">Importação em duplicado</p>
            <p className="mt-1 text-amber-900">
              Já existe uma importação confirmada para esta combinação (fornecedor,
              número e data). Confirmar vai <strong>reverter</strong> as compras
              associadas à importação anterior e aplicar esta.
            </p>
          </div>
        )}

        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={acknowledged}
            disabled={confirming}
            onChange={(e) => onAcknowledgedChange(e.target.checked)}
          />
          <span>
            Li o resumo e confirmo que quero aplicar estas compras no stock.
          </span>
        </label>

        {duplicateWarning && (
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className="mt-1"
              checked={overrideDuplicateAcknowledged}
              disabled={confirming}
              onChange={(e) =>
                onOverrideDuplicateAcknowledgedChange(e.target.checked)
              }
            />
            <span>
              Aceito substituir a importação anterior confirmada e rever as
              respetivas movimentações de stock.
            </span>
          </label>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={confirming}
            onClick={() => {
              onAcknowledgedChange(false);
              onOverrideDuplicateAcknowledgedChange(false);
              onCancel();
            }}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={
              !acknowledged ||
              confirming ||
              !validation.canConfirm ||
              (duplicateWarning && !overrideDuplicateAcknowledged)
            }
            onClick={onConfirm}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-40"
          >
            {confirming ? "A aplicar…" : "Confirmar e aplicar"}
          </button>
        </div>
      </div>
    </div>
  );
}
