import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFinancialBaseModule } from "../../financial-base.module.tsx";
import { PageFooter } from "../../../../components/PageFooter.tsx";
import { formatEUR } from "../../../../lib/format.ts";
import { SupplierDrawer } from "./SupplierDrawer.tsx";
import type { SupplierWithStats, CreateSupplierPayload, UpdateSupplierPayload } from "../../domain/entities/supplier.ts";
import type { Supplier } from "../../domain/entities/supplier.ts";

// ── Helpers ────────────────────────────────────────────────────────────────────

function pct(part: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((part / total) * 100)}% do total`;
}

// ── StatusBadge ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "active" | "inactive" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${status === "active" ? "bg-emerald-500" : "bg-stone-400"}`}
      />
      {status === "active" ? "Ativo" : "Inativo"}
    </span>
  );
}

// ── Pagination ─────────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between border-t border-[#F5C992]/30 px-4 py-3 text-sm text-stone-500">
      <span>Mostrando {from} a {to} de {total} resultado{total !== 1 ? "s" : ""}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="rounded-lg p-1.5 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 010 1.06L8.06 10l3.72 3.72a.75.75 0 11-1.06 1.06l-4.25-4.25a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0z" clipRule="evenodd" />
          </svg>
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let p = i + 1;
          if (totalPages > 5 && page > 3) p = page - 2 + i;
          if (p > totalPages) return null;
          return (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={`min-w-[2rem] rounded-lg px-2 py-1 text-sm font-medium transition-colors ${
                p === page
                  ? "bg-[#ED5C32] text-white"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg p-1.5 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;
type ActiveTab = "all" | "active" | "inactive";

export function SuppliersView() {
  const { api } = useFinancialBaseModule();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [drawerOpen,    setDrawerOpen]    = useState(false);
  const [editing,       setEditing]       = useState<Supplier | null>(null);
  const [activeTab,     setActiveTab]     = useState<ActiveTab>("all");
  const [search,        setSearch]        = useState("");
  const [filterCcGroup, setFilterCcGroup] = useState("");
  const [filterPrazo,   setFilterPrazo]   = useState<"" | "com" | "sem">("");
  const [page,          setPage]          = useState(1);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers-with-stats"],
    queryFn: () => api.listSuppliersWithStats(),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["cost-center-groups"],
    queryFn: () => api.listCostCenterGroups(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["cost-center-categories"],
    queryFn: () => api.listCostCenterCategories(),
  });

  const groupMap    = new Map(groups.map((g) => [g.id, g]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // KPIs computados a partir da lista completa (sem filtros)
  const kpis = useMemo(() => {
    const total          = suppliers.length;
    const active         = suppliers.filter((s) => s.status === "active").length;
    const inactive       = total - active;
    const withPending    = suppliers.filter((s) => s.stats.totalPending > 0).length;
    const totalPendingAmt = suppliers.reduce((acc, s) => acc + s.stats.totalPending, 0);
    const totalBilled    = suppliers.reduce((acc, s) => acc + s.stats.totalBilled, 0);
    return { total, active, inactive, withPending, totalPendingAmt, totalBilled };
  }, [suppliers]);

  // Filtragem base (sem tab de status — para contar por tab)
  const baseFiltered = useMemo(() => {
    return suppliers.filter((s) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !s.name.toLowerCase().includes(q) &&
          !(s.nif ?? "").toLowerCase().includes(q) &&
          !(s.email ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      if (filterCcGroup && s.defaultCostCenterGroupId !== filterCcGroup) return false;
      if (filterPrazo === "com" && s.paymentTermsDays == null) return false;
      if (filterPrazo === "sem" && s.paymentTermsDays != null) return false;
      return true;
    });
  }, [suppliers, search, filterCcGroup, filterPrazo]);

  const tabCounts = useMemo(() => ({
    all:      baseFiltered.length,
    active:   baseFiltered.filter((s) => s.status === "active").length,
    inactive: baseFiltered.filter((s) => s.status === "inactive").length,
  }), [baseFiltered]);

  // Filtragem final (com tab)
  const filtered = useMemo(() => {
    return baseFiltered.filter((s) => {
      if (activeTab === "active"   && s.status !== "active")   return false;
      if (activeTab === "inactive" && s.status !== "inactive") return false;
      return true;
    });
  }, [baseFiltered, activeTab]);

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageData   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasFilters = search !== "" || filterCcGroup !== "" || filterPrazo !== "";

  function clearFilters() {
    setSearch("");
    setFilterCcGroup("");
    setFilterPrazo("");
    setPage(1);
  }

  function handleTabChange(tab: ActiveTab) {
    setActiveTab(tab);
    setPage(1);
  }

  const saveMutation = useMutation({
    mutationFn: ({ payload, id }: { payload: CreateSupplierPayload | UpdateSupplierPayload; id?: string }) =>
      id ? api.updateSupplier(id, payload as UpdateSupplierPayload) : api.createSupplier(payload as CreateSupplierPayload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["suppliers-with-stats"] });
      setDrawerOpen(false);
      setEditing(null);
    },
  });

  const drawerKey = `supplier-${editing?.id ?? "new"}`;

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      {/* Header */}
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Fornecedores</h1>
            <p className="mt-0.5 text-sm text-stone-500">
              Gerencie fornecedores, status e histórico financeiro
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setEditing(null); setDrawerOpen(true); }}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Novo fornecedor
          </button>
        </div>
      </div>

      <div className="space-y-6 p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium text-stone-500">Fornecedores ativos</p>
            <p className="mt-1 text-xl font-bold text-emerald-600">{kpis.active}</p>
            <p className="mt-0.5 text-xs text-stone-400">{pct(kpis.active, kpis.total)}</p>
          </div>
          <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium text-stone-500">Fornecedores inativos</p>
            <p className="mt-1 text-xl font-bold text-stone-400">{kpis.inactive}</p>
            <p className="mt-0.5 text-xs text-stone-400">{pct(kpis.inactive, kpis.total)}</p>
          </div>
          <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium text-stone-500">Com faturas pendentes</p>
            <p className="mt-1 text-xl font-bold text-amber-600">{kpis.withPending}</p>
            <p className="mt-0.5 text-xs text-stone-400">
              {kpis.totalPendingAmt > 0 ? `Total ${formatEUR(kpis.totalPendingAmt)}` : "Sem pendências"}
            </p>
          </div>
          <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium text-stone-500">Total faturado</p>
            <p className="mt-1 text-xl font-bold text-[#ED5C32]">{formatEUR(kpis.totalBilled)}</p>
            <p className="mt-0.5 text-xs text-stone-400">Histórico total</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
            </svg>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Pesquisar por nome, NIF ou email..."
              className="w-64 rounded-md border border-stone-300 bg-white py-1.5 pl-9 pr-4 text-sm text-stone-700 outline-none transition focus:border-[#ED5C32]"
            />
          </div>

          <div className="relative">
            <select
              value={filterCcGroup}
              onChange={(e) => { setFilterCcGroup(e.target.value); setPage(1); }}
              className="appearance-none rounded-md border border-stone-300 bg-white py-1.5 pl-3 pr-8 text-sm text-stone-700 outline-none transition focus:border-[#ED5C32]"
            >
              <option value="">Centro de custo padrão</option>
              {groups.filter((g) => g.isActive).map((g) => (
                <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </div>

          <div className="relative">
            <select
              value={filterPrazo}
              onChange={(e) => { setFilterPrazo(e.target.value as "" | "com" | "sem"); setPage(1); }}
              className="appearance-none rounded-md border border-stone-300 bg-white py-1.5 pl-3 pr-8 text-sm text-stone-700 outline-none transition focus:border-[#ED5C32]"
            >
              <option value="">Prazo</option>
              <option value="com">Com prazo definido</option>
              <option value="sem">Sem prazo definido</option>
            </select>
            <svg className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-sm text-stone-400 transition-colors hover:text-stone-600"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
              Limpar filtros
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white">
          {/* Tabs */}
          <div className="flex border-b border-[#F5C992]/40 px-2">
            {(
              [
                { key: "all"      as const, label: "Todos",    badgeCls: "bg-stone-100 text-stone-500"    },
                { key: "active"   as const, label: "Ativos",   badgeCls: "bg-emerald-100 text-emerald-700" },
                { key: "inactive" as const, label: "Inativos", badgeCls: "bg-stone-100 text-stone-400"    },
              ]
            ).map(({ key, label, badgeCls }) => (
              <button
                key={key}
                onClick={() => handleTabChange(key)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === key
                    ? "border-[#ED5C32] text-[#ED5C32]"
                    : "border-transparent text-stone-500 hover:text-stone-700"
                }`}
              >
                {label}
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums ${badgeCls}`}>
                  {tabCounts[key]}
                </span>
              </button>
            ))}
          </div>

          {/* Table content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-stone-400">A carregar…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16">
              <p className="text-sm font-medium text-stone-500">
                {hasFilters ? "Sem resultados para os filtros aplicados." : "Ainda não há fornecedores."}
              </p>
              {!hasFilters && (
                <button
                  type="button"
                  onClick={() => { setEditing(null); setDrawerOpen(true); }}
                  className="mt-1 text-sm font-medium text-[#ED5C32] transition-colors hover:text-[#A3211A]"
                >
                  Criar o primeiro
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-[#F5C992]/40 bg-stone-50/60">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Nome</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">NIF</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Contacto</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">CC padrão</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-stone-500">Faturas</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-500">Total faturado</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-500">Total pendente</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Prazo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5C992]/30">
                    {pageData.map((s: SupplierWithStats) => {
                      const group    = s.defaultCostCenterGroupId    ? groupMap.get(s.defaultCostCenterGroupId)       : null;
                      const category = s.defaultCostCenterCategoryId ? categoryMap.get(s.defaultCostCenterCategoryId) : null;
                      return (
                        <tr key={s.id} className="group cursor-pointer transition-colors hover:bg-[#FDF8F5]">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => navigate(`/financial/suppliers/${s.id}`)}
                              className="text-left font-medium text-stone-800 transition-colors hover:text-[#ED5C32]"
                            >
                              {s.name}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-stone-500">
                            {s.nif ?? <span className="text-stone-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {s.email ? (
                              <a href={`mailto:${s.email}`} className="text-stone-500 transition-colors hover:text-[#ED5C32]">{s.email}</a>
                            ) : (
                              <span className="text-stone-300">—</span>
                            )}
                            {s.phone && <p className="text-xs text-stone-400">{s.phone}</p>}
                          </td>
                          <td className="px-4 py-3">
                            {group ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-600">{group.code}</span>
                                {category && <span className="text-xs text-stone-400">{category.code}</span>}
                              </div>
                            ) : (
                              <span className="text-stone-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {s.stats.invoiceCount > 0 ? (
                              <span className="inline-flex items-center justify-center rounded-full bg-[#FDF0E8] px-2.5 py-0.5 text-xs font-semibold text-[#ED5C32]">
                                {s.stats.invoiceCount}
                              </span>
                            ) : (
                              <span className="text-stone-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-stone-700">
                            {s.stats.totalBilled > 0 ? formatEUR(s.stats.totalBilled) : <span className="text-stone-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {s.stats.totalPending > 0 ? (
                              <span className="font-medium text-amber-600">{formatEUR(s.stats.totalPending)}</span>
                            ) : (
                              <span className="text-stone-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-stone-500">
                            {s.paymentTermsDays != null ? `${s.paymentTermsDays}d` : <span className="text-stone-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={s.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={safePage}
                totalPages={totalPages}
                total={filtered.length}
                pageSize={PAGE_SIZE}
                onPage={(p) => setPage(p)}
              />
            </>
          )}
        </div>
      </div>

      <SupplierDrawer
        key={drawerKey}
        open={drawerOpen}
        editing={editing}
        groups={groups}
        categories={categories}
        onClose={() => { setDrawerOpen(false); setEditing(null); }}
        onSave={(payload, id) => saveMutation.mutate({ payload, id })}
        saving={saveMutation.isPending}
      />
      <PageFooter />
    </div>
  );
}
