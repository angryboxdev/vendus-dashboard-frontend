import type {
  CreateSupplierPayload,
  SupplierWithStats,
  UpdateSupplierPayload,
} from "../../domain/entities/supplier.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PageFooter } from "../../../../components/PageFooter.tsx";
import type { Supplier } from "../../domain/entities/supplier.ts";
import { SupplierDrawer } from "./SupplierDrawer.tsx";
import { formatEUR, formatIsoDatePt } from "../../../../lib/format.ts";
import { useFinancialBaseModule } from "../../financial-base.module.tsx";
import { useNavigate } from "react-router-dom";

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
        status === "active"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-stone-100 text-stone-500"
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
      <span>
        Mostrando {from} a {to} de {total} resultado{total !== 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="rounded-lg p-1.5 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M11.78 5.22a.75.75 0 010 1.06L8.06 10l3.72 3.72a.75.75 0 11-1.06 1.06l-4.25-4.25a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0z"
              clipRule="evenodd"
            />
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
            <path
              fillRule="evenodd"
              d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Colunas visíveis ─────────────────────────────────────────────────────────

const COLUMNS = [
  { key: "name", label: "Razão social" },
  { key: "nif", label: "NIF" },
  { key: "contact", label: "Contacto" },
  { key: "costCenter", label: "CC padrão" },
  { key: "invoices", label: "Faturas" },
  { key: "billed", label: "Total faturado" },
  { key: "pending", label: "Total pendente" },
  { key: "lastInvoice", label: "Última fatura" },
  { key: "terms", label: "Prazo" },
  { key: "status", label: "Estado" },
] as const;
type ColumnKey = (typeof COLUMNS)[number]["key"];

// ── Ordenação ────────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc";
type SortValue = string | number | null;

// Texto ordena A→Z ao primeiro clique; valores e datas do maior/mais recente.
const NUMERIC_COLUMNS = new Set<ColumnKey>(["invoices", "billed", "pending", "lastInvoice", "terms"]);

function sortValue(
  s: SupplierWithStats,
  key: ColumnKey,
  groupCode: (id: string | null | undefined) => string | null,
): SortValue {
  switch (key) {
    case "name": return s.name;
    case "nif": return s.nif ?? null;
    case "contact": return s.email ?? s.phone ?? null;
    case "costCenter": return groupCode(s.defaultCostCenterGroupId);
    case "invoices": return s.stats.invoiceCount;
    case "billed": return s.stats.totalBilled;
    case "pending": return s.stats.totalPending;
    // ISO `YYYY-MM-DD…` ordena corretamente como texto.
    case "lastInvoice": return s.stats.lastInvoiceDate;
    case "terms": return s.paymentTermsDays ?? null;
    case "status": return s.status === "active" ? "Ativo" : "Inativo";
  }
}

function compareSortValues(a: SortValue, b: SortValue, dir: SortDir): number {
  // Vazios ficam sempre no fim, qualquer que seja a direção.
  if (a == null || a === "") return b == null || b === "" ? 0 : 1;
  if (b == null || b === "") return -1;
  const cmp =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), "pt", { sensitivity: "base", numeric: true });
  return dir === "asc" ? cmp : -cmp;
}

function SortableTh({
  column,
  label,
  align = "left",
  sort,
  onSort,
}: {
  column: ColumnKey;
  label: string;
  align?: "left" | "center" | "right";
  sort: { key: ColumnKey; dir: SortDir } | null;
  onSort: (key: ColumnKey) => void;
}) {
  const active = sort?.key === column;
  const justify = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  return (
    <th
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500"
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex w-full items-center gap-1 uppercase tracking-wide transition-colors hover:text-[#ED5C32] ${justify} ${
          active ? "text-[#ED5C32]" : ""
        }`}
      >
        {label}
        <svg
          className={`h-3 w-3 shrink-0 ${active ? "" : "text-stone-300"}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          {active && sort.dir === "asc" ? (
            <path fillRule="evenodd" d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z" clipRule="evenodd" />
          ) : active ? (
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          ) : (
            <path fillRule="evenodd" d="M10 3a.75.75 0 01.55.24l3.25 3.5a.75.75 0 11-1.1 1.02L10 4.852 7.3 7.76a.75.75 0 01-1.1-1.02l3.25-3.5A.75.75 0 0110 3zm-3.76 9.2a.75.75 0 011.06.04l2.7 2.908 2.7-2.908a.75.75 0 111.1 1.02l-3.25 3.5a.75.75 0 01-1.1 0l-3.25-3.5a.75.75 0 01.04-1.06z" clipRule="evenodd" />
          )}
        </svg>
      </button>
    </th>
  );
}

const COLUMNS_STORAGE_KEY = "suppliers.hiddenColumns";

function loadHiddenColumns(): Set<ColumnKey> {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const valid = new Set<string>(COLUMNS.map((c) => c.key));
    return new Set(
      Array.isArray(parsed)
        ? (parsed.filter((k) => typeof k === "string" && valid.has(k)) as ColumnKey[])
        : [],
    );
  } catch {
    return new Set();
  }
}

function saveHiddenColumns(hidden: Set<ColumnKey>) {
  try {
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify([...hidden]));
  } catch {
    // localStorage indisponível (ex: modo privado) — a preferência simplesmente não persiste.
  }
}

function ColumnsPicker({
  hidden,
  onToggle,
  onShowAll,
}: {
  hidden: Set<ColumnKey>;
  onToggle: (key: ColumnKey) => void;
  onShowAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const visibleCount = COLUMNS.length - hidden.size;

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 transition hover:border-[#ED5C32]"
      >
        <svg className="h-4 w-4 text-stone-400" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 5A.75.75 0 012.75 9h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 9.75zm0 5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" />
        </svg>
        Colunas
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-lg border border-stone-200 bg-white p-1.5 shadow-lg">
          {COLUMNS.map((c) => {
            const checked = !hidden.has(c.key);
            // Pelo menos uma coluna fica sempre visível.
            const locked = checked && visibleCount === 1;
            return (
              <label
                key={c.key}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-stone-700 ${
                  locked ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-stone-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={locked}
                  onChange={() => onToggle(c.key)}
                  className="h-4 w-4 rounded border-stone-300 accent-[#ED5C32]"
                />
                {c.label}
              </label>
            );
          })}
          {hidden.size > 0 && (
            <button
              type="button"
              onClick={onShowAll}
              className="mt-1 w-full border-t border-stone-100 px-2.5 pb-1 pt-2 text-left text-sm font-medium text-[#ED5C32] transition-colors hover:text-[#A3211A]"
            >
              Mostrar todas
            </button>
          )}
        </div>
      )}
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

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hiddenColumns, setHiddenColumns] = useState(loadHiddenColumns);
  const [sort, setSort] = useState<{ key: ColumnKey; dir: SortDir } | null>(null);
  const show = (key: ColumnKey) => !hiddenColumns.has(key);

  // 1.º clique: direção natural da coluna; 2.º: inverte; 3.º: volta à ordem original.
  function handleSort(key: ColumnKey) {
    const firstDir: SortDir = NUMERIC_COLUMNS.has(key) ? "desc" : "asc";
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: firstDir };
      if (prev.dir === firstDir) return { key, dir: firstDir === "asc" ? "desc" : "asc" };
      return null;
    });
    setPage(1);
  }

  function updateHiddenColumns(next: Set<ColumnKey>) {
    setHiddenColumns(next);
    saveHiddenColumns(next);
  }

  function toggleColumn(key: ColumnKey) {
    const next = new Set(hiddenColumns);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    updateHiddenColumns(next);
  }

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

  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // KPIs computados a partir da lista completa (sem filtros)
  const kpis = useMemo(() => {
    const total = suppliers.length;
    const active = suppliers.filter((s) => s.status === "active").length;
    const withPending = suppliers.filter(
      (s) => s.stats.totalPending > 0,
    ).length;
    const totalPendingAmt = suppliers.reduce(
      (acc, s) => acc + s.stats.totalPending,
      0,
    );
    const totalBilled = suppliers.reduce(
      (acc, s) => acc + s.stats.totalBilled,
      0,
    );
    return {
      total,
      active,
      withPending,
      totalPendingAmt,
      totalBilled,
    };
  }, [suppliers]);

  // Filtragem base (sem o estado ativo/inativo)
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
      return true;
    });
  }, [suppliers, search]);

  // Filtragem final (com tab)
  const filtered = useMemo(() => {
    const rows = baseFiltered.filter((s) => {
      if (activeTab === "active" && s.status !== "active") return false;
      if (activeTab === "inactive" && s.status !== "inactive") return false;
      return true;
    });
    if (!sort) return rows;
    const groupCode = (id: string | null | undefined) =>
      id ? (groups.find((g) => g.id === id)?.code ?? null) : null;
    return rows
      .map((s) => ({ s, v: sortValue(s, sort.key, groupCode) }))
      .sort((a, b) => compareSortValues(a.v, b.v, sort.dir))
      .map(({ s }) => s);
  }, [baseFiltered, activeTab, sort, groups]);

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageData = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const hasFilters = search !== "";

  function clearFilters() {
    setSearch("");
    setPage(1);
  }

  function handleTabChange(tab: ActiveTab) {
    setActiveTab(tab);
    setPage(1);
  }

  const saveMutation = useMutation({
    mutationFn: ({
      payload,
      id,
    }: {
      payload: CreateSupplierPayload | UpdateSupplierPayload;
      id?: string;
    }) =>
      id
        ? api.updateSupplier(id, payload as UpdateSupplierPayload)
        : api.createSupplier(payload as CreateSupplierPayload),
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
            onClick={() => {
              setEditing(null);
              setDrawerOpen(true);
            }}
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
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium text-stone-500">
              Fornecedores ativos
            </p>
            <p className="mt-1 text-xl font-bold text-emerald-600">
              {kpis.active}
            </p>
            <p className="mt-0.5 text-xs text-stone-400">
              {pct(kpis.active, kpis.total)}
            </p>
          </div>
          {/* Abre as Faturas no separador «Por pagar», sem filtro de mês */}
          <button
            type="button"
            onClick={() => navigate("/financial/invoices?pendentes=1")}
            className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 text-left shadow-sm transition hover:border-[#ED5C32]/50 hover:bg-[#FDF8F5]"
          >
            <p className="flex items-center justify-between text-xs font-medium text-stone-500">
              Com faturas pendentes
              <svg className="h-3.5 w-3.5 text-stone-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </p>
            <p className="mt-1 text-xl font-bold text-amber-600">
              {kpis.withPending}
            </p>
            <p className="mt-0.5 text-xs text-stone-400">
              {kpis.totalPendingAmt > 0
                ? `Total ${formatEUR(kpis.totalPendingAmt)}`
                : "Sem pendências"}
            </p>
          </button>
          <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
            <p className="text-xs font-medium text-stone-500">Total faturado</p>
            <p className="mt-1 text-xl font-bold text-[#ED5C32]">
              {formatEUR(kpis.totalBilled)}
            </p>
            <p className="mt-0.5 text-xs text-stone-400">Histórico total</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Estado: por omissão só os ativos */}
          <div className="relative">
            <select
              value={activeTab}
              onChange={(e) => handleTabChange(e.target.value as ActiveTab)}
              aria-label="Estado"
              className="appearance-none rounded-md border border-stone-300 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-stone-700 outline-none transition focus:border-[#ED5C32]"
            >
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
              <option value="all">Todos</option>
            </select>
            <svg
              className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                clipRule="evenodd"
              />
            </svg>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Pesquisar por nome, NIF ou email..."
              className="w-64 rounded-md border border-stone-300 bg-white py-1.5 pl-9 pr-4 text-sm text-stone-700 outline-none transition focus:border-[#ED5C32]"
            />
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-sm text-stone-400 transition-colors hover:text-stone-600"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
              Limpar filtros
            </button>
          )}

          <ColumnsPicker
            hidden={hiddenColumns}
            onToggle={toggleColumn}
            onShowAll={() => updateHiddenColumns(new Set())}
          />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white">
          {/* Table content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-stone-400">
              A carregar…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16">
              <p className="text-sm font-medium text-stone-500">
                {hasFilters
                  ? "Sem resultados para os filtros aplicados."
                  : suppliers.length > 0
                    ? `Sem fornecedores ${activeTab === "active" ? "ativos" : "inativos"}.`
                    : "Ainda não há fornecedores."}
              </p>
              {suppliers.length === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setDrawerOpen(true);
                  }}
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
                      {COLUMNS.filter((c) => show(c.key)).map((c) => (
                        <SortableTh
                          key={c.key}
                          column={c.key}
                          label={c.label}
                          align={
                            c.key === "invoices"
                              ? "center"
                              : c.key === "billed" || c.key === "pending"
                                ? "right"
                                : "left"
                          }
                          sort={sort}
                          onSort={handleSort}
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5C992]/30">
                    {pageData.map((s: SupplierWithStats) => {
                      const group = s.defaultCostCenterGroupId
                        ? groupMap.get(s.defaultCostCenterGroupId)
                        : null;
                      const category = s.defaultCostCenterCategoryId
                        ? categoryMap.get(s.defaultCostCenterCategoryId)
                        : null;
                      return (
                        <tr
                          key={s.id}
                          // A linha inteira abre a ficha (o nome pode estar escondido nas colunas).
                          onClick={() => navigate(`/financial/suppliers/${s.id}`)}
                          className="group cursor-pointer transition-colors hover:bg-[#FDF8F5]"
                        >
                          {show("name") && (
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                // Sem onClick próprio: o clique sobe para a linha, que abre a ficha.
                                className="flex items-center gap-2 text-left font-medium text-stone-800 transition-colors hover:text-[#ED5C32]"
                              >
                                {s.logoUrl && <img src={s.logoUrl} alt="" className="h-6 w-6 shrink-0 rounded border border-stone-100 bg-white object-contain" />}
                                {s.name}
                              </button>
                            </td>
                          )}
                          {show("nif") && (
                            <td className="px-4 py-3 font-mono text-xs text-stone-500">
                              {s.nif ?? <span className="text-stone-300">—</span>}
                            </td>
                          )}
                          {show("contact") && (
                            <td className="px-4 py-3">
                              {s.email ? (
                                <a
                                  href={`mailto:${s.email}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-stone-500 transition-colors hover:text-[#ED5C32]"
                                >
                                  {s.email}
                                </a>
                              ) : (
                                <span className="text-stone-300">—</span>
                              )}
                              {s.phone && (
                                <p className="text-xs text-stone-400">
                                  {s.phone}
                                </p>
                              )}
                            </td>
                          )}
                          {show("costCenter") && (
                            <td className="px-4 py-3">
                              {group ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-600">
                                    {group.code}
                                  </span>
                                  {category && (
                                    <span className="text-xs text-stone-400">
                                      {category.code}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-stone-300">—</span>
                              )}
                            </td>
                          )}
                          {show("invoices") && (
                            <td className="px-4 py-3 text-center tabular-nums text-stone-700">
                              {s.stats.invoiceCount > 0 ? (
                                s.stats.invoiceCount
                              ) : (
                                <span className="text-stone-300">—</span>
                              )}
                            </td>
                          )}
                          {show("billed") && (
                            <td className="px-4 py-3 text-right text-stone-700">
                              {s.stats.totalBilled > 0 ? (
                                formatEUR(s.stats.totalBilled)
                              ) : (
                                <span className="text-stone-300">—</span>
                              )}
                            </td>
                          )}
                          {show("pending") && (
                            <td className="px-4 py-3 text-right">
                              {s.stats.totalPending > 0 ? (
                                <span className="font-medium text-amber-600">
                                  {formatEUR(s.stats.totalPending)}
                                </span>
                              ) : (
                                <span className="text-stone-300">—</span>
                              )}
                            </td>
                          )}
                          {show("lastInvoice") && (
                            <td className="whitespace-nowrap px-4 py-3 text-stone-500">
                              {s.stats.lastInvoiceDate ? (
                                formatIsoDatePt(s.stats.lastInvoiceDate)
                              ) : (
                                <span className="text-stone-300">—</span>
                              )}
                            </td>
                          )}
                          {show("terms") && (
                            <td className="px-4 py-3 text-stone-500">
                              {s.paymentTermsDays != null ? (
                                `${s.paymentTermsDays}d`
                              ) : (
                                <span className="text-stone-300">—</span>
                              )}
                            </td>
                          )}
                          {show("status") && (
                            <td className="px-4 py-3">
                              <StatusBadge status={s.status} />
                            </td>
                          )}
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
        onClose={() => {
          setDrawerOpen(false);
          setEditing(null);
        }}
        onSave={(payload, id) => saveMutation.mutate({ payload, id })}
        saving={saveMutation.isPending}
      />
      <PageFooter />
    </div>
  );
}
