import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFinancialBaseModule } from "../../financial-base.module.tsx";
import { SupplierDrawer } from "./SupplierDrawer.tsx";
import { ExportStatementModal } from "./ExportStatementModal.tsx";
import { formatEUR } from "../../../../lib/format.ts";
import type { UpdateSupplierPayload } from "../../domain/entities/supplier.ts";

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

// ── KpiCard ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex-1 rounded-xl border border-stone-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold ${highlight ? "text-orange-500" : "text-stone-900"}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-stone-400">{sub}</p>}
    </div>
  );
}

// ── InvoiceStatusBadge ───────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  paid:           { label: "Paga",          cls: "bg-emerald-50 text-emerald-700" },
  pending:        { label: "Pendente",      cls: "bg-orange-50 text-orange-600" },
  overdue:        { label: "Vencida",       cls: "bg-red-50 text-red-600" },
  partial:        { label: "Parcial",       cls: "bg-amber-50 text-amber-700" },
  cancelled:      { label: "Anulada",       cls: "bg-stone-100 text-stone-500" },
  draft_ai:       { label: "Rascunho IA",   cls: "bg-blue-50 text-blue-600" },
  pending_review: { label: "Em revisão",    cls: "bg-violet-50 text-violet-600" },
};

function InvoiceStatusBadge({ status }: { status: string }) {
  const info = STATUS_LABELS[status] ?? { label: status, cls: "bg-stone-100 text-stone-500" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${info.cls}`}>
      {info.label}
    </span>
  );
}

// ── Main view ────────────────────────────────────────────────────────────────

export function SupplierDetailView() {
  const { id } = useParams<{ id: string }>();
  const { api } = useFinancialBaseModule();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const { data: groups = [] } = useQuery({
    queryKey: ["cost-center-groups"],
    queryFn: () => api.listCostCenterGroups(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["cost-center-categories"],
    queryFn: () => api.listCostCenterCategories(),
  });

  const { data: supplier, isLoading, isError } = useQuery({
    queryKey: ["supplier-detail", id],
    queryFn: () => api.getSupplierDetail(id!),
    enabled: !!id,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (status: "active" | "inactive") => api.setSupplierStatus(id!, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["supplier-detail", id] });
      void qc.invalidateQueries({ queryKey: ["suppliers-with-stats"] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateSupplierPayload) => api.updateSupplier(id!, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["supplier-detail", id] });
      void qc.invalidateQueries({ queryKey: ["suppliers-with-stats"] });
      setDrawerOpen(false);
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#FAF6F3]">
        <p className="text-sm text-stone-400">A carregar…</p>
      </div>
    );
  }

  if (isError || !supplier) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-[#FAF6F3]">
        <p className="text-sm text-stone-500">Fornecedor não encontrado.</p>
        <Link to="/financial/suppliers" className="text-sm text-[#ED5C32] hover:underline">
          ← Voltar à lista
        </Link>
      </div>
    );
  }

  const groupMap    = new Map(groups.map((g) => [g.id, g]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const group    = supplier.defaultCostCenterGroupId    ? groupMap.get(supplier.defaultCostCenterGroupId)    : undefined;
  const category = supplier.defaultCostCenterCategoryId ? categoryMap.get(supplier.defaultCostCenterCategoryId) : undefined;

  const isActive = supplier.status === "active";

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      {/* Header bar */}
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        {/* Breadcrumb */}
        <nav className="mb-3 flex items-center gap-1.5 text-sm text-stone-400">
          <Link
            to="/financial/suppliers"
            className="flex items-center gap-1 transition-colors hover:text-stone-700"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 010 1.06L8.06 10l3.72 3.72a.75.75 0 11-1.06 1.06l-4.25-4.25a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0z" clipRule="evenodd" />
            </svg>
            Fornecedores
          </Link>
          <span>/</span>
          <span className="truncate font-medium text-stone-700">{supplier.name}</span>
        </nav>

        {/* Title row */}
        <div className="flex items-start justify-between gap-4">
          {/* Avatar + identity */}
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ED5C32] to-[#EF8935] text-base font-bold text-white shadow-sm">
              {initials(supplier.name)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-stone-900">{supplier.name}</h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-stone-100 text-stone-500"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-stone-400"}`} />
                  {isActive ? "Ativo" : "Inativo"}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setExportOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v7.19l2.47-2.47a.75.75 0 111.06 1.06l-3.75 3.75a.75.75 0 01-1.06 0L5.72 9.53a.75.75 0 011.06-1.06L9.25 10.94V3.75A.75.75 0 0110 3zM3.5 15.75a.75.75 0 01.75-.75h11.5a.75.75 0 010 1.5H4.25a.75.75 0 01-.75-.75z" clipRule="evenodd" />
              </svg>
              Exportar
            </button>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
              </svg>
              Editar fornecedor
            </button>
            <button
              type="button"
              disabled={toggleStatusMutation.isPending}
              onClick={() => toggleStatusMutation.mutate(isActive ? "inactive" : "active")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium shadow-sm transition-colors disabled:opacity-60 ${
                isActive
                  ? "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {isActive ? "Inativar" : "Reativar"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-6">
        {/* KPI Cards */}
        <div className="flex gap-4">
          <KpiCard
            label="Total faturado"
            value={formatEUR(supplier.stats.totalBilled)}
            sub={supplier.stats.invoiceCount > 0 ? `${supplier.stats.invoiceCount} fatura${supplier.stats.invoiceCount !== 1 ? "s" : ""}` : undefined}
          />
          <KpiCard
            label="Total pago"
            value={formatEUR(supplier.stats.totalPaid)}
            sub={supplier.stats.lastPaymentDate ? `Último: ${formatDate(supplier.stats.lastPaymentDate)}` : undefined}
          />
          <KpiCard
            label="Total pendente"
            value={formatEUR(supplier.stats.totalPending)}
            highlight={supplier.stats.totalPending > 0}
          />
          <KpiCard
            label="Faturas"
            value={supplier.stats.invoiceCount}
            sub={supplier.stats.lastInvoiceDate ? `Última: ${formatDate(supplier.stats.lastInvoiceDate)}` : undefined}
          />
        </div>

        {/* Main content: invoices + sidebar */}
        <div className="flex gap-6">
          {/* Invoices */}
          <div className="min-w-0 flex-1">
            {supplier.invoices.length === 0 ? (
              <div className="rounded-xl border border-stone-100 bg-white py-16 text-center shadow-sm">
                <p className="text-sm text-stone-400">Nenhuma fatura registada para este fornecedor.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-stone-100 bg-white shadow-sm">
                <div className="border-b border-stone-100 px-4 py-3">
                  <h3 className="text-sm font-semibold text-stone-700">
                    Faturas ({supplier.invoices.length})
                  </h3>
                </div>
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-medium uppercase tracking-wide text-stone-400">
                      <th className="px-4 py-3">Nº Fatura</th>
                      <th className="px-4 py-3">Emissão</th>
                      <th className="px-4 py-3">Vencimento</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {supplier.invoices.map((inv) => (
                      <tr key={inv.id} className="transition-colors hover:bg-stone-50/60">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-stone-700">
                          {inv.invoiceNumber}
                        </td>
                        <td className="px-4 py-3 text-stone-600">{formatDate(inv.invoiceDate)}</td>
                        <td className="px-4 py-3 text-stone-600">{formatDate(inv.dueDate)}</td>
                        <td className="px-4 py-3 text-right font-medium text-stone-900">
                          {formatEUR(inv.totalWithVat)}
                        </td>
                        <td className="px-4 py-3">
                          <InvoiceStatusBadge status={inv.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => navigate(`/financial/invoices?open=${inv.id}`)}
                              className="inline-flex items-center gap-1 text-xs text-stone-500 transition-colors hover:text-[#ED5C32]"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                                <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                              </svg>
                              Ver fatura
                            </button>
                            {inv.attachmentUrl && (
                              <a
                                href={inv.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-stone-500 transition-colors hover:text-[#ED5C32]"
                              >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
                                </svg>
                                Anexo
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-72 shrink-0 space-y-4">
            {/* Contact info */}
            <div className="rounded-xl border border-stone-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-stone-700">Contacto</h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-stone-400">Email</dt>
                  <dd className="mt-0.5 font-medium text-stone-700">
                    {supplier.email
                      ? <a href={`mailto:${supplier.email}`} className="text-[#ED5C32] hover:underline">{supplier.email}</a>
                      : <span className="text-stone-400">—</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-400">Telefone</dt>
                  <dd className="mt-0.5 font-medium text-stone-700">
                    {supplier.phone
                      ? <a href={`tel:${supplier.phone}`} className="hover:text-[#ED5C32]">{supplier.phone}</a>
                      : <span className="text-stone-400">—</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-400">Morada</dt>
                  <dd className="mt-0.5 font-medium text-stone-700">
                    {supplier.address ?? <span className="text-stone-400">—</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-400">IBAN</dt>
                  <dd className="mt-0.5 font-mono text-xs text-stone-700">
                    {supplier.iban ?? <span className="font-sans font-medium text-stone-400">—</span>}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Classification */}
            <div className="rounded-xl border border-stone-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-stone-700">Classificação e definições</h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-stone-400">NIF</dt>
                  <dd className="mt-0.5 font-mono text-xs text-stone-700">
                    {supplier.nif ?? <span className="font-sans font-medium text-stone-400">—</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-400">Prazo de pagamento</dt>
                  <dd className="mt-0.5 font-medium text-stone-700">
                    {supplier.paymentTermsDays != null ? `${supplier.paymentTermsDays} dias` : <span className="text-stone-400">—</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-400">Grupo CC padrão</dt>
                  <dd className="mt-0.5 font-medium text-stone-700">
                    {group ? `${group.code} — ${group.name}` : <span className="text-stone-400">—</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-stone-400">Subcategoria CC padrão</dt>
                  <dd className="mt-0.5 font-medium text-stone-700">
                    {category ? `${category.code} — ${category.name}` : <span className="text-stone-400">—</span>}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Notes */}
            <div className="rounded-xl border border-stone-100 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-stone-700">Observações</h3>
              {supplier.notes
                ? <p className="whitespace-pre-wrap text-sm text-stone-600">{supplier.notes}</p>
                : <p className="text-sm text-stone-400">Sem observações.</p>}
            </div>
          </div>
        </div>
      </div>

      <SupplierDrawer
        key={`edit-${supplier.id}`}
        open={drawerOpen}
        editing={supplier}
        groups={groups}
        categories={categories}
        onClose={() => setDrawerOpen(false)}
        onSave={(payload) => saveMutation.mutate(payload as UpdateSupplierPayload)}
        saving={saveMutation.isPending}
      />

      <ExportStatementModal
        open={exportOpen}
        supplierName={supplier.name}
        onClose={() => setExportOpen(false)}
        onExport={(params) => api.downloadSupplierStatement(id!, params)}
      />
    </div>
  );
}
