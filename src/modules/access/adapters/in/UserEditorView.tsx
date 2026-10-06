import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { AccessLevel, CatalogModule, PermissionMap, UserDetail } from "../../domain/entities/access.ts";
import {
  effectiveOf,
  grantedCount,
  moduleCustomized,
  moduleStateOf,
  restoreDefault,
  setUserLevel,
  setUserModuleLevel,
} from "../../domain/services/access-ui.service.ts";
import { Avatar, LevelSelect, OriginBadge, StateBadge, TemporaryPasswordNotice } from "./access-ui.tsx";
import { useCatalog, useEmployeeOptions, useProfiles, useUser, useUserMutations } from "./use-access-admin.ts";

/** Rota `/admin/users/:userId` — carrega e entrega ao editor (chave = versão, para reiniciar o rascunho depois de gravar). */
export function UserEditorView() {
  const { userId } = useParams();
  const { data: user, isLoading, error } = useUser(userId);
  const { data: catalog } = useCatalog();
  if (isLoading || !catalog) return <p className="p-6 text-sm text-stone-500">A carregar…</p>;
  if (error || !user) return <p className="p-6 text-sm text-red-600">Utilizador não encontrado.</p>;
  return <UserEditor key={`${user.userId}:${user.version}`} user={user} catalog={catalog} />;
}

function UserEditor({ user, catalog }: { user: UserDetail; catalog: CatalogModule[] }) {
  const navigate = useNavigate();
  const { data: profiles = [] } = useProfiles();
  const { data: employees = [] } = useEmployeeOptions();
  const { update, setStatus, resetPassword } = useUserMutations(user.userId);
  const [profileId, setProfileId] = useState(user.profile.id ?? "");
  const [overrides, setOverrides] = useState<PermissionMap>(user.overrides);
  const [employeeId, setEmployeeId] = useState(user.employee?.id ?? "");
  const [moduleKey, setModuleKey] = useState(catalog[0]?.key ?? "");
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const profile = profiles.find((p) => p.id === profileId);
  const isAdmin = profile?.systemKey === "admin";
  const portalOnly = profile?.systemKey === "colaborador";
  const locked = isAdmin || portalOnly;
  const profilePerms: PermissionMap = portalOnly ? {} : (profile?.permissions ?? user.profilePermissions);
  const activeOverrides: PermissionMap = locked ? {} : overrides;
  const effective = effectiveOf(profilePerms, activeOverrides, isAdmin, catalog);
  const mod = catalog.find((m) => m.key === moduleKey) ?? catalog[0]!;
  const profileName = profile?.name ?? user.profile.name;

  const dirty =
    profileId !== (user.profile.id ?? "") ||
    employeeId !== (user.employee?.id ?? "") ||
    JSON.stringify(activeOverrides) !== JSON.stringify(locked ? {} : user.overrides);

  function save() {
    update.mutate(
      {
        version: user.version,
        ...(profileId !== (user.profile.id ?? "") && { profileId }),
        overrides: activeOverrides,
        ...(employeeId !== (user.employee?.id ?? "") && { employeeId: employeeId || null }),
      },
      { onSuccess: () => navigate("/admin/users") },
    );
  }

  function toggleStatus() {
    const disabling = user.status === "active";
    if (disabling && !window.confirm(`Desativar ${user.displayName}? Deixa de conseguir entrar no sistema (no pedido seguinte).`)) return;
    setStatus.mutate({ status: disabling ? "disabled" : "active", version: user.version });
  }

  function setModule(level: AccessLevel) {
    setOverrides((o) => setUserModuleLevel(o, profilePerms, mod, level));
  }

  const error = update.error ?? setStatus.error ?? resetPassword.error;
  const state = moduleStateOf(mod, effective);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-start justify-between border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-900">Editar utilizador</h1>
          <p className="text-sm text-stone-500">Defina o perfil e as permissões de acesso ao sistema.</p>
        </div>
        <Link to="/admin/users" className="text-stone-400 hover:text-stone-600" aria-label="Fechar">
          ✕
        </Link>
      </div>

      <div className="grid flex-1 gap-4 p-6 lg:grid-cols-[15rem_1fr_19rem]">
        {/* Módulos */}
        <nav aria-label="Módulos" className="space-y-1 rounded-xl border border-[#F5C992]/40 bg-white p-2">
          {catalog.map((m) => {
            const customized = !locked && moduleCustomized(m, activeOverrides);
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setModuleKey(m.key)}
                className={`w-full rounded-lg px-3 py-2.5 text-left ${m.key === mod.key ? "bg-[#FEF3EC] shadow-[inset_3px_0_0_#ED5C32]" : "hover:bg-stone-50"}`}
              >
                <p className="text-sm font-medium text-stone-900">{m.label}</p>
                <div className="mt-1 flex items-center gap-2">
                  <StateBadge state={moduleStateOf(m, effective)} customized={customized} />
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  {grantedCount(m, effective)} de {m.functions.length} funções
                </p>
              </button>
            );
          })}
          <div className="rounded-lg px-3 py-2.5 text-left opacity-70">
            <p className="text-sm font-medium text-stone-900">Utilizadores 🔒</p>
            <p className="text-xs text-stone-500">Apenas administradores</p>
          </div>
        </nav>

        {/* Funcionalidades do módulo */}
        <section className="space-y-4 rounded-xl border border-[#F5C992]/40 bg-white p-5" aria-label={`Permissões de ${mod.label}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-900">{mod.label}</h2>
              <p className="text-sm text-stone-500">{mod.description}</p>
            </div>
            <div>
              <label htmlFor="module-level" className="mb-1 block text-xs font-medium text-stone-600">Acesso do módulo</label>
              <select
                id="module-level"
                disabled={locked}
                value={state === "mixed" ? "" : state === "none" ? "NONE" : state === "read_all" ? "READ" : "MANAGE"}
                onChange={(e) => e.target.value && setModule(e.target.value as AccessLevel)}
                className="w-44 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm disabled:bg-stone-50"
              >
                {state === "mixed" && <option value="">Personalizado</option>}
                <option value="NONE">Sem acesso</option>
                <option value="READ">Ver tudo</option>
                <option value="MANAGE">Gerir tudo</option>
              </select>
              <p className="mt-1 text-xs text-stone-400">Aplica a todas as funções deste módulo.</p>
            </div>
          </div>

          {isAdmin && <p className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-800">Acesso total — o perfil Admin não se personaliza função a função.</p>}
          {portalOnly && <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-700">Perfil Colaborador: só o Portal do Colaborador, sem módulos de gestão.</p>}

          <table className="min-w-full text-sm">
            <thead className="border-b border-stone-100">
              <tr>
                {["Função", "Descrição", "Acesso", "Origem"].map((h) => (
                  <th key={h} className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {mod.functions.map((f) => (
                <tr key={f.key}>
                  <td className="py-2.5 pr-3 font-medium text-stone-800">{f.label}</td>
                  <td className="py-2.5 pr-3 text-stone-500">{f.description}</td>
                  <td className="py-2.5 pr-3">
                    <LevelSelect label={`Acesso a ${f.label}`} value={effective[f.key] ?? "NONE"} disabled={locked} onChange={(l) => setOverrides((o) => setUserLevel(o, profilePerms, f.key, l))} />
                  </td>
                  <td className="py-2.5">
                    {!locked && <OriginBadge customized={f.key in activeOverrides} profileName={profileName} onRestore={() => setOverrides((o) => restoreDefault(o, f.key))} />}
                  </td>
                </tr>
              ))}
              {mod.specials.length > 0 && (
                <tr>
                  <td colSpan={4} className="pt-4 text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Permissões especiais
                  </td>
                </tr>
              )}
              {mod.specials.map((f) => (
                <tr key={f.key}>
                  <td className="py-2.5 pr-3 font-medium text-stone-800">{f.label}</td>
                  <td className="py-2.5 pr-3 text-stone-500">{f.description}</td>
                  <td className="py-2.5 pr-3">
                    <LevelSelect special label={`Acesso a ${f.label}`} value={effective[f.key] ?? "NONE"} disabled={locked} onChange={(l) => setOverrides((o) => setUserLevel(o, profilePerms, f.key, l))} />
                  </td>
                  <td className="py-2.5">
                    {!locked && <OriginBadge customized={f.key in activeOverrides} profileName={profileName} onRestore={() => setOverrides((o) => restoreDefault(o, f.key))} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Resumo */}
        <aside className="space-y-4">
          <div className="space-y-4 rounded-xl border border-[#F5C992]/40 bg-white p-4">
            <div className="flex items-center gap-3">
              <Avatar name={user.displayName} size="lg" />
              <div className="min-w-0">
                <p className="font-semibold text-stone-900">{user.displayName}</p>
                <p className="truncate text-sm text-stone-500">{user.email}</p>
                <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-medium ${user.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                  {user.status === "active" ? "Ativo" : "Desativado"}
                </span>
              </div>
            </div>
            <div>
              <label htmlFor="ue-profile" className="mb-1 block text-xs font-medium text-stone-600">Perfil de acesso</label>
              <select id="ue-profile" value={profileId} onChange={(e) => setProfileId(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm">
                {profiles
                  .filter((p) => p.active || p.id === user.profile.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-stone-500">O perfil define os acessos padrão. Pode personalizar os acessos ao lado.</p>
            </div>
            <div>
              <label htmlFor="ue-employee" className="mb-1 block text-xs font-medium text-stone-600">Associado a colaborador</label>
              <select id="ue-employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm">
                <option value="">Nenhum</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id} disabled={!!e.linkedUserId && e.linkedUserId !== user.userId}>
                    {e.fullName}
                    {e.linkedUserId && e.linkedUserId !== user.userId ? " (já tem conta)" : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-stone-500">Com ficha associada, a pessoa vê também o seu Portal (turnos, picagens).</p>
            </div>
          </div>

          <div className="rounded-xl border border-[#F5C992]/40 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-stone-900">Resumo de acessos</h3>
            <ul className="space-y-2">
              {catalog.map((m) => (
                <li key={m.key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-stone-700">{m.label}</span>
                  <StateBadge state={moduleStateOf(m, effective)} customized={!locked && moduleCustomized(m, activeOverrides)} />
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-lg bg-sky-50 p-3 text-xs text-sky-900">
              As alterações personalizadas substituem o padrão do perfil. Use "Restaurar padrão" para voltar a herdar as permissões.
            </p>
          </div>

          {tempPassword && <TemporaryPasswordNotice password={tempPassword} onClose={() => setTempPassword(null)} />}
        </aside>
      </div>

      {error && <p className="px-6 text-sm text-red-600">{error instanceof Error ? error.message : "Erro ao gravar"}</p>}

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleStatus}
            disabled={setStatus.isPending}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${user.status === "active" ? "border-red-300 text-red-600 hover:bg-red-50" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}
          >
            {user.status === "active" ? "Desativar utilizador" : "Reativar utilizador"}
          </button>
          <button
            type="button"
            onClick={() => window.confirm("Gerar uma nova palavra-passe temporária?") && resetPassword.mutate(undefined, { onSuccess: (r) => setTempPassword(r.temporaryPassword) })}
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Repor palavra-passe
          </button>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/users" className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700">
            Cancelar
          </Link>
          <button type="button" onClick={save} disabled={!dirty || update.isPending} className="rounded-lg bg-[#ED5C32] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {update.isPending ? "A guardar…" : "Guardar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}
