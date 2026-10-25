import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFinancialBaseModule } from "../../financial-base.module.tsx";
import { SupplierDrawer } from "./SupplierDrawer.tsx";
import { ExportStatementModal } from "./ExportStatementModal.tsx";
import { SupplierSupplyTab } from "./SupplierSupplyTab.tsx";
import { SupplierAssociatedItemsTab } from "./SupplierAssociatedItemsTab.tsx";
import { formatEUR, formatIsoDatePt } from "../../../../lib/format.ts";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import {
  AppIcon,
  BRAND,
  Button,
  DropdownMenu,
  FIELD,
  IconButton,
  IconChevronRight,
  IconDownload,
  IconInfo,
  NUMERIC,
  PAGE_BG,
  StatusBadge,
  SURFACE,
  Tabs,
  type StatusTone,
} from "../../../../components/ui/index.ts";
import {
  DEFAULT_STOCK_POLICY_LABELS,
  FINANCIAL_MODE_LABELS,
  type SupplierDetail,
  type SupplierInvoiceRow,
  type UpdateSupplierPayload,
} from "../../domain/entities/supplier.ts";

// ── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

const AXIS_TICK = { fontSize: 11, fill: BRAND.navy, fillOpacity: 0.55 };

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Anuladas não contam como compra (rascunhos e em revisão já não vêm da API). */
const countsAsPurchase = (inv: SupplierInvoiceRow) => inv.status !== "cancelled";

const isCreditNote = (inv: SupplierInvoiceRow) => inv.documentType === "credit_note";

function pctOf(part: number, total: number): string {
  if (total <= 0) return "—";
  return `${Math.round((part / total) * 100)}% do total`;
}

// ── Estado do documento ──────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; tone: StatusTone }> = {
  paid:           { label: "Paga",        tone: "success" },
  pending:        { label: "Pendente",    tone: "warning" },
  overdue:        { label: "Vencida",     tone: "danger"  },
  partial:        { label: "Parcial",     tone: "warning" },
  cancelled:      { label: "Anulada",     tone: "neutral" },
  draft_ai:       { label: "Rascunho IA", tone: "neutral" },
  pending_review: { label: "Em revisão",  tone: "neutral" },
};

function InvoiceStatusBadge({ status }: { status: string }) {
  const info = STATUS_LABELS[status] ?? { label: status, tone: "neutral" as const };
  return <StatusBadge tone={info.tone}>{info.label}</StatusBadge>;
}

function DocTypeChip({ inv }: { inv: SupplierInvoiceRow }) {
  return (
    <span className="rounded-md border border-line bg-surface-soft px-1.5 py-0.5 text-[10px] font-medium text-ink-secondary">
      {isCreditNote(inv) ? "NC" : "FT"}
    </span>
  );
}

// ── Blocos da visão geral ───────────────────────────────────────────────────

function Card({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`${SURFACE} flex flex-col ${className}`}>
      <header className="flex min-h-[56px] items-center justify-between gap-3 px-5 pt-4">
        <h2 className="text-[15px] font-semibold text-navy-900">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function InfoRows({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="px-5 pb-3 pt-1">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-4 border-t border-line-subtle py-2.5 text-[13px]">
          <dt className="text-ink-secondary">{label}</dt>
          <dd className="min-w-0 truncate text-left font-normal text-ink sm:w-1/2">{value ?? <Empty />}</dd>
        </div>
      ))}
    </dl>
  );
}

const Empty = () => <span className="text-ink-muted">—</span>;

function KpiCell({ label, hint, value, sub, valueClass = "text-navy-900" }: { label: string; hint: string; value: string; sub: string; valueClass?: string }) {
  return (
    <div className="px-6 py-5 sm:px-8">
      <p className="flex items-center gap-1.5 text-sm text-ink-secondary">
        {label}
        <span title={hint} className="text-ink-muted">
          <IconInfo size={14} />
        </span>
      </p>
      <p className={`mt-2 text-[26px] font-bold leading-none ${NUMERIC} ${valueClass}`}>{value}</p>
      <p className="mt-3 text-[13px] text-ink-secondary">{sub}</p>
    </div>
  );
}

function PurchasesChart({ supplier }: { supplier: SupplierDetail }) {
  const years = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    for (const inv of supplier.invoices) set.add(Number(inv.invoiceDate.slice(0, 4)));
    return [...set].filter(Number.isFinite).sort((a, b) => b - a);
  }, [supplier.invoices]);
  const lastYear = supplier.stats.lastInvoiceDate ? Number(supplier.stats.lastInvoiceDate.slice(0, 4)) : years[0]!;
  const [year, setYear] = useState(lastYear);

  const data = useMemo(() => {
    const totals = MONTHS.map((m) => ({ month: m, total: 0 }));
    for (const inv of supplier.invoices) {
      if (!countsAsPurchase(inv) || Number(inv.invoiceDate.slice(0, 4)) !== year) continue;
      totals[Number(inv.invoiceDate.slice(5, 7)) - 1]!.total += inv.totalWithVat;
    }
    return totals.map((t) => ({ ...t, total: Math.round(t.total * 100) / 100 }));
  }, [supplier.invoices, year]);

  return (
    <Card
      title="Resumo de atividade"
      className="h-full"
      action={
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Ano" className={`${FIELD} h-9 pr-8`}>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      }
    >
      <div className="flex items-center gap-2 px-5 pt-2 text-xs text-ink-secondary">
        <span className="h-2 w-2 rounded-full bg-brand-600" />
        Compras
      </div>
      <div className="h-[230px] px-2 pb-3 pt-2 xl:h-auto xl:min-h-[230px] xl:flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke={BRAND.border} />
            <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
            <YAxis
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={58}
              tickFormatter={(v: number) => `${v.toLocaleString("pt-PT", { maximumFractionDigits: 0 })} €`}
            />
            <Tooltip
              formatter={(v) => [formatEUR(Number(v)), "Compras"]}
              labelFormatter={(m) => `${m} ${year}`}
              contentStyle={{ borderRadius: 12, borderColor: BRAND.border, fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="total"
              name="Compras"
              stroke={BRAND.primary}
              strokeWidth={2.25}
              dot={{ r: 3, fill: BRAND.primary, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function LatestDocuments({ supplier, onOpenAll }: { supplier: SupplierDetail; onOpenAll: () => void }) {
  const navigate = useNavigate();
  const rows = supplier.invoices.slice(0, 5);
  return (
    <Card
      title="Últimos documentos"
      action={
        <IconButton label="Ver todos os documentos" size="sm" onClick={onOpenAll}>
          <IconChevronRight size={18} />
        </IconButton>
      }
    >
      {rows.length === 0 ? (
        <p className="px-5 pb-6 pt-2 text-sm text-ink-secondary">Nenhum documento registado para este fornecedor.</p>
      ) : (
        <div className="overflow-x-auto px-5 pb-3">
          <table className="min-w-full text-[13px]">
            <thead>
              <tr className="border-b border-line-subtle text-left text-[11px] font-medium uppercase tracking-wide text-ink-secondary">
                <th className="py-2.5 pr-3 font-medium">Nº documento</th>
                <th className="px-3 py-2.5 font-medium">Tipo</th>
                <th className="px-3 py-2.5 font-medium">Emissão</th>
                <th className="px-3 py-2.5 font-medium">Vencimento</th>
                <th className="px-3 py-2.5 text-right font-medium">Valor</th>
                <th className="py-2.5 pl-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => navigate(`/financial/invoices?open=${inv.id}`)}
                  className="cursor-pointer border-b border-line-subtle transition-colors last:border-0 hover:bg-surface-soft/60"
                >
                  <td className="whitespace-nowrap py-2.5 pr-3 text-ink">
                    <span className="inline-flex items-center gap-2">
                      {inv.invoiceNumber}
                      <DocTypeChip inv={inv} />
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-ink-secondary">{isCreditNote(inv) ? "Nota de crédito" : "Fatura"}</td>
                  <td className={`whitespace-nowrap px-3 py-2.5 text-ink-secondary ${NUMERIC}`}>{formatIsoDatePt(inv.invoiceDate)}</td>
                  <td className={`whitespace-nowrap px-3 py-2.5 text-ink-secondary ${NUMERIC}`}>{formatIsoDatePt(inv.dueDate)}</td>
                  <td className={`whitespace-nowrap px-3 py-2.5 text-right font-medium ${NUMERIC} ${inv.totalWithVat < 0 ? "text-red-600" : "text-navy-900"}`}>
                    {formatEUR(inv.totalWithVat)}
                  </td>
                  <td className="py-2.5 pl-3">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function TopItems({ supplier, onOpenAll }: { supplier: SupplierDetail; onOpenAll: () => void }) {
  const items = supplier.topItems ?? [];
  return (
    <Card
      title="Artigos principais"
      action={
        <IconButton label="Ver artigos associados" size="sm" onClick={onOpenAll}>
          <IconChevronRight size={18} />
        </IconButton>
      }
    >
      {items.length === 0 ? (
        <p className="px-5 pb-6 pt-2 text-sm text-ink-secondary">Ainda não há linhas de artigos nas faturas deste fornecedor.</p>
      ) : (
        <div className="overflow-x-auto px-5 pb-3">
          <table className="min-w-full text-[13px]">
            <thead>
              <tr className="border-b border-line-subtle text-left text-[11px] font-medium uppercase tracking-wide text-ink-secondary">
                <th className="py-2.5 pr-3 font-medium">Artigo</th>
                <th className="px-3 py-2.5 font-medium">Código</th>
                <th className="px-3 py-2.5 font-medium">Última compra</th>
                <th className="py-2.5 pl-3 text-right font-medium" title="Preço unitário sem IVA da última compra">Preço</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.key} className="border-b border-line-subtle last:border-0">
                  <td className="py-2.5 pr-3 text-ink">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[10px] font-semibold text-brand-600">
                        {initials(item.name) || "?"}
                      </span>
                      <span className="truncate" title={item.name}>{item.name}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-ink-secondary">{item.code ?? <Empty />}</td>
                  <td className={`whitespace-nowrap px-3 py-2.5 text-ink-secondary ${NUMERIC}`}>{formatIsoDatePt(item.lastPurchaseDate)}</td>
                  <td className={`whitespace-nowrap py-2.5 pl-3 text-right text-navy-900 ${NUMERIC}`}>{formatEUR(item.lastUnitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ── Separadores «Documentos» e «Contactos e notas» ──────────────────────────

function SupplierInvoicesSection({ supplier }: { supplier: SupplierDetail }) {
  const navigate = useNavigate();
  if (supplier.invoices.length === 0) {
    return (
      <div className={`${SURFACE} py-16 text-center`}>
        <p className="text-sm text-ink-secondary">Nenhum documento registado para este fornecedor.</p>
      </div>
    );
  }
  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-line-subtle">
            <tr className="text-left text-xs font-medium text-ink-secondary">
              <th className="px-4 py-3 font-medium">Nº documento</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Emissão</th>
              <th className="px-4 py-3 font-medium">Vencimento</th>
              <th className="px-4 py-3 text-right font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {supplier.invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-line-subtle transition-colors last:border-0 hover:bg-surface-soft/60">
                <td className="whitespace-nowrap px-4 py-3 text-ink">
                  <span className="inline-flex items-center gap-2">
                    {inv.invoiceNumber}
                    <DocTypeChip inv={inv} />
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-secondary">{isCreditNote(inv) ? "Nota de crédito" : "Fatura"}</td>
                <td className={`whitespace-nowrap px-4 py-3 text-ink-secondary ${NUMERIC}`}>{formatIsoDatePt(inv.invoiceDate)}</td>
                <td className={`whitespace-nowrap px-4 py-3 text-ink-secondary ${NUMERIC}`}>{formatIsoDatePt(inv.dueDate)}</td>
                <td className={`whitespace-nowrap px-4 py-3 text-right font-medium ${NUMERIC} ${inv.totalWithVat < 0 ? "text-red-600" : "text-navy-900"}`}>
                  {formatEUR(inv.totalWithVat)}
                </td>
                <td className="px-4 py-3">
                  <InvoiceStatusBadge status={inv.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => navigate(`/financial/invoices?open=${inv.id}`)}
                      className="font-medium text-brand-600 transition-colors hover:text-brand-500"
                    >
                      Ver documento
                    </button>
                    {inv.attachmentUrl && (
                      <a href={inv.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-ink-secondary transition-colors hover:text-brand-600">
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
    </div>
  );
}

function SupplierContactAndNotes({ supplier }: { supplier: SupplierDetail }) {
  return (
    <>
      <Card title="Contacto">
        <InfoRows
          rows={[
            ["Email", supplier.email ? <a href={`mailto:${supplier.email}`} className="text-brand-600 hover:underline">{supplier.email}</a> : null],
            ["Telefone", supplier.phone ? <a href={`tel:${supplier.phone}`} className="hover:text-brand-600">{supplier.phone}</a> : null],
            ["Morada", supplier.address],
            ["IBAN", supplier.iban],
          ]}
        />
      </Card>
      <Card title="Observações">
        <div className="px-5 pb-5 pt-1">
          {supplier.notes ? <p className="whitespace-pre-wrap text-sm text-ink">{supplier.notes}</p> : <p className="text-sm text-ink-secondary">Sem observações.</p>}
        </div>
      </Card>
    </>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

type SupplierTab = "general" | "documents" | "supply" | "items" | "contacts";

// ── Main view ────────────────────────────────────────────────────────────────

export function SupplierDetailView() {
  const { id } = useParams<{ id: string }>();
  const { api } = useFinancialBaseModule();
  const { locations } = useLocations();
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [tab, setTab] = useState<SupplierTab>("general");

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
      <div className={`flex min-h-full items-center justify-center ${PAGE_BG}`}>
        <p className="text-sm text-ink-secondary">A carregar…</p>
      </div>
    );
  }

  if (isError || !supplier) {
    return (
      <div className={`flex min-h-full flex-col items-center justify-center gap-3 ${PAGE_BG}`}>
        <p className="text-sm text-ink-secondary">Fornecedor não encontrado.</p>
        <Link to="/financial/suppliers" className="text-sm text-brand-600 hover:underline">
          ← Voltar à lista
        </Link>
      </div>
    );
  }

  const group = supplier.defaultCostCenterGroupId ? groups.find((g) => g.id === supplier.defaultCostCenterGroupId) : undefined;
  const category = supplier.defaultCostCenterCategoryId ? categories.find((c) => c.id === supplier.defaultCostCenterCategoryId) : undefined;
  const location = supplier.defaultLocationId ? locations.find((l) => l.id === supplier.defaultLocationId) : undefined;

  const isActive = supplier.status === "active";
  // «Cliente desde»: o mais antigo entre a criação da ficha e o primeiro documento (pode ter sido importado depois).
  const clientSince = supplier.invoices
    .reduce((min, inv) => (inv.invoiceDate < min ? inv.invoiceDate : min), supplier.createdAt)
    .slice(0, 4);
  const { totalBilled, totalPaid, totalPending, invoiceCount } = supplier.stats;
  const statusBadge = <StatusBadge tone={isActive ? "success" : "neutral"}>{isActive ? "Ativo" : "Inativo"}</StatusBadge>;
  const editAction = (
    <IconButton label="Editar fornecedor" size="sm" onClick={() => setDrawerOpen(true)}>
      <AppIcon name="edit" size={16} />
    </IconButton>
  );

  return (
    <div className={`flex min-h-full flex-col ${PAGE_BG}`}>
      <div className="px-6 pt-5">
        {/* Breadcrumb */}
        <nav aria-label="Caminho" className="flex items-center gap-2 text-[13px] text-ink-secondary">
          <span>Financeiro</span>
          <IconChevronRight size={14} />
          <Link to="/financial/suppliers" className="transition-colors hover:text-navy-900">
            Fornecedores
          </Link>
          <IconChevronRight size={14} />
          <span className="truncate text-navy-900">{supplier.name}</span>
        </nav>

        {/* Identidade + ações */}
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            {supplier.logoUrl ? (
              <img src={supplier.logoUrl} alt="" className="h-16 w-16 shrink-0 rounded-full border border-line bg-surface-card object-contain p-1.5" />
            ) : (
              <div aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xl font-semibold text-white">
                {initials(supplier.name)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="truncate text-[28px] font-bold leading-tight tracking-tight text-navy-900">{supplier.name}</h1>
                {statusBadge}
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-secondary">
                <span>Fornecedor</span>
                <span aria-hidden="true" className="text-line">|</span>
                <span>NIF: {supplier.nif ?? "—"}</span>
                <span aria-hidden="true" className="text-line">|</span>
                <span>Cliente desde {clientSince}</span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button icon={<AppIcon name="edit" size={16} />} onClick={() => setDrawerOpen(true)}>
              Editar fornecedor
            </Button>
            <DropdownMenu
              label="Mais ações"
              items={[{ label: "Exportar extrato", icon: <IconDownload />, onSelect: () => setExportOpen(true) }]}
              trigger={({ toggle }) => (
                <IconButton label="Mais ações" onClick={toggle} className="border border-navy-900/20 bg-surface-card">
                  <AppIcon name="moreVertical" size={18} />
                </IconButton>
              )}
            />
            <Button
              variant={isActive ? "danger" : "secondary"}
              loading={toggleStatusMutation.isPending}
              onClick={() => toggleStatusMutation.mutate(isActive ? "inactive" : "active")}
              className={isActive ? "bg-red-50 hover:bg-red-100" : ""}
            >
              {isActive ? "Inativar" : "Reativar"}
            </Button>
          </div>
        </div>

        {/* Separadores */}
        <div className="mt-6 border-b border-line">
          <Tabs
            label="Secções do fornecedor"
            value={tab}
            onChange={setTab}
            items={[
              { key: "general", label: "Visão geral" },
              { key: "documents", label: `Documentos (${supplier.invoices.length})` },
              { key: "supply", label: "Abastecimento" },
              { key: "items", label: "Artigos associados" },
              { key: "contacts", label: "Contactos e notas" },
            ]}
          />
        </div>
      </div>

      <div className="space-y-5 px-6 py-6">
        {tab === "general" && (
          <>
            {/* KPIs */}
            <div className={`${SURFACE} grid divide-y divide-line-subtle sm:grid-cols-3 sm:divide-x sm:divide-y-0`}>
              <KpiCell
                label="Compras líquidas"
                hint="Faturas menos notas de crédito (sem anuladas)"
                value={formatEUR(totalBilled)}
                sub={`${invoiceCount} documento${invoiceCount !== 1 ? "s" : ""}`}
              />
              <KpiCell label="Liquidado" hint="Documentos pagos" value={formatEUR(totalPaid)} sub={pctOf(totalPaid, totalBilled)} />
              <KpiCell
                label="Saldo em aberto"
                hint="Documentos pendentes, vencidos ou parcialmente pagos"
                value={formatEUR(totalPending)}
                sub={pctOf(totalPending, totalBilled)}
                valueClass={totalPending > 0 ? "text-brand-600" : "text-navy-900"}
              />
            </div>

            {/* Identificação · Condições · Atividade */}
            <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_1.15fr]">
              <Card title="Identificação" action={editAction}>
                <InfoRows
                  rows={[
                    ["Razão social", supplier.name],
                    ["NIF", supplier.nif],
                    ["Tipo", "Fornecedor"],
                    ["Estado", statusBadge],
                    ["Cliente desde", clientSince],
                    ["Categoria padrão", group ? group.name : null],
                    ["Subcategoria padrão", category ? category.name : null],
                  ]}
                />
              </Card>

              <Card title="Condições comerciais" action={editAction}>
                <InfoRows
                  rows={[
                    ["Prazo de pagamento", supplier.paymentTermsDays != null ? `${supplier.paymentTermsDays} dias` : null],
                    ["IBAN", supplier.iban],
                    ["Moeda", "EUR (€)"],
                    ["Enviar para stock", DEFAULT_STOCK_POLICY_LABELS[supplier.defaultStockPolicy]],
                    ["Modo financeiro", supplier.defaultFinancialMode ? FINANCIAL_MODE_LABELS[supplier.defaultFinancialMode] : null],
                    ["Loja habitual", location?.name ?? null],
                    ["Último pagamento", supplier.stats.lastPaymentDate ? formatIsoDatePt(supplier.stats.lastPaymentDate) : null],
                  ]}
                />
              </Card>

              <div className="lg:col-span-2 xl:col-span-1">
                <PurchasesChart supplier={supplier} />
              </div>
            </div>

            {/* Últimos documentos · Artigos principais */}
            <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
              <LatestDocuments supplier={supplier} onOpenAll={() => setTab("documents")} />
              <TopItems supplier={supplier} onOpenAll={() => setTab("items")} />
            </div>
          </>
        )}

        {tab === "documents" && <SupplierInvoicesSection supplier={supplier} />}

        {tab === "supply" && <SupplierSupplyTab supplier={supplier} onOpenItems={() => setTab("items")} />}

        {tab === "items" && <SupplierAssociatedItemsTab supplierId={supplier.id} />}

        {tab === "contacts" && (
          <div className="grid max-w-xl gap-5">
            <SupplierContactAndNotes supplier={supplier} />
          </div>
        )}
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
