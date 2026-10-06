import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useHrModule } from "../../hr.module.tsx";
import { Avatar } from "./components/Avatar.tsx";
import { EmployeeDrawer } from "./EmployeeDrawer.tsx";
import { PeopleTabs } from "./PeopleTabs.tsx";
import { usePositions } from "./use-positions.ts";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import { locationNameOf, positionNameOf } from "../../domain/services/employee-assignment.service.ts";
import {
  EMPLOYMENT_TYPE_LABELS,
  type CreateEmployeePayload,
  type DocumentSituation,
  type EmploymentType,
  type UpdateEmployeePayload,
} from "../../domain/entities/employee.ts";

const PAGE_SIZE = 10;

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ProfileStateBadge({ complete }: { complete: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        complete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${complete ? "bg-emerald-500" : "bg-amber-500"}`} />
      {complete ? "Completos" : "Dados em falta"}
    </span>
  );
}

const DOCUMENT_SITUATION_BADGE: Record<DocumentSituation, { label: string; cls: string; dot: string }> = {
  ok: { label: "Tudo ok", cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  expiring: { label: "A expirar", cls: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  missing: { label: "Em falta", cls: "bg-red-50 text-red-600", dot: "bg-red-500" },
};

function DocumentSituationBadge({ situation }: { situation: DocumentSituation }) {
  const info = DOCUMENT_SITUATION_BADGE[situation];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${info.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${info.dot}`} />
      {info.label}
    </span>
  );
}

export function PeopleListView() {
  const { api } = useHrModule();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Filtros vivem no URL (não em useState local) — permite deep-link a
  // partir de um KPI card (ex: Visão Geral) e sobrevive a refresh/partilha
  // de link (RH-01 secção 11).
  const search = searchParams.get("search") ?? "";
  // Predefinido: só ativos — colaboradores inativos ficam disponíveis ao
  // trocar o filtro, mas não poluem a vista por omissão.
  const status = (searchParams.get("status") as "all" | "active" | "inactive" | null) ?? "active";
  const employmentType = (searchParams.get("employmentType") as EmploymentType | null) ?? "";
  const documentSituation = (searchParams.get("documentSituation") as DocumentSituation | null) ?? "";
  const profileComplete = (searchParams.get("profileComplete") as "complete" | "incomplete" | null) ?? "";
  const positionId = searchParams.get("positionId") ?? "";
  const locationId = searchParams.get("locationId") ?? "";
  const { data: positions = [] } = usePositions();
  const { locations } = useLocations();
  const page = Number(searchParams.get("page")) || 1;

  function updateParams(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next);
  }

  const listParams = {
    ...(search && { search }),
    status,
    ...(employmentType && { employmentType }),
    ...(documentSituation && { documentSituation }),
    ...(profileComplete && { profileComplete }),
    ...(positionId && { positionId }),
    ...(locationId && { locationId }),
    page,
    pageSize: PAGE_SIZE,
  };

  const { data: kpis } = useQuery({ queryKey: ["hr-people-kpis"], queryFn: () => api.getKpis() });

  const { data: result, isLoading } = useQuery({
    queryKey: ["hr-people-list", listParams],
    queryFn: () => api.listEmployees(listParams),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateEmployeePayload | UpdateEmployeePayload) =>
      api.createEmployee(payload as CreateEmployeePayload),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["hr-people-list"] });
      void qc.invalidateQueries({ queryKey: ["hr-people-kpis"] });
      setDrawerOpen(false);
      navigate(`/hr/people/${created.id}`);
    },
  });

  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hasFilters = search !== "" || status !== "active" || employmentType !== "" || documentSituation !== "" || profileComplete !== "" || positionId !== "" || locationId !== "";

  function clearFilters() {
    setSearchParams(new URLSearchParams());
  }

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-stone-900">Colaboradores</h1>
            <p className="text-xs text-stone-500">Gestão de colaboradores e documentação.</p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Novo colaborador
          </button>
        </div>
        <PeopleTabs />
      </div>

      <div className="flex-1 space-y-4 p-4">
        {/* KPI Cards — clicáveis, funcionam como filtros locais (task "Melhorar Visão Geral e reorganizar Pessoas", secção 3/11) */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[#F5C992]/40 bg-white px-4 py-2.5 shadow-sm">
            <p className="text-xs font-medium text-stone-500">Funcionários ativos</p>
            <p className="mt-0.5 text-lg font-bold text-emerald-600">{kpis?.activeEmployees ?? "—"}</p>
          </div>
          <button
            type="button"
            onClick={() => updateParams({ profileComplete: "incomplete", page: undefined })}
            className="rounded-xl border border-[#F5C992]/40 bg-white px-4 py-2.5 text-left shadow-sm transition-colors hover:bg-[#FDF8F5]"
          >
            <p className="text-xs font-medium text-stone-500">Dados incompletos</p>
            <p className="mt-0.5 text-lg font-bold text-amber-600">{kpis?.incompleteProfiles ?? "—"}</p>
          </button>
          <button
            type="button"
            onClick={() => navigate("/hr/people/documentos?status=expiring")}
            className="rounded-xl border border-[#F5C992]/40 bg-white px-4 py-2.5 text-left shadow-sm transition-colors hover:bg-[#FDF8F5]"
          >
            <p className="text-xs font-medium text-stone-500">Documentos a expirar</p>
            <p className="mt-0.5 text-lg font-bold text-red-600">{kpis?.documentsExpiringSoon ?? "—"}</p>
          </button>
        </div>

        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => updateParams({ search: e.target.value, page: undefined })}
              placeholder="Pesquisar por nome ou email..."
              className="w-64 rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none transition focus:border-[#ED5C32]"
            />
            <select
              value={status}
              onChange={(e) => updateParams({ status: e.target.value, page: undefined })}
              className="rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none transition focus:border-[#ED5C32]"
            >
              <option value="all">Estado: Todos</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
            <select
              value={employmentType}
              onChange={(e) => updateParams({ employmentType: e.target.value, page: undefined })}
              className="rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none transition focus:border-[#ED5C32]"
            >
              <option value="">Vínculo: Todos</option>
              {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={profileComplete}
              onChange={(e) => updateParams({ profileComplete: e.target.value, page: undefined })}
              className="rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none transition focus:border-[#ED5C32]"
            >
              <option value="">Dados do perfil: Todos</option>
              <option value="complete">Completos</option>
              <option value="incomplete">Dados em falta</option>
            </select>
            <select
              aria-label="Cargo"
              value={positionId}
              onChange={(e) => updateParams({ positionId: e.target.value, page: undefined })}
              className="rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none transition focus:border-[#ED5C32]"
            >
              <option value="">Cargo: Todos</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.active ? p.name : `${p.name} (inativo)`}
                </option>
              ))}
            </select>
            {locations.length > 1 && (
              <select
                aria-label="Local"
                value={locationId}
                onChange={(e) => updateParams({ locationId: e.target.value, page: undefined })}
                className="rounded-md border border-stone-300 bg-white py-1.5 px-3 text-sm text-stone-700 outline-none transition focus:border-[#ED5C32]"
              >
                <option value="">Local: Todos</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.isActive ? l.name : `${l.name} (inativo)`}
                  </option>
                ))}
              </select>
            )}
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm text-stone-400 transition-colors hover:text-stone-600"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-stone-400">A carregar…</div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16">
                <p className="text-sm font-medium text-stone-500">
                  {hasFilters ? "Sem resultados para os filtros aplicados." : "Ainda não há colaboradores."}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-[#F5C992]/40 bg-stone-50/60">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                          Colaborador
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                          Cargo
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                          Local principal
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                          Vínculo
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                          Contacto
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                          Dados do perfil
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                          Documentos
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                          Última atualização
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5C992]/30">
                      {items.map((row) => (
                        <tr key={row.id} className="transition-colors hover:bg-[#FDF8F5]">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={row.fullName} photoUrl={row.photoUrl} size="sm" />
                              <div>
                                <button
                                  type="button"
                                  onClick={() => navigate(`/hr/people/${row.id}`)}
                                  className="text-left font-medium text-stone-800 transition-colors hover:text-[#ED5C32]"
                                >
                                  {row.fullName}
                                </button>
                                {row.email && <p className="text-xs text-stone-400">{row.email}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-stone-600">{positionNameOf(positions, row.positionId)}</td>
                          <td className="px-3 py-2 text-stone-600">{locationNameOf(locations, row.primaryLocationId)}</td>
                          <td className="px-3 py-2">
                            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">
                              {EMPLOYMENT_TYPE_LABELS[row.employmentType]}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-stone-500">{row.phone ?? <span className="text-stone-300">—</span>}</td>
                          <td className="px-3 py-2">
                            <ProfileStateBadge complete={row.profileCompletionPercent === 100} />
                          </td>
                          <td className="px-3 py-2">
                            <DocumentSituationBadge situation={row.documentSituation} />
                          </td>
                          <td className="px-3 py-2 text-stone-500">{formatDate(row.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-[#F5C992]/30 px-3 py-2 text-sm text-stone-500">
                  <span>
                    Mostrando {(page - 1) * PAGE_SIZE + 1} a {Math.min(page * PAGE_SIZE, total)} de {total} colaborador
                    {total !== 1 ? "es" : ""}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateParams({ page: String(Math.max(1, page - 1)) })}
                      disabled={page <= 1}
                      className="rounded-lg px-2 py-1 text-stone-500 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ←
                    </button>
                    <span className="px-2 tabular-nums">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => updateParams({ page: String(Math.min(totalPages, page + 1)) })}
                      disabled={page >= totalPages}
                      className="rounded-lg px-2 py-1 text-stone-500 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      →
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <EmployeeDrawer
        open={drawerOpen}
        editing={null}
        onClose={() => setDrawerOpen(false)}
        onSave={(payload) => createMutation.mutate(payload)}
        saving={createMutation.isPending}
      />
    </div>
  );
}
