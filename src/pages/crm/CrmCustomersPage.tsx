import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { fetchCustomersEnriched } from "./crmApi";
import { crmQueryKeys } from "./crmQueryKeys";
import { SegmentBadge } from "./components/SegmentBadge";
import { ContactModal } from "./components/ContactModal";
import type { CrmCustomerEnriched, CrmSegment } from "./crm.types";

const SEGMENTS: CrmSegment[] = [
  "SEG-01",
  "SEG-02",
  "SEG-03",
  "SEG-04",
  "SEG-05",
  "SEG-06",
  "SEG-07",
  "INATIVO",
];

function formatEur(v: number | string): string {
  return `€${Number(v).toFixed(2)}`;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T12:00:00Z").toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function FollowUpCell({ fu }: { fu: CrmCustomerEnriched["nextFollowUp"] }) {
  if (!fu) return <span className="text-xs text-slate-400">—</span>;

  if (fu.scriptCode.startsWith("→") || fu.scriptCode === "dormir") {
    return (
      <span className="text-xs text-slate-400 italic">{fu.scriptCode}</span>
    );
  }

  return (
    <div>
      <span
        className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
          fu.isOverdue
            ? "bg-red-100 text-red-700"
            : fu.daysUntil === 0
              ? "bg-amber-100 text-amber-700"
              : "bg-slate-100 text-slate-600"
        }`}
      >
        {fu.scriptCode}
      </span>
      <span className="ml-1 text-xs text-slate-400">
        {new Date(fu.date + "T12:00:00Z").toLocaleDateString("pt-PT", {
          day: "numeric",
          month: "short",
        })}
      </span>
    </div>
  );
}

export function CrmCustomersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [contactTarget, setContactTarget] =
    useState<CrmCustomerEnriched | null>(null);

  const segment = searchParams.get("segment") ?? "";
  const channel = searchParams.get("channel") ?? "";
  const optIn = searchParams.get("optIn") ?? "";
  const showInactive = searchParams.get("inactive") === "true";

  // Debounce search
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
    <div className="mx-auto max-w-6xl px-6 py-6">
      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar nome, email, telefone..."
          className="min-w-56 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
        />
        <select
          value={segment}
          onChange={(e) => setFilter("segment", e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">Todos os segmentos</option>
          {SEGMENTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={channel}
          onChange={(e) => setFilter("channel", e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">Todos os canais</option>
          <option>WhatsApp</option>
          <option>Email</option>
          <option>SMS</option>
        </select>
        <select
          value={optIn}
          onChange={(e) => setFilter("optIn", e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">Opt-in (todos)</option>
          <option value="Sim">Sim</option>
          <option value="Pendente">Pendente</option>
          <option value="Não">Não</option>
        </select>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) =>
              setFilter("inactive", e.target.checked ? "true" : "")
            }
            className="rounded"
          />
          Inativos
        </label>
      </div>

      {/* Count */}
      <p className="mb-3 text-xs text-slate-500">
        {isLoading ? "A carregar..." : `${customers.length} clientes`}
      </p>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left">
              <th className="px-4 py-3 text-xs font-medium text-slate-500">
                Cliente
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">
                Segmento
              </th>
              <th className="hidden px-4 py-3 text-xs font-medium text-slate-500 sm:table-cell">
                Canal
              </th>
              <th className="hidden px-4 py-3 text-xs font-medium text-slate-500 md:table-cell">
                Pedidos
              </th>
              <th className="hidden px-4 py-3 text-xs font-medium text-slate-500 md:table-cell">
                LTV
              </th>
              <th className="hidden px-4 py-3 text-xs font-medium text-slate-500 lg:table-cell">
                Último pedido
              </th>
              <th className="px-4 py-3 text-xs font-medium text-slate-500">
                Próximo follow-up
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-slate-400"
                >
                  A carregar...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-slate-400"
                >
                  Sem resultados
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr
                  key={c.id}
                  className={`hover:bg-slate-50 ${c.inactive ? "opacity-50" : ""}`}
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/crm/customers/${c.id}`}
                      className="font-medium text-slate-900 hover:text-slate-700"
                    >
                      {c.firstName} {c.lastName ?? ""}
                    </Link>
                    <p className="text-xs text-slate-400">{c.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <SegmentBadge segment={c.segment} short />
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">
                    {c.preferredChannel}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                    {c.orderCount}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                    {formatEur(c.ltv)}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 lg:table-cell">
                    {formatDate(c.lastOrderDate)}
                  </td>
                  <td className="px-4 py-3">
                    <FollowUpCell fu={c.nextFollowUp} />
                  </td>
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
        <ContactModal
          customer={contactTarget}
          onClose={() => setContactTarget(null)}
        />
      )}
    </div>
  );
}
