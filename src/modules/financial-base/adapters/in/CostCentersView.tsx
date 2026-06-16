import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFinancialBaseModule } from "../../financial-base.module.tsx";
import {
  CATEGORY_LABELS,
  type CostCenter,
  type CostCenterCategory,
  type CreateCostCenterPayload,
  type UpdateCostCenterPayload,
} from "../../domain/entities/cost-center.ts";
import { useInvoicesModule } from "../../../invoices/invoices.module.tsx";
import { PageFooter } from "../../../../components/PageFooter.tsx";
import type { InvoiceDTO } from "../../../invoices/domain/entities/invoice.ts";
import { INVOICE_STATUS_LABELS } from "../../../invoices/domain/entities/invoice.ts";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(cents: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as CostCenterCategory[];

const CATEGORY_COLORS: Record<CostCenterCategory, string> = {
  administration: "bg-blue-50 text-blue-700",
  operations:     "bg-orange-50 text-orange-700",
  marketing:      "bg-purple-50 text-purple-700",
  logistics:      "bg-yellow-50 text-yellow-700",
  hr:             "bg-pink-50 text-pink-700",
  technology:     "bg-cyan-50 text-cyan-700",
  finance:        "bg-emerald-50 text-emerald-700",
  real_estate:    "bg-stone-100 text-stone-700",
  app_delivery:   "bg-red-50 text-red-700",
  other:          "bg-stone-50 text-stone-600",
};

function ccFinancials(invoices: InvoiceDTO[]) {
  return {
    totalBilledCents:  invoices.reduce((s, i) => s + i.totalWithVat, 0),
    totalPaidCents:    invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.totalWithVat, 0),
    totalPendingCents: invoices.filter((i) => i.status === "pending" || i.status === "partial").reduce((s, i) => s + i.totalWithVat, 0),
    totalOverdueCents: invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.totalWithVat, 0),
  };
}

// ── KpiCard ───────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accentClass = "text-stone-900",
}: {
  label: string;
  value: string;
  sub?: string;
  accentClass?: string;
}) {
  return (
    <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accentClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-stone-400">{sub}</p>}
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "active" | "inactive" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${status === "active" ? "bg-emerald-500" : "bg-stone-400"}`} />
      {status === "active" ? "Ativo" : "Inativo"}
    </span>
  );
}

// ── InvoiceStatusBadge ────────────────────────────────────────────────────────

const INV_STATUS_CLS: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700",
  paid:      "bg-emerald-50 text-emerald-700",
  overdue:   "bg-red-50 text-red-700",
  partial:   "bg-blue-50 text-blue-700",
  cancelled: "bg-stone-100 text-stone-500",
  review:    "bg-purple-50 text-purple-700",
};

function InvoiceStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${INV_STATUS_CLS[status] ?? "bg-stone-100 text-stone-600"}`}>
      {INVOICE_STATUS_LABELS[status as keyof typeof INVOICE_STATUS_LABELS] ?? status}
    </span>
  );
}

// ── CategoryBadge ─────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: CostCenterCategory }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[category]}`}>
      {CATEGORY_LABELS[category]}
    </span>
  );
}

// ── CostCenterDrawer (create / edit) ──────────────────────────────────────────

interface DrawerProps {
  open: boolean;
  editing: CostCenter | null;
  onClose: () => void;
  onSave: (payload: CreateCostCenterPayload | UpdateCostCenterPayload, id?: string) => void;
  saving: boolean;
}

function CostCenterDrawer({ open, editing, onClose, onSave, saving }: DrawerProps) {
  const isEdit = editing !== null;

  const [code,            setCode]            = useState(editing?.code ?? "");
  const [name,            setName]            = useState(editing?.name ?? "");
  const [category,        setCategory]        = useState<CostCenterCategory>(editing?.category ?? "administration");
  const [subcategory,     setSubcategory]     = useState(editing?.subcategory ?? "");
  const [description,     setDescription]     = useState(editing?.description ?? "");
  const [responsibleName, setResponsibleName] = useState(editing?.responsibleName ?? "");

  if (editing && code !== editing.code && !saving) {
    setCode(editing.code);
    setName(editing.name);
    setCategory(editing.category);
    setSubcategory(editing.subcategory ?? "");
    setDescription(editing.description ?? "");
    setResponsibleName(editing.responsibleName ?? "");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEdit && editing) {
      onSave(
        {
          name,
          category,
          subcategory:     subcategory     || null,
          description:     description     || null,
          responsibleName: responsibleName || null,
        },
        editing.id,
      );
    } else {
      onSave({
        code,
        name,
        category,
        subcategory:     subcategory     || null,
        description:     description     || null,
        responsibleName: responsibleName || null,
      });
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#F5C992]/40 px-6 py-4">
          <h2 className="text-base font-semibold text-stone-800">
            {isEdit ? "Editar centro de custo" : "Novo centro de custo"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          {!isEdit && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">
                Código <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ex: ADM"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30"
              />
              <p className="mt-1 text-xs text-stone-400">Código único, convertido para maiúsculas.</p>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Administração"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              Categoria <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CostCenterCategory)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30"
            >
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Subcategoria</label>
            <input
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              placeholder="ex: Serviços externos"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Responsável</label>
            <input
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
              placeholder="ex: Raul"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Descrição opcional…"
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30"
            />
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 border-t border-stone-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            onClick={handleSubmit}
            className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity disabled:opacity-60"
          >
            {saving ? "A guardar…" : isEdit ? "Guardar alterações" : "Criar centro de custo"}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── CostCenterDetailDrawer ────────────────────────────────────────────────────

type DetailTab = "resumo" | "faturas" | "movimentos";

interface DetailDrawerProps {
  open: boolean;
  cc: CostCenter | null;
  onClose: () => void;
  onEdit: () => void;
}

function CostCenterDetailDrawer({ open, cc, onClose, onEdit }: DetailDrawerProps) {
  const { api: invoiceApi } = useInvoicesModule();
  const [tab, setTab] = useState<DetailTab>("resumo");

  const { data: ccInvoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["invoices", "by-cc", cc?.id],
    queryFn: () => invoiceApi.listInvoices({ costCenterId: cc!.id }),
    enabled: open && cc !== null,
  });

  if (!open || !cc) return null;

  const fin = ccFinancials(ccInvoices);
  const pending = fin.totalPendingCents + fin.totalOverdueCents;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col bg-white shadow-xl">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#F5C992]/40 px-6 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-md bg-stone-100 px-2.5 py-1 font-mono text-sm font-medium text-stone-700">
              {cc.code}
            </span>
            <div>
              <h2 className="text-base font-semibold text-stone-800">{cc.name}</h2>
              <div className="mt-1 flex items-center gap-2">
                <CategoryBadge category={cc.category} />
                <StatusBadge status={cc.status} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-stone-100 px-6">
          {(["resumo", "faturas", "movimentos"] as DetailTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`mr-6 border-b-2 py-3 text-sm font-medium transition-colors ${
                tab === t
                  ? "border-[#ED5C32] text-[#ED5C32]"
                  : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              {t === "resumo" ? "Resumo" : t === "faturas" ? `Faturas${ccInvoices.length > 0 ? ` (${ccInvoices.length})` : ""}` : "Movimentos"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── Resumo ── */}
          {tab === "resumo" && (
            <div className="flex flex-col gap-5">
              {loadingInvoices ? (
                <p className="text-sm text-stone-400">A carregar dados financeiros…</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Total faturado", value: fmt(fin.totalBilledCents),  cls: "text-stone-900" },
                    { label: "Total pago",     value: fmt(fin.totalPaidCents),    cls: "text-emerald-700" },
                    { label: "Por pagar",      value: fmt(fin.totalPendingCents), cls: "text-amber-700" },
                    {
                      label: "Vencido",
                      value: fmt(fin.totalOverdueCents),
                      cls: fin.totalOverdueCents > 0 ? "text-red-700" : "text-stone-400",
                    },
                  ].map((card) => (
                    <div key={card.label} className="rounded-xl border border-[#F5C992]/40 bg-white p-4 shadow-sm">
                      <p className="text-xs text-stone-500">{card.label}</p>
                      <p className={`mt-1 text-lg font-bold ${card.cls}`}>{card.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Dados gerais */}
              <div className="rounded-xl border border-[#F5C992]/40 bg-white p-5">
                <h3 className="mb-4 text-sm font-semibold text-stone-700">Dados gerais</h3>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  <div>
                    <dt className="text-xs font-medium text-stone-400">Código interno</dt>
                    <dd className="mt-0.5 font-mono font-medium text-stone-700">{cc.code}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-stone-400">Categoria</dt>
                    <dd className="mt-0.5"><CategoryBadge category={cc.category} /></dd>
                  </div>
                  {cc.subcategory && (
                    <div>
                      <dt className="text-xs font-medium text-stone-400">Subcategoria</dt>
                      <dd className="mt-0.5 text-stone-700">{cc.subcategory}</dd>
                    </div>
                  )}
                  {cc.responsibleName && (
                    <div>
                      <dt className="text-xs font-medium text-stone-400">Responsável</dt>
                      <dd className="mt-0.5 text-stone-700">{cc.responsibleName}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs font-medium text-stone-400">Estado</dt>
                    <dd className="mt-0.5"><StatusBadge status={cc.status} /></dd>
                  </div>
                  {cc.description && (
                    <div className="col-span-2">
                      <dt className="text-xs font-medium text-stone-400">Descrição</dt>
                      <dd className="mt-0.5 text-stone-700">{cc.description}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          )}

          {/* ── Faturas ── */}
          {tab === "faturas" && (
            loadingInvoices ? (
              <p className="text-sm text-stone-400">A carregar faturas…</p>
            ) : ccInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm text-stone-500">Sem faturas associadas a este centro de custo.</p>
                <p className="mt-1 text-xs text-stone-400">
                  Classifique linhas de faturas com este CC na página de Faturas.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="overflow-hidden rounded-xl border border-[#F5C992]/40">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-stone-100 bg-stone-50/60 text-left font-semibold uppercase tracking-wide text-stone-400">
                        <th className="px-3 py-2.5">Fornecedor</th>
                        <th className="px-3 py-2.5">Nº Fatura</th>
                        <th className="px-3 py-2.5">Emissão</th>
                        <th className="px-3 py-2.5">Vencimento</th>
                        <th className="px-3 py-2.5">Pagamento</th>
                        <th className="px-3 py-2.5 text-right">S/ IVA</th>
                        <th className="px-3 py-2.5 text-right">C/ IVA</th>
                        <th className="px-3 py-2.5">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {ccInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-[#FAF6F3]/60">
                          <td className="px-3 py-2.5 font-medium text-stone-700">{inv.supplierName}</td>
                          <td className="px-3 py-2.5 font-mono text-stone-500">{inv.invoiceNumber}</td>
                          <td className="px-3 py-2.5 text-stone-500">{fmtDate(inv.invoiceDate)}</td>
                          <td className={`px-3 py-2.5 ${inv.status === "overdue" ? "font-semibold text-red-600" : "text-stone-500"}`}>
                            {fmtDate(inv.dueDate)}
                          </td>
                          <td className="px-3 py-2.5 text-stone-500">{fmtDate(inv.paidAt)}</td>
                          <td className="px-3 py-2.5 text-right text-stone-600">{fmt(inv.subtotalWithoutVat)}</td>
                          <td className="px-3 py-2.5 text-right font-medium text-stone-800">{fmt(inv.totalWithVat)}</td>
                          <td className="px-3 py-2.5"><InvoiceStatusBadge status={inv.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-stone-100 bg-stone-50/40 text-xs font-semibold text-stone-600">
                        <td colSpan={5} className="px-3 py-2.5 text-right">Total</td>
                        <td className="px-3 py-2.5 text-right">{fmt(ccInvoices.reduce((s, i) => s + i.subtotalWithoutVat, 0))}</td>
                        <td className="px-3 py-2.5 text-right">{fmt(fin.totalBilledCents)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {pending > 0 && (
                  <p className="text-right text-xs text-amber-600 font-medium px-1 pt-1">
                    {fmt(pending)} por liquidar
                  </p>
                )}
              </div>
            )
          )}

          {/* ── Movimentos ── */}
          {tab === "movimentos" && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-stone-100">
                <svg className="h-7 w-7 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
                </svg>
              </div>
              <p className="text-sm font-medium text-stone-600">Movimentos bancários</p>
              <p className="mt-1 max-w-xs text-xs text-stone-400">
                Disponível após integração bancária (Sessão 4B).
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ── UpcomingDue sidebar ────────────────────────────────────────────────────────

function UpcomingDue({ invoices }: { invoices: InvoiceDTO[] }) {
  const upcoming = invoices
    .filter((i) => (i.status === "pending" || i.status === "overdue") && i.dueDate)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 6);

  return (
    <div className="rounded-xl border border-[#F5C992]/40 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-stone-700">Próximos vencimentos</h3>
      {upcoming.length === 0 ? (
        <p className="text-xs text-stone-400">Sem vencimentos pendentes.</p>
      ) : (
        <div className="flex flex-col divide-y divide-stone-50">
          {upcoming.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-2 py-2 text-xs">
              <div className="min-w-0">
                <p className="truncate font-medium text-stone-700">{inv.supplierName}</p>
                <div className="mt-0.5 flex items-center gap-1.5 text-stone-400">
                  <span className="font-mono">{inv.invoiceNumber}</span>
                  <span>·</span>
                  <span className={inv.status === "overdue" ? "font-medium text-red-500" : ""}>
                    {fmtDate(inv.dueDate)}
                  </span>
                </div>
              </div>
              <span className={`whitespace-nowrap font-semibold ${inv.status === "overdue" ? "text-red-600" : "text-stone-700"}`}>
                {fmt(inv.totalWithVat)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function CostCentersView() {
  const { api } = useFinancialBaseModule();
  const { api: invoiceApi } = useInvoicesModule();
  const qc = useQueryClient();

  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [editing,         setEditing]         = useState<CostCenter | null>(null);
  const [detailCC,        setDetailCC]        = useState<CostCenter | null>(null);
  const [filterCategory,  setFilterCategory]  = useState<CostCenterCategory | "">("");
  const [filterStatus,    setFilterStatus]    = useState<"active" | "inactive" | "">("");

  const { data: costCenters = [], isLoading } = useQuery({
    queryKey: ["cost-centers"],
    queryFn: () => api.listCostCenters(),
  });

  // All invoices for global KPIs + upcoming due sidebar
  const { data: allInvoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => invoiceApi.listInvoices(),
  });

  const saveMutation = useMutation({
    mutationFn: ({
      payload,
      id,
    }: {
      payload: CreateCostCenterPayload | UpdateCostCenterPayload;
      id?: string;
    }) =>
      id
        ? api.updateCostCenter(id, payload as UpdateCostCenterPayload)
        : api.createCostCenter(payload as CreateCostCenterPayload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cost-centers"] });
      setDrawerOpen(false);
      setEditing(null);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "inactive" }) =>
      api.setCostCenterStatus(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["cost-centers"] }),
  });

  const filtered = costCenters.filter((cc) => {
    if (filterCategory && cc.category !== filterCategory) return false;
    if (filterStatus   && cc.status   !== filterStatus)   return false;
    return true;
  });

  // Global KPIs from all invoices
  const globalFin = ccFinancials(allInvoices);
  const activeCount = costCenters.filter((cc) => cc.status === "active").length;
  const overdueCount = allInvoices.filter((i) => i.status === "overdue").length;

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function openEdit(cc: CostCenter) {
    setEditing(cc);
    setDrawerOpen(true);
  }

  const hasFilters = filterCategory !== "" || filterStatus !== "";

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">

      {/* Header */}
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Centros de Custo</h1>
            <p className="mt-0.5 text-sm text-stone-500">
              Classifique despesas, compras e pagamentos por área, operação ou projeto.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Novo centro de custo
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {!isLoading && costCenters.length > 0 && (
        <div className="grid grid-cols-2 gap-4 px-6 pt-5 lg:grid-cols-4">
          <KpiCard label="Centros ativos" value={String(activeCount)} sub={`${costCenters.length} no total`} />
          <KpiCard label="Total faturado" value={fmt(globalFin.totalBilledCents)} sub={`${allInvoices.length} fatura${allInvoices.length !== 1 ? "s" : ""}`} />
          <KpiCard label="Total pago" value={fmt(globalFin.totalPaidCents)} accentClass="text-emerald-700" />
          <KpiCard
            label="Por pagar"
            value={fmt(globalFin.totalPendingCents + globalFin.totalOverdueCents)}
            sub={overdueCount > 0 ? `${overdueCount} vencida${overdueCount !== 1 ? "s" : ""}` : undefined}
            accentClass={overdueCount > 0 ? "text-red-700" : "text-amber-700"}
          />
        </div>
      )}

      <div className="flex flex-1 gap-5 p-6">
        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as CostCenterCategory | "")}
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 shadow-sm outline-none transition focus:border-[#ED5C32]"
            >
              <option value="">Todas as categorias</option>
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "active" | "inactive" | "")}
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 shadow-sm outline-none transition focus:border-[#ED5C32]"
            >
              <option value="">Todos os estados</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>

            {hasFilters && (
              <button
                type="button"
                onClick={() => { setFilterCategory(""); setFilterStatus(""); }}
                className="text-sm text-stone-400 transition-colors hover:text-stone-600"
              >
                Limpar filtros
              </button>
            )}

            <span className="ml-auto text-sm text-stone-400">
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Table */}
          <div className="overflow-hidden overflow-x-auto rounded-xl border border-[#F5C992]/40 bg-white shadow-sm">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-stone-400">A carregar…</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16">
                <p className="text-sm font-medium text-stone-500">
                  {hasFilters ? "Sem resultados para os filtros aplicados." : "Ainda não há centros de custo."}
                </p>
                {!hasFilters && (
                  <button type="button" onClick={openCreate} className="mt-1 text-sm font-medium text-[#ED5C32] transition-colors hover:text-[#A3211A]">
                    Criar o primeiro
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 bg-stone-50/60 text-left text-xs font-semibold uppercase tracking-wide text-stone-400">
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Categoria</th>
                    <th className="px-4 py-3">Responsável</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {filtered.map((cc) => (
                    <tr key={cc.id} className="group transition-colors hover:bg-[#FAF6F3]/60">
                      <td className="px-4 py-3">
                        <span className="font-medium text-stone-800">{cc.name}</span>
                        {cc.subcategory && <p className="text-xs text-stone-400">{cc.subcategory}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-600">{cc.code}</span>
                      </td>
                      <td className="px-4 py-3"><CategoryBadge category={cc.category} /></td>
                      <td className="px-4 py-3 text-stone-500">
                        {cc.responsibleName ?? <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={cc.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            title="Ver detalhes"
                            onClick={() => setDetailCC(cc)}
                            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                              <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z" clipRule="evenodd" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            title="Editar"
                            onClick={() => openEdit(cc)}
                            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            title={cc.status === "active" ? "Desativar" : "Ativar"}
                            onClick={() => toggleStatusMutation.mutate({ id: cc.id, status: cc.status === "active" ? "inactive" : "active" })}
                            className={`rounded-lg p-1.5 transition-colors hover:bg-stone-100 ${cc.status === "active" ? "text-stone-400 hover:text-red-500" : "text-stone-400 hover:text-emerald-600"}`}
                          >
                            {cc.status === "active" ? (
                              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="hidden xl:flex flex-col gap-4 w-64 flex-shrink-0">
          <UpcomingDue invoices={allInvoices} />
        </div>
      </div>

      {/* Create / Edit Drawer */}
      <CostCenterDrawer
        open={drawerOpen}
        editing={editing}
        onClose={() => { setDrawerOpen(false); setEditing(null); }}
        onSave={(payload, id) => saveMutation.mutate({ payload, id })}
        saving={saveMutation.isPending}
      />

      {/* Detail Drawer */}
      <CostCenterDetailDrawer
        key={detailCC?.id ?? "none"}
        open={detailCC !== null}
        cc={detailCC}
        onClose={() => setDetailCC(null)}
        onEdit={() => {
          const cc = detailCC;
          setDetailCC(null);
          if (cc) openEdit(cc);
        }}
      />
      <PageFooter />
    </div>
  );
}
