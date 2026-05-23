import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { fetchCustomersEnriched } from "./crmApi";
import { crmQueryKeys } from "./crmQueryKeys";
import { SegmentBadge } from "./components/SegmentBadge";
import { ContactModal } from "./components/ContactModal";
import type { CrmCustomerEnriched, CrmSegment } from "./crm.types";

const SEGMENTS: CrmSegment[] = [
  "SEG-01", "SEG-02", "SEG-03", "SEG-04",
  "SEG-05", "SEG-06", "SEG-07", "INATIVO",
];

function formatEur(v: number | string): string {
  return `€${Number(v).toFixed(2)}`;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T12:00:00Z").toLocaleDateString("pt-PT", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function FollowUpBadge({ fu }: { fu: CrmCustomerEnriched["nextFollowUp"] }) {
  if (!fu) return <span className="text-xs text-slate-400">—</span>;
  if (fu.scriptCode.startsWith("→") || fu.scriptCode === "dormir") {
    return <span className="text-xs text-slate-400 italic">{fu.scriptCode}</span>;
  }
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
      fu.isOverdue ? "bg-red-100 text-red-700"
      : fu.daysUntil === 0 ? "bg-amber-100 text-amber-700"
      : "bg-slate-100 text-slate-600"
    }`}>
      {fu.scriptCode} · {new Date(fu.date + "T12:00:00Z").toLocaleDateString("pt-PT", { day: "numeric", month: "short" })}
    </span>
  );
}

// ─── Card mobile ──────────────────────────────────────────────────────────────

function CustomerCard({
  c,
  onContact,
}: {
  c: CrmCustomerEnriched;
  onContact: () => void;
}) {
  return (
    <div className={`flex items-start gap-3 border-b border-slate-100 px-4 py-4 last:border-0 ${c.inactive ? "opacity-50" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={`/crm/customers/${c.id}`}
            className="font-medium text-slate-900"
          >
            {c.firstName} {c.lastName ?? ""}
          </Link>
          <SegmentBadge segment={c.segment} short />
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          {c.id} · {c.preferredChannel} · {c.orderCount} pedidos · {formatEur(c.ltv)}
        </p>
        <div className="mt-1.5">
          <FollowUpBadge fu={c.nextFollowUp} />
        </div>
      </div>
      <button
        type="button"
        onClick={onContact}
        className="shrink-0 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white active:bg-slate-700"
      >
        Contactar
      </button>
    </div>
  );
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

function Filters({
  search, setSearch, segment, channel, optIn, showInactive, setFilter,
}: {
  search: string;
  setSearch: (v: string) => void;
  segment: string;
  channel: string;
  optIn: string;
  showInactive: boolean;
  setFilter: (key: string, value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeFilters = [segment, channel, optIn, showInactive ? "inativos" : ""].filter(Boolean).length;

  return (
    <div className="mb-4 space-y-2">
      {/* Search sempre visível */}
      <div className="flex gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar nome, email, telefone..."
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm focus:border-slate-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-1.5 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
            activeFilters > 0
              ? "border-slate-700 bg-slate-800 text-white"
              : "border-slate-300 bg-white text-slate-600"
          }`}
        >
          Filtros
          {activeFilters > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-800">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* Filtros expandidos */}
      {open && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select
            value={segment}
            onChange={(e) => setFilter("segment", e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm focus:outline-none"
          >
            <option value="">Todos segmentos</option>
            {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={channel}
            onChange={(e) => setFilter("channel", e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm focus:outline-none"
          >
            <option value="">Todos canais</option>
            <option>WhatsApp</option>
            <option>Email</option>
            <option>SMS</option>
          </select>
          <select
            value={optIn}
            onChange={(e) => setFilter("optIn", e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm focus:outline-none"
          >
            <option value="">Opt-in (todos)</option>
            <option value="Sim">Sim</option>
            <option value="Pendente">Pendente</option>
            <option value="Não">Não</option>
          </select>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setFilter("inactive", e.target.checked ? "true" : "")}
              className="rounded"
            />
            Inativos
          </label>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CrmCustomersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [contactTarget, setContactTarget] = useState<CrmCustomerEnriched | null>(null);

  const segment = searchParams.get("segment") ?? "";
  const channel = searchParams.get("channel") ?? "";
  const optIn = searchParams.get("optIn") ?? "";
  const showInactive = searchParams.get("inactive") === "true";

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const params = {
    ...(segment ? { segment } : {}),
    ...(channel ? { channel } : {}),
    ...(optIn ? { optIn } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(showInactive ? { inactive: true } : {}),
  };

  const { data: customers = [], isLoading } = useQuery({
    queryKey: crmQueryKeys.customers({ ...params, enriched: true }),
    queryFn: () => fetchCustomersEnriched(params),
    staleTime: 2 * 60 * 1000,
  });

  function setFilter(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 sm:py-6">
      <Filters
        search={search} setSearch={setSearch}
        segment={segment} channel={channel} optIn={optIn}
        showInactive={showInactive} setFilter={setFilter}
      />

      <p className="mb-2 text-xs text-slate-500">
        {isLoading ? "A carregar..." : `${customers.length} clientes`}
      </p>

      {/* Mobile: cards */}
      <div className="sm:hidden rounded-xl border border-slate-200 bg-white">
        {isLoading ? (
          <p className="px-4 py-12 text-center text-sm text-slate-400">A carregar...</p>
        ) : customers.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-400">Sem resultados</p>
        ) : (
          customers.map((c) => (
            <CustomerCard key={c.id} c={c} onContact={() => setContactTarget(c)} />
          ))
        )}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden sm:block overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-4 py-3 text-xs font-medium text-slate-500">Cliente</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">Segmento</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">Canal</th>
              <th className="hidden px-4 py-3 text-xs font-medium text-slate-500 md:table-cell">Pedidos</th>
              <th className="hidden px-4 py-3 text-xs font-medium text-slate-500 md:table-cell">LTV</th>
              <th className="hidden px-4 py-3 text-xs font-medium text-slate-500 lg:table-cell">Último pedido</th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">Próximo follow-up</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">A carregar...</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">Sem resultados</td></tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className={`hover:bg-slate-50 ${c.inactive ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <Link to={`/crm/customers/${c.id}`} className="font-medium text-slate-900 hover:text-slate-700">
                      {c.firstName} {c.lastName ?? ""}
                    </Link>
                    <p className="text-xs text-slate-400">{c.id}</p>
                  </td>
                  <td className="px-4 py-3"><SegmentBadge segment={c.segment} short /></td>
                  <td className="px-4 py-3 text-slate-600">{c.preferredChannel}</td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{c.orderCount}</td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{formatEur(c.ltv)}</td>
                  <td className="hidden px-4 py-3 text-slate-500 lg:table-cell">{formatDate(c.lastOrderDate)}</td>
                  <td className="px-4 py-3"><FollowUpBadge fu={c.nextFollowUp} /></td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setContactTarget(c)}
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Contactar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {contactTarget && (
        <ContactModal customer={contactTarget} onClose={() => setContactTarget(null)} />
      )}
    </div>
  );
}
