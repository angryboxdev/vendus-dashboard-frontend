import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  createOrder,
  fetchCustomerEnriched,
  fetchOrders,
  fetchContacts,
  patchCustomer,
  type CreateOrderBody,
} from "./crmApi";
import { crmQueryKeys } from "./crmQueryKeys";
import type { CrmContact, CrmCustomerEnriched, CrmOrder } from "./crm.types";
import { SegmentBadge } from "./components/SegmentBadge";
import { ContactModal } from "./components/ContactModal";

type Tab = "perfil" | "pedidos" | "contactos";

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T12:00:00Z").toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(d: string): string {
  return new Date(d).toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OrdersTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: crmQueryKeys.orders(customerId),
    queryFn: () => fetchOrders(customerId),
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (body: CreateOrderBody) => createOrder(customerId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: crmQueryKeys.orders(customerId) });
      void qc.invalidateQueries({ queryKey: crmQueryKeys.customer(customerId) });
      setShowForm(false);
      setAmount("");
      setNotes("");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    mutation.mutate({
      orderDate,
      amount: amt,
      notes: notes.trim() || null,
    });
  }

  const total = orders.reduce((s, o) => s + Number(o.amount), 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {orders.length} pedidos · Total: €{total.toFixed(2)}
        </p>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          + Novo pedido
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Data
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Valor (€)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Notas
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {mutation.isPending ? "A guardar..." : "Guardar"}
            </button>
          </div>
          {mutation.isError && (
            <p className="text-xs text-red-600">{String(mutation.error)}</p>
          )}
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-400">A carregar...</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-slate-400">Sem pedidos registados.</p>
      ) : (
        <div className="space-y-2">
          {orders.map((o: CrmOrder) => (
            <div
              key={o.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {formatDate(o.orderDate)}
                </p>
                {o.notes && (
                  <p className="text-xs text-slate-500">{o.notes}</p>
                )}
              </div>
              <span className="text-sm font-medium text-slate-900">
                €{Number(o.amount).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactsTab({ customerId }: { customerId: string }) {
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: crmQueryKeys.contacts({ customerId }),
    queryFn: () => fetchContacts({ customerId }),
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) return <p className="text-sm text-slate-400">A carregar...</p>;
  if (contacts.length === 0)
    return <p className="text-sm text-slate-400">Sem contactos registados.</p>;

  return (
    <div className="space-y-2">
      {contacts.map((c: CrmContact) => (
        <div
          key={c.id}
          className="rounded-lg border border-slate-200 bg-white px-4 py-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    c.direction === "Enviado"
                      ? "bg-slate-100 text-slate-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {c.direction}
                </span>
                {c.scriptCode && (
                  <span className="text-xs text-slate-500">{c.scriptCode}</span>
                )}
                <span className="text-xs text-slate-400">{c.channel}</span>
              </div>
              {c.response && (
                <p className="mt-1 text-sm text-slate-700">"{c.response}"</p>
              )}
              {c.notes && (
                <p className="mt-0.5 text-xs text-slate-500">{c.notes}</p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  c.status === "Respondeu"
                    ? "bg-green-100 text-green-700"
                    : c.status === "Recusou"
                      ? "bg-red-100 text-red-700"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {c.status}
              </span>
              <p className="mt-1 text-xs text-slate-400">
                {formatDateTime(c.contactedAt)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfileTab({ customer }: { customer: CrmCustomerEnriched }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(customer.notes ?? "");

  const mutation = useMutation({
    mutationFn: (patch: { notes?: string | null; inactive?: boolean }) =>
      patchCustomer(customer.id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: crmQueryKeys.customer(customer.id),
      });
      setEditing(false);
    },
  });

  const rows: { label: string; value: string | null | undefined }[] = [
    { label: "ID", value: customer.id },
    { label: "Email", value: customer.email },
    { label: "Telefone", value: customer.phone },
    { label: "Canal preferido", value: customer.preferredChannel },
    { label: "Opt-in", value: customer.optIn },
    { label: "Como encontrou", value: customer.howFound },
    { label: "Aniversário", value: customer.birthday ? formatDate(customer.birthday) : null },
    { label: "Indicado por", value: customer.referredBy },
    { label: "SEG-07 path", value: customer.seg07Path },
    { label: "Registado em", value: formatDate(customer.registeredAt) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map(
          ({ label, value }) =>
            value && (
              <div key={label}>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-sm text-slate-900">{value}</p>
              </div>
            ),
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-slate-500">Notas</p>
          <button
            type="button"
            onClick={() => setEditing(!editing)}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            {editing ? "Cancelar" : "Editar"}
          </button>
        </div>
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none"
            />
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ notes: notes.trim() || null })}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {mutation.isPending ? "A guardar..." : "Guardar"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-700 whitespace-pre-wrap">
            {customer.notes ?? (
              <span className="text-slate-400">Sem notas</span>
            )}
          </p>
        )}
      </div>

      {/* Tags */}
      {customer.tags && customer.tags.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-slate-500">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {(customer.tags as string[]).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Marcar como inativo */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={customer.inactive}
            onChange={(e) => mutation.mutate({ inactive: e.target.checked })}
            className="rounded"
          />
          Cliente inativo
        </label>
      </div>
    </div>
  );
}

function FollowUpCard({ customer }: { customer: CrmCustomerEnriched }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(customer.manualFollowupDate ?? "");

  const mutation = useMutation({
    mutationFn: (manualFollowupDate: string | null) =>
      patchCustomer(customer.id, { manualFollowupDate }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: crmQueryKeys.customer(customer.id) });
      void qc.invalidateQueries({ queryKey: crmQueryKeys.dashboard() });
      setEditing(false);
    },
  });

  const fu = customer.nextFollowUp;
  const showFu = fu && !fu.scriptCode.startsWith("→") && fu.scriptCode !== "dormir";

  return (
    <div className={`mt-4 rounded-xl border px-4 py-3 ${
      !showFu ? "border-slate-200 bg-slate-50"
      : fu.isOverdue ? "border-red-200 bg-red-50"
      : fu.daysUntil === 0 ? "border-amber-200 bg-amber-50"
      : "border-slate-200 bg-slate-50"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-600 mb-0.5">Próximo follow-up</p>
          {showFu ? (
            <>
              <p className="text-sm font-medium text-slate-900">
                {fu.scriptCode} ·{" "}
                {new Date(fu.date + "T12:00:00Z").toLocaleDateString("pt-PT", {
                  weekday: "long", day: "numeric", month: "long",
                })}
                {customer.manualFollowupDate && (
                  <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">manual</span>
                )}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{fu.reason}</p>
            </>
          ) : (
            <p className="text-sm text-slate-400">Sem follow-up calculado</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setDate(customer.manualFollowupDate ?? ""); setEditing(!editing); }}
          className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
        >
          {editing ? "Fechar" : customer.manualFollowupDate ? "Alterar" : "Definir data"}
        </button>
      </div>

      {editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none"
          />
          <button
            type="button"
            disabled={!date || mutation.isPending}
            onClick={() => mutation.mutate(date)}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {mutation.isPending ? "..." : "Guardar"}
          </button>
          {customer.manualFollowupDate && (
            <button
              type="button"
              onClick={() => mutation.mutate(null)}
              className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Remover data manual
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function CrmCustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>("perfil");
  const [showContact, setShowContact] = useState(false);

  const { data: customer, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.customer(id ?? ""),
    queryFn: () => fetchCustomerEnriched(id ?? ""),
    staleTime: 2 * 60 * 1000,
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        A carregar...
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-8 text-red-600">
        Cliente não encontrado.
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "perfil", label: "Perfil" },
    { key: "pedidos", label: `Pedidos (${customer.orderCount})` },
    { key: "contactos", label: "Contactos" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-4 sm:py-6">
      {/* Back */}
      <Link
        to="/crm/customers"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        ← Voltar
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {customer.firstName} {customer.lastName ?? ""}
            </h1>
            <p className="text-sm text-slate-400">{customer.id}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <SegmentBadge segment={customer.segment} />
              <span className="text-xs text-slate-500">
                {customer.orderCount} pedidos · €{Number(customer.ltv).toFixed(2)} LTV ·
                ticket médio €{Number(customer.avgTicket).toFixed(2)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowContact(true)}
            className="w-full sm:w-auto rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-white active:bg-slate-700"
          >
            Registar contacto
          </button>
        </div>

        {/* Next follow-up */}
        <FollowUpCard customer={customer} />

        {/* Metrics */}
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500">Primeiro pedido</p>
            <p className="text-sm font-medium text-slate-900">
              {formatDate(customer.firstOrderDate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Último pedido</p>
            <p className="text-sm font-medium text-slate-900">
              {formatDate(customer.lastOrderDate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Dias s/ comprar</p>
            <p className="text-sm font-medium text-slate-900">
              {customer.daysSinceLastOrder ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Opt-in</p>
            <p className="text-sm font-medium text-slate-900">
              {customer.optIn}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-4 overflow-x-auto scrollbar-none">
        <div className="flex gap-1 min-w-max">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "perfil" && <ProfileTab customer={customer} />}
      {activeTab === "pedidos" && (
        <OrdersTab customerId={customer.id} />
      )}
      {activeTab === "contactos" && (
        <ContactsTab customerId={customer.id} />
      )}

      {showContact && (
        <ContactModal
          customer={customer}
          onClose={() => setShowContact(false)}
        />
      )}
    </div>
  );
}
