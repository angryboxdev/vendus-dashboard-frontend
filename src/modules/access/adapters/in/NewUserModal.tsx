import { useState } from "react";
import { useEmployeeOptions, useProfiles, useUserMutations } from "./use-access-admin.ts";

/**
 * Novo utilizador (task §9; decisão "Colaborador → escolher a ficha"):
 * normalmente basta email + perfil. Colaborador exige a ficha; para
 * outros perfis a ficha é opcional (gestor que também trabalha nas escalas).
 */
export function NewUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (email: string, temporaryPassword: string) => void }) {
  const { data: profiles = [] } = useProfiles();
  const { data: employees = [] } = useEmployeeOptions();
  const { create } = useUserMutations();
  const [email, setEmail] = useState("");
  const [profileId, setProfileId] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  const active = profiles.filter((p) => p.active);
  const selected = active.find((p) => p.id === profileId);
  const needsEmployee = selected?.systemKey === "colaborador";
  const canSubmit = email.trim() !== "" && !!selected && (!needsEmployee || !!employeeId) && !create.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    create.mutate(
      { email: email.trim(), profileId, employeeId: employeeId || null },
      { onSuccess: (r) => onCreated(r.user.email, r.temporaryPassword) },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Novo utilizador">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900">Novo utilizador</h2>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Fechar">
            ✕
          </button>
        </div>
        <div>
          <label htmlFor="nu-email" className="mb-1 block text-sm font-medium text-stone-700">Email</label>
          <input id="nu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="nu-profile" className="mb-1 block text-sm font-medium text-stone-700">Perfil de acesso</label>
          <select id="nu-profile" value={profileId} onChange={(e) => setProfileId(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm">
            <option value="">Escolher…</option>
            {active.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {selected?.description && <p className="mt-1 text-xs text-stone-500">{selected.description}</p>}
        </div>
        <div>
          <label htmlFor="nu-employee" className="mb-1 block text-sm font-medium text-stone-700">
            Associado a colaborador {needsEmployee ? "" : <span className="font-normal text-stone-400">(opcional)</span>}
          </label>
          <select id="nu-employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm">
            <option value="">{needsEmployee ? "Escolher a ficha…" : "Nenhum"}</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id} disabled={!!e.linkedUserId}>
                {e.fullName}
                {e.linkedUserId ? " (já tem conta)" : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-stone-500">Nunca cria um colaborador novo — liga a conta a uma ficha existente.</p>
        </div>
        {create.error && <p className="text-sm text-red-600">{create.error instanceof Error ? create.error.message : "Erro ao criar"}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700">
            Cancelar
          </button>
          <button type="submit" disabled={!canSubmit} className="rounded-lg bg-[#ED5C32] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {create.isPending ? "A criar…" : "Criar utilizador"}
          </button>
        </div>
      </form>
    </div>
  );
}
