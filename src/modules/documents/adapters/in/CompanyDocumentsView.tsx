import { Fragment, useState } from "react";
import { useAuth } from "../../../../contexts/AuthContext.tsx";
import {
  DISPLAY_STATUS_LABELS,
  SCOPE_LABELS,
  VISIBILITY_LABELS,
  type CompanyDocument,
  type CompanyDocumentCategory,
  type DocumentDisplayStatus,
} from "../../domain/entities/company-document.ts";
import { sortCompanyDocuments, visibilityOptionsFor } from "../../domain/services/company-document.service.ts";
import { CompanyDocumentDrawer } from "./CompanyDocumentDrawer.tsx";
import { useCompanyDocumentHistory, useCompanyDocuments } from "./use-company-documents.ts";

const STATUS_CLASSES: Record<DocumentDisplayStatus, string> = {
  ok: "bg-emerald-50 text-emerald-700",
  expiring: "bg-amber-50 text-amber-700",
  expired: "bg-red-50 text-red-700",
  pending_validation: "bg-sky-50 text-sky-700",
  rejected: "bg-red-50 text-red-700",
  removed: "bg-stone-100 text-stone-500",
};

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-PT") : "—";
}

function History({ documentId, colSpan }: { documentId: string; colSpan: number }) {
  const { data, isLoading } = useCompanyDocumentHistory(documentId);
  return (
    <tr>
      <td colSpan={colSpan} className="bg-stone-50 px-4 py-3">
        {isLoading && <p className="text-xs text-stone-500">A carregar histórico…</p>}
        <ul className="space-y-1 text-xs text-stone-600">
          {data?.map((v) => (
            <li key={v.id}>
              v{v.version} — {v.fileName} · validade {fmtDate(v.expiresAt)} · {fmtDate(v.uploadedAt)} por {v.uploadedBy}{" "}
              <span className={v.isCurrent ? "font-medium text-emerald-700" : "text-stone-400"}>{v.isCurrent ? "Atual" : "Substituído"}</span>
            </li>
          ))}
        </ul>
      </td>
    </tr>
  );
}

function CategoriesModal({
  categories,
  onCreate,
  onToggle,
  error,
  onClose,
}: {
  categories: CompanyDocumentCategory[];
  onCreate: (label: string, scope: "company" | "both") => void;
  onToggle: (id: string, active: boolean) => void;
  error: unknown;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"company" | "both">("company");
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20" role="dialog" aria-modal="true" aria-label="Categorias da empresa">
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-stone-900">Categorias de documentos da empresa</h3>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Fechar">
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-stone-500">
          As mesmas categorias dos documentos dos colaboradores; aqui só aparecem as de âmbito Empresa ou Ambos. Nunca se apagam — desativam-se.
        </p>
        <form
          className="mb-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onCreate(label, scope);
            setLabel("");
          }}
        >
          <div className="flex-1">
            <label htmlFor="company-cat-label" className="mb-1 block text-xs font-medium text-stone-600">
              Nova categoria
            </label>
            <input
              id="company-cat-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Licença de utilização"
              className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm outline-none focus:border-[#ED5C32]"
            />
          </div>
          <select
            aria-label="Âmbito"
            value={scope}
            onChange={(e) => setScope(e.target.value as "company" | "both")}
            className="rounded-md border border-stone-300 px-2 py-1.5 text-sm"
          >
            <option value="company">{SCOPE_LABELS.company}</option>
            <option value="both">{SCOPE_LABELS.both}</option>
          </select>
          <button type="submit" disabled={!label.trim()} className="rounded-md bg-stone-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            Criar
          </button>
        </form>
        {Boolean(error) && <p className="mb-2 text-sm text-[#A3211A]">Não foi possível guardar a categoria (nome já usado?).</p>}
        <ul className="divide-y divide-stone-100">
          {categories.map((c) => (
            <li key={c.id} className={`flex items-center justify-between py-2 text-sm ${c.active ? "" : "opacity-50"}`}>
              <span>
                {c.label} <span className="text-xs text-stone-500">· {SCOPE_LABELS[c.scope]}</span>
              </span>
              <button type="button" onClick={() => onToggle(c.id, !c.active)} className="text-xs text-stone-500 hover:underline">
                {c.active ? "Desativar" : "Ativar"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Empresa & Estrutura → Documentos (Base Organizacional, ticket 03). Só
 * gestão (gestores e administradores); "Só administração" fica escondido
 * dos gestores. Nunca há apagar definitivo: remover é lógico e renovar
 * preserva a versão anterior.
 */
export function CompanyDocumentsView() {
  const { user } = useAuth();
  const role = user?.role;
  const canManage = role === "admin" || role === "manager";
  const {
    documentsQuery,
    categoriesQuery,
    uploadMutation,
    replaceMutation,
    removeMutation,
    createCategoryMutation,
    setCategoryActiveMutation,
    downloadUrl,
  } = useCompanyDocuments();
  const [drawer, setDrawer] = useState<{ open: false } | { open: true; renewing: CompanyDocument | null }>({ open: false });
  const [historyOf, setHistoryOf] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<CompanyDocument | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  if (!canManage) {
    return <p className="p-6 text-sm text-stone-500">Os documentos da empresa só estão disponíveis para a gestão.</p>;
  }

  const documents = sortCompanyDocuments(documentsQuery.data ?? []);
  const categories = categoriesQuery.data ?? [];
  const saveMutation = drawer.open && drawer.renewing ? replaceMutation : uploadMutation;
  const COLS = 8;

  function openDrawer(renewing: CompanyDocument | null) {
    uploadMutation.reset();
    replaceMutation.reset();
    setDrawer({ open: true, renewing });
  }

  async function openDocument(id: string) {
    window.open(await downloadUrl(id), "_blank", "noopener");
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Documentos da empresa</h2>
          <p className="text-xs text-stone-500">Apólices, certidões, licenças e outros documentos cujo dono é a empresa.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCategoriesOpen(true)}
            className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Categorias
          </button>
          <button
            type="button"
            onClick={() => openDrawer(null)}
            className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
          >
            Novo documento
          </button>
        </div>
      </div>

      {documentsQuery.isLoading && <p className="text-sm text-stone-500">A carregar…</p>}
      {documentsQuery.isError && <p className="text-sm text-[#A3211A]">Não foi possível carregar os documentos.</p>}

      {!documentsQuery.isLoading && (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2 font-medium">Categoria</th>
                <th className="px-4 py-2 font-medium">Ficheiro</th>
                <th className="px-4 py-2 font-medium">Emissão</th>
                <th className="px-4 py-2 font-medium">Validade</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 font-medium">Visibilidade</th>
                <th className="px-4 py-2 font-medium">Versão</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {documents.length === 0 && (
                <tr>
                  <td colSpan={COLS} className="px-4 py-6 text-center text-stone-500">
                    Ainda não há documentos da empresa.
                  </td>
                </tr>
              )}
              {documents.map((d) => (
                <Fragment key={d.id}>
                  <tr>
                    <td className="px-4 py-3 font-medium text-stone-800">{d.categoryLabel}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => void openDocument(d.id)} className="text-[#ED5C32] hover:underline">
                        {d.fileName}
                      </button>
                    </td>
                    <td className="px-4 py-3">{fmtDate(d.issuedAt)}</td>
                    <td className="px-4 py-3">{fmtDate(d.expiresAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[d.displayStatus]}`}>
                        {DISPLAY_STATUS_LABELS[d.displayStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{VISIBILITY_LABELS[d.visibility]}</td>
                    <td className="px-4 py-3 text-stone-600">v{d.version}</td>
                    <td className="space-x-3 whitespace-nowrap px-4 py-3 text-right">
                      <button type="button" onClick={() => openDrawer(d)} className="text-sm font-medium text-[#ED5C32] hover:underline">
                        Renovar
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryOf(historyOf === d.id ? null : d.id)}
                        className="text-sm text-stone-500 hover:underline"
                        aria-expanded={historyOf === d.id}
                      >
                        Histórico
                      </button>
                      <button type="button" onClick={() => setConfirmRemove(d)} className="text-sm text-stone-500 hover:underline">
                        Remover
                      </button>
                    </td>
                  </tr>
                  {historyOf === d.id && <History documentId={d.id} colSpan={COLS} />}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmRemove && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20" role="alertdialog" aria-modal="true" aria-label="Confirmar remoção">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-stone-900">Remover {confirmRemove.categoryLabel}?</h3>
            <p className="mt-2 text-sm text-stone-600">
              O documento deixa de aparecer na lista, mas o ficheiro e o histórico ficam guardados para auditoria.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmRemove(null)} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => removeMutation.mutate(confirmRemove.id, { onSettled: () => setConfirmRemove(null) })}
                className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {drawer.open && (
        <CompanyDocumentDrawer
          renewing={drawer.renewing}
          categories={categories}
          visibilityOptions={visibilityOptionsFor(role)}
          saving={saveMutation.isPending}
          error={saveMutation.error}
          onClose={() => setDrawer({ open: false })}
          onSubmit={(upload) => {
            const onSuccess = () => setDrawer({ open: false });
            if (drawer.renewing) replaceMutation.mutate({ id: drawer.renewing.id, upload }, { onSuccess });
            else uploadMutation.mutate(upload, { onSuccess });
          }}
        />
      )}

      {categoriesOpen && (
        <CategoriesModal
          categories={categories}
          error={createCategoryMutation.error}
          onCreate={(label, scope) => createCategoryMutation.mutate({ label, scope })}
          onToggle={(id, active) => setCategoryActiveMutation.mutate({ id, active })}
          onClose={() => setCategoriesOpen(false)}
        />
      )}
    </div>
  );
}
