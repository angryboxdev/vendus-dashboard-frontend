import { useState, type FormEvent } from "react";
import { ApiError } from "../../../../lib/api.ts";
import {
  InvalidCompanyDocumentError,
  VISIBILITY_LABELS,
  type CompanyDocument,
  type CompanyDocumentCategory,
  type CompanyDocumentUpload,
  type DocumentVisibility,
} from "../../domain/entities/company-document.ts";
import { DOCUMENT_ACCEPTED_TYPES } from "../../domain/services/company-document.service.ts";

const inputCls =
  "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30";
const labelCls = "mb-1.5 block text-sm font-medium text-stone-700";

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof InvalidCompanyDocumentError) return error.message;
  if (error instanceof ApiError && (error.status === 400 || error.status === 409)) return error.message;
  return "Não foi possível guardar. Tente novamente.";
}

interface Props {
  /** `null` = novo documento; senão renovar este. */
  renewing: CompanyDocument | null;
  categories: CompanyDocumentCategory[];
  visibilityOptions: DocumentVisibility[];
  saving: boolean;
  error: unknown;
  onSubmit: (upload: CompanyDocumentUpload & { category: string }) => void;
  onClose: () => void;
}

/** Enviar um documento novo da Empresa, ou renovar um existente (nova versão; a anterior fica "Substituída"). */
export function CompanyDocumentDrawer({ renewing, categories, visibilityOptions, saving, error, onSubmit, onClose }: Props) {
  const [category, setCategory] = useState(renewing?.category ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [visibility, setVisibility] = useState<DocumentVisibility>(renewing?.visibility ?? "management");
  const activeCategories = categories.filter((c) => c.active);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    onSubmit({ category, file, issuedAt: issuedAt || null, expiresAt: expiresAt || null, visibility });
  }

  const title = renewing ? `Renovar ${renewing.categoryLabel}` : "Novo documento da empresa";

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" role="dialog" aria-modal="true" aria-label={title}>
      <form onSubmit={handleSubmit} className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2 className="text-base font-semibold text-stone-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {renewing ? (
            <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
              A versão atual (v{renewing.version}) fica guardada como "Substituída" — nada é apagado.
            </p>
          ) : (
            <div>
              <label htmlFor="company-doc-category" className={labelCls}>
                Categoria <span className="text-[#ED5C32]">*</span>
              </label>
              <select id="company-doc-category" required value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                <option value="" disabled>
                  Selecione uma categoria
                </option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="company-doc-file" className={labelCls}>
              Ficheiro <span className="text-[#ED5C32]">*</span>
            </label>
            <input
              id="company-doc-file"
              type="file"
              // Sem `required`: o botão de envio já fica desativado sem ficheiro (e o jsdom trata mal `required` em inputs de ficheiro).
              accept={DOCUMENT_ACCEPTED_TYPES.join(",")}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-stone-700"
            />
            <p className="mt-1 text-xs text-stone-500">PDF, JPG ou PNG até 20 MB.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="company-doc-issued" className={labelCls}>
                Data de emissão
              </label>
              <input id="company-doc-issued" type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="company-doc-expires" className={labelCls}>
                Data de validade
              </label>
              <input id="company-doc-expires" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label htmlFor="company-doc-visibility" className={labelCls}>
              Visibilidade
            </label>
            <select
              id="company-doc-visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as DocumentVisibility)}
              className={inputCls}
            >
              {visibilityOptions.map((v) => (
                <option key={v} value={v}>
                  {VISIBILITY_LABELS[v]}
                </option>
              ))}
            </select>
          </div>
          {errorMessage(error) && <p className="text-sm text-[#A3211A]">{errorMessage(error)}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-stone-200 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !file}
            className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "A guardar…" : renewing ? "Guardar nova versão" : "Enviar documento"}
          </button>
        </div>
      </form>
    </div>
  );
}
