import { useRef, useState } from "react";
import type { InvoiceImportResultDTO } from "../../domain/entities/invoice.ts";
import { useInvoicesModule } from "../../invoices.module.tsx";

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
}

export function ImportInvoiceModal({ onClose, onImported }: Props) {
  const { api } = useInvoicesModule();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      const result = await api.importInvoice(file);
      onImported(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar fatura.");
    } finally {
      setUploading(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
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
            <h2 className="text-base font-semibold text-stone-900">Importar fatura</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Envie um ficheiro para extração automática de dados.
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

        {/* body */}
        <div className="flex gap-6 p-6">
          {/* Drop zone */}
          <div className="flex flex-1 flex-col gap-4">
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
                  <p className="text-sm font-medium text-stone-600">A processar com IA…</p>
                  <p className="text-xs text-stone-400">Aguarde, pode demorar alguns segundos.</p>
                </>
              ) : (
                <>
                  <svg className="h-10 w-10 text-stone-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <div className="text-center">
                    <p className="text-sm font-medium text-stone-700">Arraste o ficheiro aqui</p>
                    <p className="mt-0.5 text-xs text-stone-400">
                      ou clique para selecionar
                    </p>
                  </div>
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500">
                    PDF · JPG · PNG — até 20 MB
                  </span>
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
      </div>
    </div>
  );
}
