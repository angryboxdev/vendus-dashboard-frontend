import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createCustomer, fetchCustomersEnriched, type CreateCustomerBody } from "./crmApi";
import { crmQueryKeys } from "./crmQueryKeys";
import { SegmentBadge } from "./components/SegmentBadge";
import { ContactModal } from "./components/ContactModal";
import type { CrmCustomerEnriched, CrmSegment } from "./crm.types";

// ─── Modal novo cliente ────────────────────────────────────────────────────────

const CHANNELS = ["WhatsApp", "Email", "SMS"] as const;
const HOW_FOUND = ["Instagram", "TikTok", "Passou", "Indicação", "Evento", "Outro"] as const;

function CreateCustomerModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<CreateCustomerBody>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    preferredChannel: "WhatsApp",
    birthday: "",
    howFound: "",
    optIn: "Pendente",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: crmQueryKeys.root });
      navigate(`/crm/customers/${customer.id}`);
    },
  });

  function set(key: keyof CreateCustomerBody, value: string | null) {
    setForm((prev) => ({ ...prev, [key]: value || null }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim()) return;
    mutation.mutate({
      ...form,
      firstName: form.firstName.trim(),
      lastName: form.lastName?.trim() || null,
      phone: form.phone?.trim() || null,
      email: form.email?.trim() || null,
      birthday: form.birthday || null,
      howFound: (form.howFound || null) as CreateCustomerBody["howFound"],
      notes: form.notes?.trim() || null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-xl shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Novo cliente</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-slate-500 mb-1">Nome *</label>
              <input
                type="text"
                required
                value={form.firstName ?? ""}
                onChange={(e) => set("firstName", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:border-slate-400"
                placeholder="Nome"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-slate-500 mb-1">Apelido</label>
              <input
                type="text"
                value={form.lastName ?? ""}
                onChange={(e) => set("lastName", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:border-slate-400"
                placeholder="Apelido"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-slate-500 mb-1">Telefone</label>
              <input
                type="tel"
                value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:border-slate-400"
                placeholder="+351 9XX XXX XXX"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-slate-500 mb-1">Email</label>
              <input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:border-slate-400"
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Canal preferido</label>
              <select
                value={form.preferredChannel ?? "WhatsApp"}
                onChange={(e) => set("preferredChannel", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none"
              >
                {CHANNELS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Opt-in</label>
              <select
                value={form.optIn ?? "Pendente"}
                onChange={(e) => set("optIn", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none"
              >
                <option value="Pendente">Pendente</option>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Data de nascimento</label>
              <input
                type="date"
                value={form.birthday ?? ""}
                onChange={(e) => set("birthday", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Como conheceu</label>
              <select
                value={form.howFound ?? ""}
                onChange={(e) => set("howFound", e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none"
              >
                <option value="">—</option>
                {HOW_FOUND.map((h) => <option key={h}>{h}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Notas</label>
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:border-slate-400 resize-none"
                placeholder="Observações sobre o cliente..."
              />
            </div>
          </div>

          {mutation.isError && (
            <p className="text-xs text-red-600">Erro ao criar cliente. Tenta novamente.</p>
          )}

          <div className="flex gap-2 pt-1 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !form.firstName?.trim()}
              className="flex-1 rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {mutation.isPending ? "A criar..." : "Criar cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
  const [showCreate, setShowCreate] = useState(false);

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
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <Filters
            search={search} setSearch={setSearch}
            segment={segment} channel={channel} optIn={optIn}
            showInactive={showInactive} setFilter={setFilter}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="shrink-0 rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-white active:bg-slate-700"
        >
          + Novo
        </button>
      </div>

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

      {showCreate && (
        <CreateCustomerModal onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
