import { useRef, useState } from "react";
import type { InvoiceImportResultDTO, InvoiceDocumentType } from "../../domain/entities/invoice.ts";
import { DOCUMENT_TYPE_LABELS } from "../../domain/entities/invoice.ts";
import { useInvoicesModule } from "../../invoices.module.tsx";
import { ApiError } from "../../../../lib/api.ts";
import { isPaymentDocument, type PaymentDocumentImportDTO } from "../../domain/entities/payment-document.ts";
import { PaymentDocumentReview } from "./PaymentDocumentReview.tsx";
import { importQueue, MAX_BATCH_FILES } from "./import-queue.ts";

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const ACCEPTED_EXT = ".pdf,.jpg,.jpeg,.png";

const EXTRACTED_FIELDS = [
  "Nome do fornecedor",
  "NIF",
  "Morada",
  "Nº da fatura",
  "Data de emissão",
  "Data de vencimento",
  "Total s/ IVA",
  "IVA",
  "Total c/ IVA",
  "Linhas da fatura (opcional)",
];

interface Props {
  onClose(): void;
  onImported(result: InvoiceImportResultDTO): void;
  /** Documento de cobrança já registado: abrir a fatura existente. */
  onOpenInvoice?(invoiceId: string): void;
}

export function ImportInvoiceModal({ onClose, onImported, onOpenInvoice }: Props) {
  const { api } = useInvoicesModule();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docType, setDocType] = useState<InvoiceDocumentType>("invoice");
  const inputRef = useRef<HTMLInputElement>(null);
  // Documento de cobrança (Finanças/Segurança Social): revisão própria, sem criar fatura.
  const [payment, setPayment] = useState<{ file: File; result: PaymentDocumentImportDTO } | null>(null);

  async function handleFile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Tipo de ficheiro não suportado. Use PDF, JPG ou PNG.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("O ficheiro é muito grande. Máximo 20 MB.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      // Só forçamos quando o utilizador marca explicitamente "Nota de
      // crédito" — deixar o valor "Fatura" (o padrão do toggle) por enviar
      // permite que a deteção automática da IA continue a funcionar mesmo
      // que o utilizador nunca mexa neste botão.
      const result = await api.importInvoice(file, docType === "credit_note" ? docType : undefined);
      if (isPaymentDocument(result)) setPayment({ file, result });
      else onImported(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar fatura.");
    } finally {
      setUploading(false);
    }
  }

  /** E3b-2: o servidor volta a ler o ficheiro e cria o rascunho (sem IVA, linhas nem Stock); abre-se a revisão habitual. */
  async function createObligationDraft(force: boolean) {
    if (!payment) return;
    setError(null);
    setUploading(true);
    try {
      onImported(await api.createObligationDraft(payment.file, { force }));
    } catch (err) {
      if (!force && err instanceof ApiError && err.status === 409 && (err.data as { code?: string } | null)?.code === "obligation_exists") {
        setUploading(false);
        if (window.confirm("Já existe um registo que parece ser esta obrigação. Criar outro mesmo assim?")) await createObligationDraft(true);
        return;
      }
      setError(err instanceof Error ? err.message : "Erro ao criar o rascunho da obrigação.");
    } finally {
      setUploading(false);
    }
  }

  /** Vários ficheiros (E4): vão para a fila em segundo plano e o modal fecha. */
  function handleFiles(list: FileList | null) {
    const all = Array.from(list ?? []);
    if (all.length === 0) return;
    if (all.length === 1) {
      void handleFile(all[0]!);
      return;
    }
    const valid = all.filter((f) => ACCEPTED_TYPES.includes(f.type) && f.size <= 20 * 1024 * 1024);
    if (valid.length === 0) {
      setError("Nenhum ficheiro suportado (PDF, JPG ou PNG até 20 MB).");
      return;
    }
    importQueue.enqueue(valid, api);
    onClose();
  }

  /** Liga o documento ao registo já existente (em vez de criar outro) e abre-o. */
  async function linkToExisting(invoiceId: string) {
    if (!payment) return;
    setError(null);
    setUploading(true);
    try {
      await api.linkObligation(invoiceId, payment.file);
      onOpenInvoice?.(invoiceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ligar o documento.");
    } finally {
      setUploading(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    /* backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">{payment ? "Rever documento de cobrança" : "Importar fatura"}</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              {payment ? payment.file.name : "Envie um ficheiro para extração automática de dados."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100"
            disabled={uploading}
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {payment ? (
          <div className="p-6">
            <PaymentDocumentReview
              result={payment.result}
              busy={uploading}
              onOpenExisting={(id) => onOpenInvoice?.(id)}
              onLinkExisting={(id) => void linkToExisting(id)}
              onCreateDraft={(force) => void createObligationDraft(force)}
              onClose={onClose}
            />
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          </div>
        ) : (
        <>
        {/* body */}
        <div className="flex gap-6 p-6">
          {/* Drop zone */}
          <div className="flex flex-1 flex-col gap-4">
            {/* Tipo de documento */}
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400">Tipo de documento</p>
              <div className="flex gap-2">
                {(Object.entries(DOCUMENT_TYPE_LABELS) as [InvoiceDocumentType, string][]).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    disabled={uploading}
                    onClick={() => setDocType(type)}
                    className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${docType === type ? "border-[#ED5C32] bg-[#FDF8F5] text-[#ED5C32]" : "border-stone-200 text-stone-500 hover:border-stone-300"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-stone-400">
                Deixa em "Fatura" para deteção automática — a IA sugere Nota de crédito quando encontra os termos no documento.
              </p>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => !uploading && inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors ${
                dragging
                  ? "border-[#ED5C32] bg-orange-50"
                  : "border-stone-200 bg-stone-50 hover:border-[#ED5C32]/50"
              } ${uploading ? "pointer-events-none opacity-60" : ""}`}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_EXT}
                multiple
                aria-label="Ficheiros das faturas"
                className="hidden"
                onChange={onInputChange}
              />

              {uploading ? (
                <>
                  <svg
                    className="h-10 w-10 animate-spin text-[#ED5C32]"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
                    />
                  </svg>
                  <p className="text-sm font-medium text-stone-600">A ler o documento…</p>
                  <p className="text-xs text-stone-400">Aguarde, pode demorar alguns segundos.</p>
                </>
              ) : (
                <>
                  <svg className="h-10 w-10 text-stone-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <div className="text-center">
                    <p className="text-sm font-medium text-stone-700">Arraste os ficheiros aqui</p>
                    <p className="mt-0.5 text-xs text-stone-400">
                      ou clique para selecionar
                    </p>
                  </div>
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500">
                    PDF · JPG · PNG — até 20 MB
                  </span>
                  <span className="text-[11px] text-stone-400">Vários de uma vez (até {MAX_BATCH_FILES}): são lidos em segundo plano.</span>
                </>
              )}
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
            )}
          </div>

          {/* Info panel */}
          <div className="w-52 shrink-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
              O que será extraído
            </p>
            <ul className="space-y-1.5">
              {EXTRACTED_FIELDS.map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-stone-600">
                  <svg className="h-3.5 w-3.5 shrink-0 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <p className="mt-4 text-[10px] text-stone-400 leading-relaxed">
              Os dados extraídos ficam disponíveis para revisão antes de serem guardados.
            </p>
          </div>
        </div>

        {/* footer */}
        <div className="flex justify-end border-t border-stone-100 px-6 py-3">
          <button
            onClick={onClose}
            disabled={uploading}
            className="rounded-md px-4 py-2 text-sm text-stone-500 hover:bg-stone-100 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
