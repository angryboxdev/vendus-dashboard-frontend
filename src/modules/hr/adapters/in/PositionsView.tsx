import { useState, type FormEvent } from "react";
import { ApiError } from "../../../../lib/api.ts";
import { useAuth } from "../../../../contexts/AuthContext.tsx";
import { JOB_ROLE_LABELS, type JobRole } from "../../domain/entities/employee.ts";
import type { Position } from "../../domain/entities/position.ts";
import { PeopleTabs } from "./PeopleTabs.tsx";
import { useManagePositions, usePositions } from "./use-positions.ts";

const inputCls =
  "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30";
const labelCls = "mb-1.5 block text-sm font-medium text-stone-700";

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError && error.status === 409) return "Já existe um cargo com este nome.";
  if (error instanceof ApiError && error.status === 400) return error.message;
  return "Não foi possível guardar. Tente novamente.";
}

function PositionDrawer({
  editing,
  saving,
  error,
  onSave,
  onClose,
}: {
  editing: Position | null;
  saving: boolean;
  error: unknown;
  onSave: (payload: { name: string; description: string | null; operationalCategory: JobRole }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [operationalCategory, setOperationalCategory] = useState<JobRole>(editing?.operationalCategory ?? "service");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave({ name, description: description.trim() || null, operationalCategory });
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl" role="dialog" aria-label={editing ? "Editar cargo" : "Novo cargo"}>
        <div className="flex items-center justify-between border-b border-[#F5C992]/40 px-6 py-4">
          <h2 className="text-base font-semibold text-stone-800">{editing ? "Editar cargo" : "Novo cargo"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100" aria-label="Fechar">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          <div>
            <label htmlFor="position-name" className={labelCls}>
              Nome <span className="text-red-500">*</span>
            </label>
            <input id="position-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Gerente de Loja" className={inputCls} />
          </div>
          <div>
            <label htmlFor="position-description" className={labelCls}>
              Descrição
            </label>
            <textarea id="position-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="position-category" className={labelCls}>
              Categoria nas Escalas
            </label>
            <select
              id="position-category"
              value={operationalCategory}
              onChange={(e) => setOperationalCategory(e.target.value as JobRole)}
              className={inputCls}
            >
              {Object.entries(JOB_ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-stone-500">
              As Escalas (rotações) e as categorias de documentos ainda agrupam por esta categoria. Não dá permissões no Hub.
            </p>
          </div>
          {errorMessage(error) && <p className="text-sm text-red-600">{errorMessage(error)}</p>}
          <div className="mt-auto flex justify-end gap-2 border-t border-stone-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "A guardar…" : editing ? "Guardar alterações" : "Criar cargo"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}

/**
 * Colaboradores → Cargos (Base Organizacional, ticket 07). Todos os roles do
 * RH veem; `hr_viewer` não edita (como o backend). Nunca há "apagar" — um
 * cargo já usado fica inativo e quem o tem mantém-no.
 */
export function PositionsView() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "manager";
  const { data: positions = [], isLoading, isError } = usePositions();
  const { saveMutation, setActiveMutation } = useManagePositions();
  const [drawer, setDrawer] = useState<{ open: false } | { open: true; editing: Position | null }>({ open: false });

  function openDrawer(editing: Position | null) {
    saveMutation.reset();
    setDrawer({ open: true, editing });
  }

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-stone-900">Colaboradores</h1>
            <p className="text-xs text-stone-500">Cargos da organização. Um cargo não dá permissões no Hub.</p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => openDrawer(null)}
              className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
            >
              Novo cargo
            </button>
          )}
        </div>
        <PeopleTabs />
      </div>

      <div className="flex-1 p-4">
        {isLoading && <p className="text-sm text-stone-500">A carregar…</p>}
        {isError && <p className="text-sm text-red-600">Não foi possível carregar os cargos.</p>}
        {setActiveMutation.isError && <p className="mb-2 text-sm text-red-600">Não foi possível alterar o estado do cargo.</p>}
        {!isLoading && !isError && (
          <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-[#FDF8F5] text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-3 py-2">Cargo</th>
                  <th className="px-3 py-2">Descrição</th>
                  <th className="px-3 py-2">Categoria nas Escalas</th>
                  <th className="px-3 py-2">Colaboradores</th>
                  <th className="px-3 py-2">Estado</th>
                  {canEdit && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5C992]/30">
                {positions.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 6 : 5} className="px-3 py-6 text-center text-stone-500">
                      Sem cargos.
                    </td>
                  </tr>
                )}
                {positions.map((p) => (
                  <tr key={p.id} className={p.active ? "" : "text-stone-400"}>
                    <td className="px-3 py-2 font-medium text-stone-800">{p.name}</td>
                    <td className="px-3 py-2 text-stone-500">{p.description ?? "—"}</td>
                    <td className="px-3 py-2">{JOB_ROLE_LABELS[p.operationalCategory]}</td>
                    <td className="px-3 py-2">{p.employeeCount}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.active ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                        {p.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="space-x-3 px-3 py-2 text-right">
                        <button type="button" onClick={() => openDrawer(p)} className="text-sm font-medium text-[#ED5C32] hover:underline">
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveMutation.mutate({ id: p.id, active: !p.active })}
                          disabled={setActiveMutation.isPending}
                          className="text-sm text-stone-500 hover:underline"
                        >
                          {p.active ? "Inativar" : "Ativar"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {drawer.open && (
        <PositionDrawer
          editing={drawer.editing}
          saving={saveMutation.isPending}
          error={saveMutation.error}
          onClose={() => setDrawer({ open: false })}
          onSave={(payload) =>
            saveMutation.mutate({ id: drawer.editing?.id ?? null, payload }, { onSuccess: () => setDrawer({ open: false }) })
          }
        />
      )}
    </div>
  );
}
