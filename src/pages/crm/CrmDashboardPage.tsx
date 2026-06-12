import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchCrmDashboard } from "./crmApi";
import { crmQueryKeys } from "./crmQueryKeys";
import { SegmentBadge } from "./components/SegmentBadge";
import { ContactModal } from "./components/ContactModal";
import type { CrmCustomerEnriched, CrmSegment } from "./crm.types";

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("pt-PT", {
    day: "numeric",
    month: "short",
  });
}

function FollowUpBadge({ fu }: { fu: CrmCustomerEnriched["nextFollowUp"] }) {
  if (!fu) return null;
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
      fu.isOverdue ? "bg-red-100 text-red-700"
      : fu.daysUntil === 0 ? "bg-amber-100 text-amber-700"
      : "bg-slate-100 text-slate-600"
    }`}>
      {fu.scriptCode} · {formatDate(fu.date)}
    </span>
  );
}

function CustomerRow({
  customer,
  onContact,
}: {
  customer: CrmCustomerEnriched;
  onContact: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={`/crm/customers/${customer.id}`}
            className="text-sm font-medium text-slate-900"
          >
            {customer.firstName} {customer.lastName ?? ""}
          </Link>
          <span className="text-xs text-slate-400">{customer.id}</span>
          <SegmentBadge segment={customer.segment} short />
        </div>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <FollowUpBadge fu={customer.nextFollowUp} />
          {customer.nextFollowUp && (
            <span className="text-xs text-slate-500">{customer.nextFollowUp.reason}</span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-400">{customer.phone ?? "—"} · €{Number(customer.ltv).toFixed(0)}</p>
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

const SEG_ORDER = ["SEG-01","SEG-02","SEG-03","SEG-04","SEG-05","SEG-06","SEG-07","INATIVO"];

export function CrmDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: crmQueryKeys.dashboard(),
    queryFn: fetchCrmDashboard,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const [contactTarget, setContactTarget] = useState<CrmCustomerEnriched | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        A carregar...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 text-red-600">
        Erro: {String(error)}
      </div>
    );
  }

  const { attention, bySegment, contacts } = data;
  const totalCustomers = Object.values(bySegment).reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Atrasados</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{attention.overdue.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Para hoje</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{attention.today.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Próximos 3 dias</p>
          <p className="mt-1 text-2xl font-bold text-slate-700">{attention.next3days}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Taxa resposta</p>
          <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
            <p className="text-2xl font-bold text-slate-900">{contacts.responseRate}%</p>
            {contacts.prevResponseRate > 0 && (
              <span className={`text-xs ${contacts.responseRate >= contacts.prevResponseRate ? "text-green-600" : "text-red-600"}`}>
                vs {contacts.prevResponseRate}%
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">{contacts.sentThisWeek} enviados</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Lista de atenção */}
        <div className="lg:col-span-2 space-y-4">
          {attention.overdue.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-red-700">
                Atrasados ({attention.overdue.length})
              </h2>
              <div className="space-y-2">
                {attention.overdue.map((c) => (
                  <CustomerRow key={c.id} customer={c} onContact={() => setContactTarget(c)} />
                ))}
              </div>
            </section>
          )}

          {attention.today.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-amber-700">
                Para hoje ({attention.today.length})
              </h2>
              <div className="space-y-2">
                {attention.today.map((c) => (
                  <CustomerRow key={c.id} customer={c} onContact={() => setContactTarget(c)} />
                ))}
              </div>
            </section>
          )}

          {attention.overdue.length === 0 && attention.today.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-slate-400">
              Sem contactos urgentes para hoje.
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Segmentos */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Clientes por segmento</h2>
            <div className="space-y-2">
              {SEG_ORDER.filter((seg) => bySegment[seg] > 0).map((seg) => {
                const count = bySegment[seg] ?? 0;
                const pct = totalCustomers > 0 ? (count / totalCustomers) * 100 : 0;
                return (
                  <div key={seg}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <Link to={`/crm/customers?segment=${seg}`}>
                        <SegmentBadge segment={seg as CrmSegment} />
                      </Link>
                      <span className="font-medium text-slate-700">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-slate-600" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Aniversários */}
          {attention.birthdays.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h2 className="mb-2 text-sm font-semibold text-amber-800">Aniversários esta semana</h2>
              <ul className="space-y-1.5">
                {attention.birthdays.map((b) => (
                  <li key={b.customerId} className="flex items-center justify-between">
                    <Link to={`/crm/customers/${b.customerId}`} className="text-sm text-amber-900 hover:underline">
                      {b.name}
                    </Link>
                    <span className="text-xs text-amber-600">{b.birthday}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {contactTarget && (
        <ContactModal customer={contactTarget} onClose={() => setContactTarget(null)} />
      )}
    </div>
  );
}
