import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import { usePositions } from "./use-positions.ts";
import {
  ACCEPTED_MIME_TYPE_OPTIONS,
  DOCUMENT_CATEGORY_SCOPE_LABELS,
  type DocumentCategoryDefinition,
  type DocumentCategoryScope,
} from "../../domain/entities/document-category.ts";

const DEFAULT_MIME_TYPES = ACCEPTED_MIME_TYPE_OPTIONS.map((o) => o.value);

interface FormState {
  label: string;
  mandatory: boolean;
  /** "Todos os colaboradores" vs "Cargos selecionados" (ticket 09). */
  allPositions: boolean;
  positionIds: string[];
  acceptedMimeTypes: string[];
  scope: DocumentCategoryScope;
}

function emptyForm(): FormState {
  return { label: "", mandatory: false, allPositions: true, positionIds: [], acceptedMimeTypes: [...DEFAULT_MIME_TYPES], scope: "employee" };
}

function formFromDefinition(def: DocumentCategoryDefinition): FormState {
  return {
    label: def.label,
    mandatory: def.mandatory,
    allPositions: def.positionIds.length === 0,
    positionIds: def.positionIds,
    acceptedMimeTypes: def.acceptedMimeTypes,
    scope: def.scope,
  };
}

export function DocumentCategoriesModal({ onClose }: { onClose: () => void }) {
  const { api } = useHrModule();
  const { data: positions = [] } = usePositions();
  const positionName = new Map(positions.map((p) => [p.id, p.name]));
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [error, setError] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["hr-document-categories"],
    queryFn: () => api.listDocumentCategories(),
  });

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["hr-document-categories"] });
    void qc.invalidateQueries({ queryKey: ["hr-people-kpis"] });
    void qc.invalidateQueries({ queryKey: ["hr-people-list"] });
    void qc.invalidateQueries({ queryKey: ["hr-people-profile"] });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      api.createDocumentCategory({
        label: form.label.trim(),
        mandatory: form.mandatory,
        positionIds: form.allPositions ? [] : form.positionIds,
        acceptedMimeTypes: form.acceptedMimeTypes,
        scope: form.scope,
      }),
    onSuccess: () => {
      invalidate();
      setForm(emptyForm());
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Erro ao criar categoria"),
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) =>
      api.updateDocumentCategory(id, {
        label: form.label.trim(),
        mandatory: form.mandatory,
        positionIds: form.allPositions ? [] : form.positionIds,
        acceptedMimeTypes: form.acceptedMimeTypes,
        scope: form.scope,
      }),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setForm(emptyForm());
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Erro ao editar categoria"),
  });

  const setActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.setDocumentCategoryActive(id, active),
    onSuccess: invalidate,
  });

  function togglePosition(id: string) {
    setForm((f) => ({
      ...f,
      positionIds: f.positionIds.includes(id) ? f.positionIds.filter((p) => p !== id) : [...f.positionIds, id],
    }));
  }

  function toggleMimeType(mime: string) {
    setForm((f) => ({
      ...f,
      acceptedMimeTypes: f.acceptedMimeTypes.includes(mime)
        ? f.acceptedMimeTypes.filter((m) => m !== mime)
        : [...f.acceptedMimeTypes, mime],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.label.trim().length === 0) {
      setError("Nome é obrigatório");
      return;
    }
    if (form.acceptedMimeTypes.length === 0) {
      setError("Escolhe pelo menos um tipo de ficheiro aceite");
      return;
    }
    if (editingId) updateMutation.mutate(editingId);
    else createMutation.mutate();
  }

  function startEdit(def: DocumentCategoryDefinition) {
    setEditingId(def.id);
    setForm(formFromDefinition(def));
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Categorias de documentos</h2>
            <p className="text-sm text-stone-500">
              Só categorias obrigatórias geram alerta nas pendências prioritárias.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 border-b border-stone-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-stone-800">
            {editingId ? "Editar categoria" : "Nova categoria"}
          </h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-stone-600">Nome</label>
              <input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Ex: Seguro de saúde"
                className="w-full rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
              />
            </div>
            <div>
              <label htmlFor="category-scope" className="mb-1 block text-xs font-medium text-stone-600">
                Âmbito
              </label>
              <select
                id="category-scope"
                value={form.scope}
                onChange={(e) => {
                  const scope = e.target.value as DocumentCategoryScope;
                  // Só da Empresa: nunca é requisito de um colaborador.
                  setForm((f) => ({ ...f, scope, ...(scope === "company" && { mandatory: false, allPositions: true, positionIds: [] }) }));
                }}
                className="rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
              >
                {Object.entries(DOCUMENT_CATEGORY_SCOPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 pb-2 text-sm text-stone-600">
              <input
                type="checkbox"
                disabled={form.scope === "company"}
                checked={form.mandatory}
                onChange={(e) => setForm((f) => ({ ...f, mandatory: e.target.checked }))}
              />
              Obrigatório
            </label>
          </div>

          {/* Aplicabilidade só existe em documentos de colaborador — escondido para categorias só da Empresa. */}
          {form.scope !== "company" && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-600">Aplica-se a</label>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1.5 text-sm text-stone-600">
                <input
                  type="checkbox"
                  checked={form.allPositions}
                  onChange={(e) => setForm((f) => ({ ...f, allPositions: e.target.checked, positionIds: [] }))}
                />
                Todos os colaboradores
              </label>
              {!form.allPositions &&
                positions
                  .filter((p) => p.active || form.positionIds.includes(p.id))
                  .map((p) => (
                    <label key={p.id} className="flex items-center gap-1.5 text-sm text-stone-600">
                      <input type="checkbox" checked={form.positionIds.includes(p.id)} onChange={() => togglePosition(p.id)} />
                      {p.active ? p.name : `${p.name} (inativo)`}
                    </label>
                  ))}
            </div>
          </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-600">Tipos de ficheiro aceites</label>
            <div className="flex flex-wrap gap-3">
              {ACCEPTED_MIME_TYPE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1.5 text-sm text-stone-600">
                  <input
                    type="checkbox"
                    checked={form.acceptedMimeTypes.includes(opt.value)}
                    onChange={() => toggleMimeType(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "A guardar…" : editingId ? "Guardar alterações" : "Criar categoria"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
              >
                Cancelar edição
              </button>
            )}
          </div>
        </form>

        <div className="px-5 py-4">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-stone-400">A carregar…</p>
          ) : categories.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-400">Ainda não há categorias.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-stone-100">
                <tr>
                  <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Nome</th>
                  <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Cargos</th>
                  <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Tipos</th>
                  <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Estado</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {categories.map((c) => (
                  <tr key={c.id} className={c.active ? "" : "opacity-50"}>
                    <td className="py-2 pr-2">
                      <p className="font-medium text-stone-700">{c.label}</p>
                      {c.mandatory && <span className="text-xs text-amber-600">Obrigatório</span>}
                      {c.scope !== "employee" && (
                        <span className="ml-1 text-xs text-stone-500">· {DOCUMENT_CATEGORY_SCOPE_LABELS[c.scope]}</span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-stone-500">
                      {c.positionIds.length === 0 ? "Todos" : c.positionIds.map((id) => positionName.get(id) ?? "Cargo removido").join(", ")}
                    </td>
                    <td className="py-2 pr-2 text-stone-500">
                      {c.acceptedMimeTypes
                        .map((m) => ACCEPTED_MIME_TYPE_OPTIONS.find((o) => o.value === m)?.label ?? m)
                        .join(", ")}
                    </td>
                    <td className="py-2 pr-2 text-stone-500">{c.active ? "Ativa" : "Inativa"}</td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-3 text-xs font-medium">
                        <button type="button" onClick={() => startEdit(c)} className="text-[#ED5C32] hover:underline">
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveMutation.mutate({ id: c.id, active: !c.active })}
                          className="text-stone-500 hover:underline"
                        >
                          {c.active ? "Desativar" : "Reativar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
