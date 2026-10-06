import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MOTION_ROW_HOVER } from "../../../../components/motion/index.ts";
import { accessSummary, formatLastAccess } from "../../domain/services/access-ui.service.ts";
import { Avatar, ProfileBadge, TemporaryPasswordNotice } from "./access-ui.tsx";
import { NewUserModal } from "./NewUserModal.tsx";
import { useProfiles, useUsers } from "./use-access-admin.ts";

/** Utilizadores (Utilizadores & Perfis de Acesso 2.0, ticket 07) — tabela limpa, sem a matriz de permissões (task §9). */
export function UsersView() {
  const navigate = useNavigate();
  const { data: users = [], isLoading, error } = useUsers();
  const { data: profiles = [] } = useProfiles();
  const [search, setSearch] = useState("");
  const [profileFilter, setProfileFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        (!q || u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) &&
        (!profileFilter || u.profile.id === profileFilter) &&
        (!statusFilter || u.status === statusFilter),
    );
  }, [users, search, profileFilter, statusFilter]);

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Utilizadores</h1>
          <p className="text-sm text-stone-500">Gestão de acessos ao sistema.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/access-profiles" className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
            Perfis de acesso
          </Link>
          <button type="button" onClick={() => setCreating(true)} className="rounded-lg bg-[#ED5C32] px-4 py-2 text-sm font-medium text-white hover:bg-[#d94f28]">
            + Novo utilizador
          </button>
        </div>
      </div>

      {created && <TemporaryPasswordNotice password={created.password} onClose={() => setCreated(null)} />}

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por nome ou email…"
          aria-label="Pesquisar utilizadores"
          className="min-w-[16rem] flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
        />
        <select aria-label="Filtrar por perfil" value={profileFilter} onChange={(e) => setProfileFilter(e.target.value)} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
          <option value="">Todos os perfis</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select aria-label="Filtrar por estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
          <option value="">Todos os estados</option>
          <option value="active">Ativos</option>
          <option value="disabled">Desativados</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#F5C992]/40 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-[#F5C992]/40 bg-stone-50/60">
            <tr>
              {["Utilizador", "Perfil", "Acessos", "Estado", "Último acesso", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F5C992]/30">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                  A carregar…
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-red-600">
                  Não foi possível carregar os utilizadores.
                </td>
              </tr>
            )}
            {filtered.map((u) => {
              const summary = accessSummary(u);
              return (
                <tr key={u.userId} className={MOTION_ROW_HOVER}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.displayName} />
                      <div className="min-w-0">
                        <p className="font-medium text-stone-900">{u.displayName}</p>
                        <p className="truncate text-xs text-stone-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ProfileBadge name={u.profile.name} systemKey={u.profile.systemKey} />
                  </td>
                  <td className="px-4 py-3">
                    {summary.customized && <span className="mb-0.5 inline-block rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Personalizado</span>}
                    {!summary.customized && <p className="text-stone-800">{summary.title}</p>}
                    <p className="text-xs text-stone-500">{summary.detail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-stone-700">
                      <span className={`h-2 w-2 rounded-full ${u.status === "active" ? "bg-emerald-500" : "bg-red-500"}`} />
                      {u.status === "active" ? "Ativo" : "Desativado"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{formatLastAccess(u.lastSignInAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/users/${u.userId}`)}
                      aria-label={`Editar ${u.displayName}`}
                      className="rounded-lg border border-[#ED5C32]/40 px-3 py-1.5 text-xs font-medium text-[#ED5C32] hover:bg-[#FEF3EC]"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="border-t border-[#F5C992]/30 px-4 py-3 text-xs text-stone-500">
          A mostrar {filtered.length} de {users.length} utilizadores
        </p>
      </div>

      {creating && (
        <NewUserModal
          onClose={() => setCreating(false)}
          onCreated={(email, password) => {
            setCreating(false);
            setCreated({ email, password });
          }}
        />
      )}
    </div>
  );
}
