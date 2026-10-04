import { useState } from "react";
import { useAuth } from "../../../../contexts/AuthContext.tsx";
import type { LocationDTO, LocationFormValues } from "../../domain/entities/location.ts";
import { sortLocationsForAdmin } from "../../domain/services/location-form.service.ts";
import { LocationDrawer } from "./LocationDrawer.tsx";
import { useLocations } from "./use-locations.ts";
import { useManageLocations } from "./use-manage-locations.ts";

type DrawerState = { mode: "closed" } | { mode: "create" } | { mode: "edit"; location: LocationDTO };

function placeOf(l: LocationDTO): string {
  const parts = [l.city, l.municipality && l.municipality !== l.city ? l.municipality : null].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

/**
 * Empresa & Estrutura → Locais. Todos veem a lista; criar, editar e
 * ativar/inativar só `admin` (como o backend). Nunca há "apagar".
 */
export function LocationsAdminView() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin";
  const { locations, loading, error } = useLocations();
  const { createMutation, updateMutation, setActiveMutation } = useManageLocations();
  const [drawer, setDrawer] = useState<DrawerState>({ mode: "closed" });
  const [showInactive, setShowInactive] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<LocationDTO | null>(null);

  const inactiveCount = locations.filter((l) => !l.isActive).length;
  const visible = sortLocationsForAdmin(locations).filter((l) => showInactive || l.isActive);
  const saveMutation = drawer.mode === "edit" ? updateMutation : createMutation;

  function openDrawer(next: DrawerState) {
    createMutation.reset();
    updateMutation.reset();
    setDrawer(next);
  }

  function handleSubmit(values: LocationFormValues) {
    const onSuccess = () => setDrawer({ mode: "closed" });
    if (drawer.mode === "edit") updateMutation.mutate({ current: drawer.location, values }, { onSuccess });
    else createMutation.mutate(values, { onSuccess });
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Locais</h2>
          <p className="text-xs text-stone-500">Lojas e espaços da organização. Um local inativo deixa de aparecer nos seletores, mas o histórico mantém-se.</p>
        </div>
        <div className="flex items-center gap-3">
          {inactiveCount > 0 && (
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Mostrar inativos ({inactiveCount})
            </label>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => openDrawer({ mode: "create" })}
              className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
            >
              Novo local
            </button>
          )}
        </div>
      </div>

      {loading && <p className="text-sm text-stone-500">A carregar…</p>}
      {error && <p className="text-sm text-[#A3211A]">Não foi possível carregar os locais.</p>}
      {setActiveMutation.isError && <p className="text-sm text-[#A3211A]">Não foi possível alterar o estado do local.</p>}

      {!loading && (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2 font-medium">Local</th>
                <th className="px-4 py-2 font-medium">Localidade · Município</th>
                <th className="px-4 py-2 font-medium">Fuso horário</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                {canEdit && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visible.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-4 py-6 text-center text-stone-500">
                    Sem locais.
                  </td>
                </tr>
              )}
              {visible.map((l) => (
                <tr key={l.id} className={l.isActive ? "" : "text-stone-400"}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-stone-800">{l.name}</span>
                    {l.code && <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">{l.code}</span>}
                  </td>
                  <td className="px-4 py-3">{placeOf(l)}</td>
                  <td className="px-4 py-3">{l.timezone}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        l.isActive ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {l.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="space-x-3 px-4 py-3 text-right">
                      <button type="button" onClick={() => openDrawer({ mode: "edit", location: l })} className="text-sm font-medium text-[#ED5C32] hover:underline">
                        Editar
                      </button>
                      {l.isActive ? (
                        <button type="button" onClick={() => setConfirmDeactivate(l)} className="text-sm text-stone-500 hover:underline">
                          Inativar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveMutation.mutate({ id: l.id, active: true })}
                          disabled={setActiveMutation.isPending}
                          className="text-sm text-stone-500 hover:underline"
                        >
                          Ativar
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDeactivate && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20" role="alertdialog" aria-modal="true" aria-label="Confirmar inativação">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-stone-900">Inativar {confirmDeactivate.name}?</h3>
            <p className="mt-2 text-sm text-stone-600">
              O local deixa de aparecer nos seletores de novos registos. Turnos, movimentos de stock, faturas e restante histórico associados
              continuam válidos. Pode voltar a ativá-lo a qualquer momento.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDeactivate(null)} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setActiveMutation.mutate({ id: confirmDeactivate.id, active: false }, { onSettled: () => setConfirmDeactivate(null) })}
                disabled={setActiveMutation.isPending}
                className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Inativar
              </button>
            </div>
          </div>
        </div>
      )}

      {drawer.mode !== "closed" && (
        <LocationDrawer
          editing={drawer.mode === "edit" ? drawer.location : null}
          saving={saveMutation.isPending}
          error={saveMutation.error}
          onSubmit={handleSubmit}
          onClose={() => setDrawer({ mode: "closed" })}
        />
      )}
    </div>
  );
}
