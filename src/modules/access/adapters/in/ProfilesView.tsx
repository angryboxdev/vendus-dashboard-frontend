import { useState } from "react";
import { Link } from "react-router-dom";
import type { AccessLevel, AccessProfile, CatalogModule, PermissionMap } from "../../domain/entities/access.ts";
import { effectiveOf, moduleStateOf, setProfileModuleLevel } from "../../domain/services/access-ui.service.ts";
import { LevelSelect, StateBadge } from "./access-ui.tsx";
import { useCatalog, useProfileMutations, useProfiles } from "./use-access-admin.ts";

/** Perfis de acesso (ticket 07, mockup 4): acessos padrão usados ao criar utilizadores. */
export function ProfilesView() {
  const { data: profiles = [], isLoading } = useProfiles();
  const { data: catalog } = useCatalog();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ baseId: string | null } | null>(null);
  const selected = profiles.find((p) => p.id === selectedId) ?? profiles[0];

  if (isLoading || !catalog) return <p className="p-6 text-sm text-stone-500">A carregar…</p>;

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/admin/users" className="text-xs font-medium text-stone-500 hover:underline">
            ← Utilizadores
          </Link>
          <h1 className="text-2xl font-semibold text-stone-900">Perfis de acesso</h1>
          <p className="text-sm text-stone-500">Defina os acessos padrão do sistema. Estes perfis são usados ao criar novos utilizadores.</p>
        </div>
        <button type="button" onClick={() => setCreating({ baseId: null })} className="rounded-lg bg-[#ED5C32] px-4 py-2 text-sm font-medium text-white hover:bg-[#d94f28]">
          + Novo perfil
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr_17rem]">
        <nav aria-label="Perfis" className="space-y-1 self-start rounded-xl border border-[#F5C992]/40 bg-white p-2">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className={`w-full rounded-lg px-3 py-2.5 text-left ${p.id === selected?.id ? "bg-[#FEF3EC] shadow-[inset_3px_0_0_#ED5C32]" : "hover:bg-stone-50"}`}
            >
              <p className="flex items-center gap-2 text-sm font-medium text-stone-900">
                {p.name}
                {!p.active && <span className="rounded bg-stone-100 px-1.5 text-[10px] font-medium text-stone-500">Desativado</span>}
              </p>
              <p className="text-xs text-stone-500">
                {p.userCount} {p.userCount === 1 ? "utilizador" : "utilizadores"}
              </p>
            </button>
          ))}
        </nav>

        {selected && <ProfileEditor key={`${selected.id}:${selected.version}`} profile={selected} catalog={catalog} onDuplicate={() => setCreating({ baseId: selected.id })} />}

        <aside className="space-y-4 self-start">
          <div className="space-y-3 rounded-xl border border-[#F5C992]/40 bg-white p-4 text-sm">
            <h3 className="font-semibold text-stone-900">Níveis de acesso</h3>
            <p>
              <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">Sem acesso</span>
              <span className="mt-1 block text-xs text-stone-500">Não visualiza nem utiliza a função.</span>
            </p>
            <p>
              <span className="rounded bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">Ver</span>
              <span className="mt-1 block text-xs text-stone-500">Apenas consulta. Não pode alterar dados.</span>
            </p>
            <p>
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Gerir</span>
              <span className="mt-1 block text-xs text-stone-500">Consulta e utiliza as operações normais da função.</span>
            </p>
          </div>
          <div className="rounded-xl bg-sky-50 p-4 text-xs text-sky-900">
            <p className="mb-1 font-semibold">Como funciona</p>
            Ao criar um utilizador com este perfil, ele recebe estes acessos. Alterar o perfil atualiza logo quem herda; as personalizações individuais mantêm-se.
          </div>
        </aside>
      </div>

      {creating && <NewProfileModal profiles={profiles} baseId={creating.baseId} onClose={() => setCreating(null)} onCreated={(id) => { setCreating(null); setSelectedId(id); }} />}
    </div>
  );
}

function ProfileEditor({ profile, catalog, onDuplicate }: { profile: AccessProfile; catalog: CatalogModule[]; onDuplicate: () => void }) {
  const { update, setActive } = useProfileMutations();
  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description ?? "");
  const [permissions, setPermissions] = useState<PermissionMap>(profile.permissions);
  const [open, setOpen] = useState<Set<string>>(new Set([catalog[0]?.key ?? ""]));
  const locked = profile.isProtected;
  const effective = effectiveOf(permissions, {}, profile.systemKey === "admin", catalog);
  const dirty = name !== profile.name || description !== (profile.description ?? "") || JSON.stringify(permissions) !== JSON.stringify(profile.permissions);

  const setLevel = (key: string, level: AccessLevel) => setPermissions((p) => ({ ...p, [key]: level }));
  const toggle = (key: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  function save() {
    update.mutate({ profileId: profile.id, input: { version: profile.version, name, description: description || null, permissions } });
  }

  const error = update.error ?? setActive.error;

  return (
    <section className="space-y-4" aria-label={`Perfil ${profile.name}`}>
      <div className="space-y-3 rounded-xl border border-[#F5C992]/40 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            {locked ? (
              <h2 className="text-lg font-semibold text-stone-900">{profile.name}</h2>
            ) : (
              <input aria-label="Nome do perfil" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-lg font-semibold" />
            )}
            {locked ? (
              <p className="text-sm text-stone-500">{profile.description}</p>
            ) : (
              <input aria-label="Descrição do perfil" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição" className="w-full rounded-lg border border-stone-200 px-3 py-1.5 text-sm" />
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {profile.systemKey && <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Perfil padrão do sistema</span>}
            {locked && <p className="max-w-[16rem] text-right text-xs text-stone-500">Este perfil é protegido: não pode ser alterado nem desativado.</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onDuplicate} className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">
            Duplicar
          </button>
          {!locked && (
            <button
              type="button"
              onClick={() =>
                (profile.active ? window.confirm(`Desativar o perfil ${profile.name}? Quem já o tem mantém-no; deixa de poder ser atribuído.`) : true) &&
                setActive.mutate({ profileId: profile.id, active: !profile.active, version: profile.version })
              }
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              {profile.active ? "Desativar" : "Reativar"}
            </button>
          )}
          <button type="button" onClick={() => setOpen(new Set(catalog.map((m) => m.key)))} className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">
            Expandir todos
          </button>
          <button type="button" onClick={() => setOpen(new Set())} className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">
            Recolher todos
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {catalog.map((m) => {
          const state = moduleStateOf(m, effective);
          const isOpen = open.has(m.key);
          return (
            <div key={m.key} className="rounded-xl border border-[#F5C992]/40 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <button type="button" onClick={() => toggle(m.key)} className="min-w-0 flex-1 text-left" aria-expanded={isOpen}>
                  <p className="font-medium text-stone-900">{m.label}</p>
                  <p className="text-xs text-stone-500">{m.description}</p>
                </button>
                <div className="flex items-center gap-2">
                  {locked ? (
                    <StateBadge state={state} />
                  ) : (
                    <select
                      aria-label={`Acesso do módulo ${m.label}`}
                      value={state === "mixed" ? "" : state === "none" ? "NONE" : state === "read_all" ? "READ" : "MANAGE"}
                      onChange={(e) => e.target.value && setPermissions((p) => setProfileModuleLevel(p, m, e.target.value as AccessLevel))}
                      className="w-36 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm"
                    >
                      {state === "mixed" && <option value="">Parcial</option>}
                      <option value="NONE">Sem acesso</option>
                      <option value="READ">Ver tudo</option>
                      <option value="MANAGE">Gerir tudo</option>
                    </select>
                  )}
                  <span className="text-xs text-stone-400">{m.functions.length} funções</span>
                </div>
              </div>
              {isOpen && (
                <table className="min-w-full border-t border-stone-100 text-sm">
                  <tbody className="divide-y divide-stone-100">
                    {[...m.functions.map((f) => ({ ...f, special: false })), ...m.specials.map((f) => ({ ...f, special: true }))].map((f) => (
                      <tr key={f.key}>
                        <td className="px-4 py-2.5 font-medium text-stone-800">
                          {f.label}
                          {f.special && <span className="ml-2 rounded bg-stone-100 px-1.5 text-[10px] font-medium text-stone-500">especial</span>}
                        </td>
                        <td className="px-4 py-2.5 text-stone-500">{f.description}</td>
                        <td className="px-4 py-2.5 text-right">
                          <LevelSelect special={f.special} label={`${m.label}: ${f.label}`} value={effective[f.key] ?? "NONE"} disabled={locked} onChange={(l) => setLevel(f.key, l)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
        <div className="rounded-xl border border-[#F5C992]/40 bg-white px-4 py-3 opacity-70">
          <p className="font-medium text-stone-900">Utilizadores 🔒</p>
          <p className="text-xs text-stone-500">Gestão de utilizadores e perfis — exclusivo do Admin.</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error instanceof Error ? error.message : "Erro ao gravar"}</p>}
      {!locked && (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setName(profile.name);
              setDescription(profile.description ?? "");
              setPermissions(profile.permissions);
            }}
            disabled={!dirty}
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button type="button" onClick={save} disabled={!dirty || update.isPending} className="rounded-lg bg-[#ED5C32] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {update.isPending ? "A guardar…" : "Guardar perfil"}
          </button>
        </div>
      )}
    </section>
  );
}

function NewProfileModal({ profiles, baseId, onClose, onCreated }: { profiles: AccessProfile[]; baseId: string | null; onClose: () => void; onCreated: (id: string) => void }) {
  const { create } = useProfileMutations();
  const base = profiles.find((p) => p.id === baseId);
  const [name, setName] = useState(base ? `${base.name} (cópia)` : "");
  const [description, setDescription] = useState("");
  const [baseProfileId, setBaseProfileId] = useState(baseId ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Novo perfil">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ name, description: description || null, baseProfileId: baseProfileId || null }, { onSuccess: (p) => onCreated(p.id) });
        }}
        className="w-full max-w-md space-y-4 rounded-xl border border-stone-200 bg-white p-5 shadow-xl"
      >
        <h2 className="text-base font-semibold text-stone-900">{baseId ? "Duplicar perfil" : "Novo perfil"}</h2>
        <div>
          <label htmlFor="np-name" className="mb-1 block text-sm font-medium text-stone-700">Nome</label>
          <input id="np-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Supervisor de Loja" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="np-desc" className="mb-1 block text-sm font-medium text-stone-700">Descrição</label>
          <input id="np-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="np-base" className="mb-1 block text-sm font-medium text-stone-700">Usar como base</label>
          <select id="np-base" value={baseProfileId} onChange={(e) => setBaseProfileId(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm">
            <option value="">Começar sem acessos</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                Copiar {p.name}
              </option>
            ))}
          </select>
        </div>
        {create.error && <p className="text-sm text-red-600">{create.error instanceof Error ? create.error.message : "Erro"}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700">
            Cancelar
          </button>
          <button type="submit" disabled={!name.trim() || create.isPending} className="rounded-lg bg-[#ED5C32] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {create.isPending ? "A criar…" : "Criar e configurar"}
          </button>
        </div>
      </form>
    </div>
  );
}
