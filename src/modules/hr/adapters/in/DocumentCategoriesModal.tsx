import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import { JOB_ROLE_LABELS, type JobRole } from "../../domain/entities/employee.ts";
import { ACCEPTED_MIME_TYPE_OPTIONS, type DocumentCategoryDefinition } from "../../domain/entities/document-category.ts";

const ALL_JOB_ROLES = Object.keys(JOB_ROLE_LABELS) as JobRole[];
const DEFAULT_MIME_TYPES = ACCEPTED_MIME_TYPE_OPTIONS.map((o) => o.value);

interface FormState {
  label: string;
  mandatory: boolean;
  allRoles: boolean;
  jobRoles: JobRole[];
  acceptedMimeTypes: string[];
}

function emptyForm(): FormState {
  return { label: "", mandatory: false, allRoles: true, jobRoles: [], acceptedMimeTypes: [...DEFAULT_MIME_TYPES] };
}

function formFromDefinition(def: DocumentCategoryDefinition): FormState {
  return {
    label: def.label,
    mandatory: def.mandatory,
    allRoles: def.jobRoles.length === 0,
    jobRoles: def.jobRoles,
    acceptedMimeTypes: def.acceptedMimeTypes,
  };
}

export function DocumentCategoriesModal({ onClose }: { onClose: () => void }) {
  const { api } = useHrModule();
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
        jobRoles: form.allRoles ? [] : form.jobRoles,
        acceptedMimeTypes: form.acceptedMimeTypes,
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
        jobRoles: form.allRoles ? [] : form.jobRoles,
        acceptedMimeTypes: form.acceptedMimeTypes,
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

  function toggleRole(role: JobRole) {
    setForm((f) => ({
      ...f,
      jobRoles: f.jobRoles.includes(role) ? f.jobRoles.filter((r) => r !== role) : [...f.jobRoles, role],
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
            <label className="flex items-center gap-1.5 pb-2 text-sm text-stone-600">
              <input
                type="checkbox"
                checked={form.mandatory}
                onChange={(e) => setForm((f) => ({ ...f, mandatory: e.target.checked }))}
              />
              Obrigatório
            </label>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-600">Cargos</label>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1.5 text-sm text-stone-600">
                <input
                  type="checkbox"
                  checked={form.allRoles}
                  onChange={(e) => setForm((f) => ({ ...f, allRoles: e.target.checked, jobRoles: [] }))}
                />
                Todos os cargos
              </label>
              {!form.allRoles &&
                ALL_JOB_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-1.5 text-sm text-stone-600">
                    <input
                      type="checkbox"
                      checked={form.jobRoles.includes(role)}
                      onChange={() => toggleRole(role)}
                    />
                    {JOB_ROLE_LABELS[role]}
                  </label>
                ))}
            </div>
          </div>

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
                    </td>
                    <td className="py-2 pr-2 text-stone-500">
                      {c.jobRoles.length === 0 ? "Todos" : c.jobRoles.map((r) => JOB_ROLE_LABELS[r]).join(", ")}
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
