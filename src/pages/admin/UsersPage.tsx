import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiDelete, apiPatch, apiPost } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import type { AppRole } from "../../contexts/AuthContext";

interface AppUser {
  id: string;
  email: string;
  role: AppRole;
  created_at: string;
}

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Manager",
  hr_viewer: "Visualizador RH",
};

const ROLES: AppRole[] = ["admin", "manager", "hr_viewer"];

async function fetchUsers(): Promise<AppUser[]> {
  const { apiGet } = await import("../../lib/api");
  return apiGet("/api/auth/users");
}

// ---------- create modal ----------

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("manager");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      apiPost("/api/auth/users", { email, password, role }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["auth-users"] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">Novo utilizador</h3>
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Função</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={mutation.isPending || !email || !password}
            onClick={() => mutation.mutate()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? "A criar…" : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- edit modal ----------

function EditUserModal({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const qc = useQueryClient();
  const [role, setRole] = useState<AppRole>(user.role);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const body: { role: AppRole; password?: string } = { role };
      if (password) body.password = password;
      return apiPatch(`/api/auth/users/${user.id}`, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["auth-users"] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">Editar utilizador</h3>
        <p className="mt-1 text-sm text-slate-500">{user.email}</p>
        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Função</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nova password <span className="font-normal text-slate-400">(deixar vazio para não alterar)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? "A guardar…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- main ----------

export function UsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: users, isPending } = useQuery({
    queryKey: ["auth-users"],
    queryFn: fetchUsers,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/auth/users/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["auth-users"] });
      setDeletingId(null);
    },
  });

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Utilizadores</h2>
          <p className="mt-1 text-sm text-slate-500">Gestão de acessos ao sistema.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Novo utilizador
        </button>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white shadow-sm">
        {isPending ? (
          <p className="p-6 text-sm text-slate-400">A carregar…</p>
        ) : (users ?? []).length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">Sem utilizadores.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Função</th>
                <th className="px-4 py-3">Desde</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-800">
                    {u.email}
                    {u.id === me?.id && (
                      <span className="ml-2 text-xs text-slate-400">(eu)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-500">
                    {new Date(u.created_at).toLocaleDateString("pt-PT")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(u)}
                      className="mr-2 text-indigo-600 hover:underline"
                    >
                      Editar
                    </button>
                    {u.id !== me?.id && (
                      <button
                        type="button"
                        disabled={deletingId === u.id}
                        onClick={() => {
                          if (confirm(`Remover ${u.email}?`)) {
                            setDeletingId(u.id);
                            deleteMutation.mutate(u.id);
                          }
                        }}
                        className="text-red-500 hover:underline disabled:opacity-50"
                      >
                        Remover
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Legenda de permissões */}
      <div className="mt-6">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Permissões por função
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Admin */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                Admin
              </span>
            </div>
            <ul className="space-y-1 text-xs text-slate-600">
              <li className="flex items-start gap-1.5"><Check />Acesso total ao sistema</li>
              <li className="flex items-start gap-1.5"><Check />Gestão de utilizadores</li>
              <li className="flex items-start gap-1.5"><Check />RH — leitura e escrita</li>
              <li className="flex items-start gap-1.5"><Check />Stock, DRE, Dashboard</li>
              <li className="flex items-start gap-1.5"><Check />Configuração do kiosk</li>
            </ul>
          </div>

          {/* Manager */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                Manager
              </span>
            </div>
            <ul className="space-y-1 text-xs text-slate-600">
              <li className="flex items-start gap-1.5"><Check />RH — leitura e escrita</li>
              <li className="flex items-start gap-1.5"><Check />Stock, DRE, Dashboard</li>
              <li className="flex items-start gap-1.5"><Check />Importação de faturas</li>
              <li className="flex items-start gap-1.5"><Cross />Gestão de utilizadores</li>
              <li className="flex items-start gap-1.5"><Cross />Configuração do kiosk</li>
            </ul>
          </div>

          {/* HR Viewer */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                Visualizador RH
              </span>
            </div>
            <ul className="space-y-1 text-xs text-slate-600">
              <li className="flex items-start gap-1.5"><Check />RH — apenas leitura</li>
              <li className="flex items-start gap-1.5"><Check />Histórico de alterações</li>
              <li className="flex items-start gap-1.5"><Cross />Criar/editar registos</li>
              <li className="flex items-start gap-1.5"><Cross />Stock, DRE, Dashboard</li>
              <li className="flex items-start gap-1.5"><Cross />Gestão de utilizadores</li>
            </ul>
          </div>
        </div>
      </div>

      {creating && <CreateUserModal onClose={() => setCreating(false)} />}
      {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Check() {
  return (
    <svg className="mt-px h-3.5 w-3.5 flex-shrink-0 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function Cross() {
  return (
    <svg className="mt-px h-3.5 w-3.5 flex-shrink-0 text-slate-300" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}
