import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../../../lib/api.ts";
import { useStockPurchaseReviewModule } from "../../stock-purchase-review.module.tsx";

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_ATTEMPTS = 2;

type Outcome =
  | { tone: "block"; title: string; text: string; reviewId?: string | null }
  | { tone: "info"; title: string; text: string; reviewId?: string | null; invoiceId?: string | null; canRoute?: boolean; canRetry?: boolean };

interface Props {
  onClose(): void;
}

/**
 * «Importar fatura» no Stock (F3c): o servidor lê a fatura com o mesmo leitor do Financeiro
 * (QR fiscal + texto, IA só sem leitura) e cria a Compra por rever, pendente do Financeiro.
 * Fatura que já deu entrada no Stock → aviso e bloqueio; já em revisão → abrir; já lançada sem
 * Stock → encaminhar; falha de leitura → tentar de novo (no máximo duas vezes).
 */
export function StockImportInvoiceModal({ onClose }: Props) {
  const { api } = useStockPurchaseReviewModule();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function send(f: File, routeExisting = false) {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setOutcome({ tone: "info", title: "Ficheiro não suportado", text: "Use PDF, JPG ou PNG." });
      return;
    }
    setFile(f);
    setBusy(true);
    setOutcome(null);
    setAttempts((n) => n + 1);
    try {
      const r = await api.importInvoiceForStock(f, { routeExisting });
      if (r.reviewId) {
        navigate(`/stock/compras-por-rever/${r.reviewId}`);
        onClose();
        return;
      }
      setOutcome({ tone: "info", title: "Importada", text: "A fatura foi importada. Abra Compras por rever para a tratar." });
    } catch (e) {
      setOutcome(toOutcome(e));
    } finally {
      setBusy(false);
    }
  }

  function toOutcome(e: unknown): Outcome {
    const msg = e instanceof Error ? e.message : "Erro ao importar a fatura.";
    if (!(e instanceof ApiError)) return { tone: "info", title: "Não foi possível importar", text: msg };
    const data = (e.data ?? {}) as { code?: string; reviewId?: string | null; invoiceId?: string | null };
    switch (data.code) {
      case "already_in_stock":
        return { tone: "block", title: "Esta fatura já deu entrada no Stock", text: `${msg} Para corrigir quantidades, use um ajuste de stock.`, reviewId: data.reviewId ?? null };
      case "already_in_review":
        return { tone: "info", title: "Já está em Compras por rever", text: msg, reviewId: data.reviewId ?? null };
      case "draft_in_finance":
        return { tone: "info", title: "Em rascunho no Financeiro", text: msg, invoiceId: data.invoiceId ?? null };
      case "exists_not_routed":
        return { tone: "info", title: "Já lançada no Financeiro", text: `${msg} Pode enviá-la agora para Compras por rever (não duplica a fatura nem a conta a pagar).`, canRoute: true };
      case "extraction_failed":
        return { tone: "info", title: "Não foi possível ler a fatura", text: msg, canRetry: true };
      default:
        return { tone: "info", title: "Não foi possível importar", text: msg };
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" aria-modal="true" role="dialog" aria-label="Importar fatura no Stock">
      <div className="absolute inset-0 bg-black/40" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-stone-900">Importar fatura no Stock</h2>
        <p className="mt-1 text-xs text-stone-500">
          Lida como no Financeiro (código QR fiscal e texto do PDF). Fica em Compras por rever para conciliar os artigos e aguarda o lançamento no Financeiro — não cria conta a pagar.
        </p>

        <div
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f && !busy) void send(f);
          }}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 p-8 text-center hover:border-[#ED5C32]/50 ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            aria-label="Ficheiro da fatura"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void send(f);
            }}
          />
          <p className="text-sm font-medium text-stone-700">{busy ? "A ler a fatura…" : file ? file.name : "Arraste o PDF aqui ou clique para escolher"}</p>
          <p className="text-xs text-stone-400">PDF · JPG · PNG</p>
        </div>

        {outcome && (
          <div className={`mt-4 rounded-lg px-3 py-2 text-xs ${outcome.tone === "block" ? "border border-red-200 bg-red-50 text-red-800" : "border border-amber-200 bg-amber-50 text-amber-900"}`} role="alert">
            <p className="font-semibold">{outcome.title}</p>
            <p className="mt-0.5">{outcome.text}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {outcome.reviewId && (
                <button type="button" onClick={() => { navigate(`/stock/compras-por-rever/${outcome.reviewId}`); onClose(); }} className="rounded border border-current px-2 py-0.5 font-medium">
                  Abrir a revisão
                </button>
              )}
              {outcome.tone === "info" && outcome.canRoute && file && (
                <button type="button" disabled={busy} onClick={() => void send(file, true)} className="rounded bg-stone-800 px-2 py-0.5 font-medium text-white disabled:opacity-50">
                  Enviar para Compras por rever
                </button>
              )}
              {outcome.tone === "info" && outcome.canRetry && file && attempts < MAX_ATTEMPTS && (
                <button type="button" disabled={busy} onClick={() => void send(file)} className="rounded border border-current px-2 py-0.5 font-medium disabled:opacity-50">
                  Tentar de novo
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md px-4 py-2 text-sm text-stone-500 hover:bg-stone-100 disabled:opacity-50">
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
