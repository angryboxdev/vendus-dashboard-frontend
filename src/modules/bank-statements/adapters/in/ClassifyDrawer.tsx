import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useBankStatementsModule } from "../../bank-statements.module.tsx";
import { useFinancialBaseModule } from "../../../financial-base/financial-base.module.tsx";
import { useInvoicesModule } from "../../../invoices/invoices.module.tsx";
import type {
  CostCenterGroup,
  CostCenterCategory,
} from "../../../financial-base/domain/entities/cost-center.ts";
import type { Supplier } from "../../../financial-base/domain/entities/supplier.ts";
import type { InvoiceDTO } from "../../../invoices/domain/entities/invoice.ts";
import {
  type BankMovementDTO,
  type ClassifyMovementPayload,
  type JustificationType,
  type MovementCandidateDTO,
  type ReconciliationStatus,
  RECONCILIATION_STATUS_LABELS,
  JUSTIFICATION_TYPE_LABELS,
} from "../../domain/entities/bank-statement.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fromCents(n: number): string {
  return (n / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function formatDate(s: string): string {
  if (!s) return "—";
  const parts = s.slice(0, 10).split("-");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// ── Badges ────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ReconciliationStatus, string> = {
  conciliado_com_fatura: "bg-emerald-50 text-emerald-700",
  conciliado_parcial: "bg-yellow-50 text-yellow-700",
  conciliado_sem_fatura: "bg-teal-50 text-teal-700",
  sugestao: "bg-blue-50 text-blue-700",
  pendente_de_documento: "bg-amber-50 text-amber-700",
  saida_nao_justificada: "bg-red-50 text-red-700",
  transferencia_interna: "bg-violet-50 text-violet-700",
  divergente: "bg-orange-50 text-orange-700",
  ignorado_com_motivo: "bg-stone-100 text-stone-500",
};

function ReconciliationBadge({ status }: { status: ReconciliationStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[status]}`}>
      {RECONCILIATION_STATUS_LABELS[status]}
    </span>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VAT_RATES = [0, 6, 13, 23] as const;
type VatMode = "included" | "excluded" | "exempt";
type ClassifyTab = "sistema" | "justificar";

const TAB_B_SUB_TYPES: JustificationType[] = [
  "recibo_comprovativo",
  "despesa_bancaria_automatica",
  "contrato_recorrencia",
  "transferencia_interna",
  "emprestimo_financiamento",
  "sem_justificativa",
];

function showsDocument(jt: JustificationType) {
  return ["recibo_comprovativo", "despesa_bancaria_automatica", "contrato_recorrencia", "emprestimo_financiamento"].includes(jt);
}
function showsSupplier(jt: JustificationType) {
  return ["recibo_comprovativo", "contrato_recorrencia", "emprestimo_financiamento"].includes(jt);
}
function showsCostCenter(jt: JustificationType) {
  return ["recibo_comprovativo", "despesa_bancaria_automatica", "contrato_recorrencia", "emprestimo_financiamento"].includes(jt);
}
function showsVat(jt: JustificationType) {
  return ["recibo_comprovativo", "despesa_bancaria_automatica", "contrato_recorrencia", "emprestimo_financiamento"].includes(jt);
}
function showsTransferTarget(jt: JustificationType) { return jt === "transferencia_interna"; }
function requiresSupplier(jt: JustificationType) { return jt === "contrato_recorrencia"; }
function requiresCostCenter(jt: JustificationType) { return showsCostCenter(jt); }
function requiresNotes(jt: JustificationType) { return jt === "sem_justificativa"; }

// ── EntityCard / InvoiceCard ──────────────────────────────────────────────────

function EntityCard({ candidate, onAdd }: { candidate: MovementCandidateDTO; onAdd: () => void }) {
  return (
    <button type="button" onClick={onAdd}
      className="w-full text-left rounded-lg border border-stone-200 px-3 py-2.5 text-sm transition-colors hover:border-[#ED5C32] hover:bg-[#FDF8F5] group">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-stone-800 truncate">{candidate.entityLabel}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-stone-400">{Math.round(candidate.confidence * 100)}%</span>
          <span className="text-xs font-medium text-[#ED5C32] opacity-0 group-hover:opacity-100 transition-opacity">+ Adicionar</span>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className={`text-xs font-medium ${candidate.entityType === "invoice" ? "text-blue-600" : "text-violet-600"}`}>
          {candidate.entityType === "invoice" ? "Fatura" : "Conta a pagar"}
        </span>
        <span className="text-xs text-stone-300">·</span>
        <span className="text-xs text-stone-500">Total: {fromCents(candidate.amountCents)}</span>
        <span className="text-xs text-stone-300">·</span>
        <span className="text-xs text-stone-500">Em aberto: {fromCents(candidate.openBalanceCents)}</span>
        <span className="text-xs text-stone-300">·</span>
        <span className="text-xs text-stone-400">{formatDate(candidate.date)}</span>
      </div>
    </button>
  );
}

function InvoiceCard({ invoice, onAdd }: { invoice: InvoiceDTO; onAdd: () => void }) {
  return (
    <button type="button" onClick={onAdd}
      className="w-full text-left rounded-lg border border-stone-200 px-3 py-2.5 text-sm transition-colors hover:border-[#ED5C32] hover:bg-[#FDF8F5] group">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-stone-800 truncate">{invoice.supplierName}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-stone-400">{fromCents(invoice.totalWithVat)}</span>
          <span className="text-xs font-medium text-[#ED5C32] opacity-0 group-hover:opacity-100 transition-opacity">+ Adicionar</span>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-xs font-medium text-blue-600">Fatura</span>
        <span className="text-xs text-stone-300">·</span>
        <span className="text-xs text-stone-500">Nº {invoice.invoiceNumber}</span>
        <span className="text-xs text-stone-300">·</span>
        <span className="text-xs text-stone-400">{formatDate(invoice.invoiceDate)}</span>
      </div>
    </button>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface AllocationEntry {
  entityType: "invoice" | "payable_entry";
  entityId: string;
  entityLabel: string;
  supplierId: string | null;
  totalCents: number;
  openBalanceCents: number;
  allocatedCents: number;
}

// ── ClassifyDrawer ────────────────────────────────────────────────────────────

export function ClassifyDrawer({
  movement,
  onClose,
  onSave,
  onReconcile,
  saving,
  inline = false,
}: {
  movement: BankMovementDTO;
  onClose: () => void;
  onSave: (payload: ClassifyMovementPayload) => void;
  onReconcile: (
    entityLinks: Array<{
      entityType: "invoice" | "payable_entry";
      entityId: string;
      allocatedAmountCents: number;
      supplierId: string | null;
    }>,
  ) => void;
  saving: boolean;
  /** When true, renders inline (no portal/backdrop). Use for side-panel layouts. */
  inline?: boolean;
}) {
  const { api } = useBankStatementsModule();
  const fbApi = useFinancialBaseModule().api;
  const invApi = useInvoicesModule().api;

  const labelCls = "block text-xs font-medium text-stone-500 mb-1";
  const inputCls =
    "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]";

  // Read-only summary mode for already-resolved movements
  const [isEditMode, setIsEditMode] = useState(() => !movement.isResolved);

  // Which tab to open when entering edit mode
  const defaultTab: ClassifyTab =
    movement.entityLinks.length > 0 ? "sistema"
    : movement.justificationType && movement.justificationType !== "fatura" ? "justificar"
    : "sistema";

  const [activeTab, setActiveTab] = useState<ClassifyTab>(defaultTab);

  // Reset to summary view whenever a different movement is selected
  useEffect(() => {
    setIsEditMode(!movement.isResolved);
    setActiveTab(
      movement.entityLinks.length > 0 ? "sistema"
      : movement.justificationType && movement.justificationType !== "fatura" ? "justificar"
      : "sistema"
    );
  }, [movement.id]);

  const [allocations, setAllocations] = useState<AllocationEntry[]>(() =>
    movement.entityLinks.map((l) => ({
      entityType: l.entityType,
      entityId: l.entityId,
      entityLabel: l.entityLabel,
      supplierId: null,
      totalCents: l.amountCents,
      openBalanceCents: l.amountCents,
      allocatedCents: l.allocatedAmountCents,
    })),
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data: candidates = [], isLoading: loadingCandidates } = useQuery({
    queryKey: ["movement-candidates", movement.id],
    queryFn: () => api.findMovementCandidates(movement.id),
    staleTime: 60_000,
  });

  const { data: invoiceSearchResults = [], isLoading: loadingSearch } = useQuery({
    queryKey: ["invoices-search", debouncedSearch],
    queryFn: () => invApi.listInvoices({ search: debouncedSearch }),
    enabled: debouncedSearch.length >= 2,
    staleTime: 30_000,
  });

  const [subType, setSubType] = useState<JustificationType>(
    movement.justificationType && movement.justificationType !== "fatura"
      ? movement.justificationType
      : "recibo_comprovativo",
  );
  const [notes, setNotes] = useState(movement.notes ?? "");
  const [transferTarget, setTransferTarget] = useState("");
  const [groupId, setGroupId] = useState<string>(movement.costCenterGroupId ?? "");
  const [categoryId, setCategoryId] = useState<string>(movement.costCenterCategoryId ?? "");
  const [supplierId, setSupplierId] = useState<string>(movement.supplierId ?? "");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [vatMode, setVatMode] = useState<VatMode>("exempt");
  const [vatRate, setVatRate] = useState<number>(23);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(movement.documentUrl);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: groups = [] } = useQuery<CostCenterGroup[]>({
    queryKey: ["cost-center-groups"],
    queryFn: () => fbApi.listCostCenterGroups({ isActive: true }),
    staleTime: 300_000,
  });

  const { data: categories = [] } = useQuery<CostCenterCategory[]>({
    queryKey: ["cost-center-categories", groupId],
    queryFn: () => fbApi.listCostCenterCategories({ groupId, isActive: true }),
    enabled: !!groupId,
    staleTime: 300_000,
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers", supplierSearch],
    queryFn: () => fbApi.listSuppliers({ search: supplierSearch || undefined, status: "active" }),
    staleTime: 60_000,
  });

  const selectedSupplier = suppliers.find((s) => s.id === supplierId) ?? null;

  useEffect(() => {
    if (selectedSupplier) {
      if (selectedSupplier.defaultCostCenterGroupId && !groupId)
        setGroupId(selectedSupplier.defaultCostCenterGroupId);
      if (selectedSupplier.defaultCostCenterCategoryId && !categoryId)
        setCategoryId(selectedSupplier.defaultCostCenterCategoryId);
    }
  }, [selectedSupplier, groupId, categoryId]);

  function handleGroupChange(newGroupId: string) {
    setGroupId(newGroupId);
    setCategoryId("");
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadError(null);
    setUploading(true);
    try {
      const result = await api.uploadMovementDocument(movement.id, file);
      setDocumentUrl(result.documentUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Erro ao carregar ficheiro.");
      setUploadFile(null);
    } finally {
      setUploading(false);
    }
  }

  const allocatedEntityIds = new Set(allocations.map((a) => a.entityId));
  const totalAllocated = allocations.reduce((s, a) => s + a.allocatedCents, 0);
  const remaining = movement.amount - totalAllocated;
  const withinTolerance = Math.abs(remaining) <= 100;
  const overAllocated = totalAllocated > movement.amount;

  function addAllocation(entry: Omit<AllocationEntry, "allocatedCents">) {
    if (allocatedEntityIds.has(entry.entityId)) return;
    const suggested = Math.min(entry.openBalanceCents, Math.max(0, remaining));
    setAllocations((prev) => [...prev, { ...entry, allocatedCents: suggested }]);
  }

  function removeAllocation(entityId: string) {
    setAllocations((prev) => prev.filter((a) => a.entityId !== entityId));
  }

  function updateAllocatedCents(entityId: string, cents: number) {
    setAllocations((prev) =>
      prev.map((a) => a.entityId === entityId ? { ...a, allocatedCents: Math.max(0, cents) } : a)
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeTab === "sistema") {
      if (allocations.length > 0 && !overAllocated) {
        onReconcile(
          allocations.map((a) => ({
            entityType: a.entityType,
            entityId: a.entityId,
            allocatedAmountCents: a.allocatedCents,
            supplierId: a.supplierId,
          })),
        );
      }
      return;
    }
    const payload: ClassifyMovementPayload = {
      justificationType: subType,
      notes: notes || undefined,
      documentUrl: documentUrl ?? undefined,
    };
    if (showsCostCenter(subType) && groupId) payload.costCenterGroupId = groupId;
    if (showsCostCenter(subType) && categoryId) payload.costCenterCategoryId = categoryId;
    if (showsSupplier(subType) && supplierId) payload.supplierId = supplierId;
    if (showsVat(subType) && vatMode !== "exempt") {
      payload.vatRate = vatRate;
      payload.vatIncluded = vatMode === "included";
    }
    if (showsTransferTarget(subType) && transferTarget)
      payload.notes = transferTarget + (notes ? `\n${notes}` : "");
    onSave(payload);
  }

  const canSubmitA = activeTab === "sistema" && allocations.length > 0 && !overAllocated && allocations.every((a) => a.allocatedCents > 0);
  const canSubmitB =
    activeTab === "justificar" &&
    (!requiresSupplier(subType) || !!supplierId) &&
    (!requiresCostCenter(subType) || (!!groupId && !!categoryId)) &&
    (!requiresNotes(subType) || !!notes.trim()) &&
    !uploading;
  const canSubmit = canSubmitA || canSubmitB;

  const candidateEntityIds = new Set(candidates.map((c) => c.entityId));
  const filteredSearchResults = invoiceSearchResults.filter(
    (inv) => !candidateEntityIds.has(inv.id) && !allocatedEntityIds.has(inv.id),
  );

  const panel = (
    <aside className={`flex flex-col bg-white ${inline ? "h-full w-full" : "h-full w-full max-w-lg shadow-2xl"}`}>
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#F5C992]/40 px-6 py-4 shrink-0">
          <div>
            <p className="text-xs font-medium text-stone-400">Classificar movimento</p>
            <h2 className="text-base font-bold text-stone-800 mt-0.5 truncate max-w-sm">
              {movement.description}
            </h2>
            <p className="text-sm text-stone-500 mt-0.5 flex items-center gap-2">
              <span>{formatDate(movement.bookingDate)}</span>
              <span className={`font-semibold ${movement.movementType === "debit" ? "text-red-600" : "text-emerald-600"}`}>
                {movement.movementType === "debit" ? "−" : "+"}{fromCents(movement.amount)}
              </span>
              <ReconciliationBadge status={movement.reconciliationStatus} />
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-stone-400 hover:bg-stone-100 shrink-0 ml-2">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* ── Read-only summary (resolved movements) ──────────────────── */}
        {!isEditMode ? (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* How it was classified */}
              {movement.entityLinks.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-3">Conciliado com o sistema</p>
                  <div className="space-y-2">
                    {movement.entityLinks.map((link) => (
                      <div key={link.id} className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                              {link.entityType === "invoice" ? "Fatura" : "Conta a Pagar"}
                            </p>
                            <p className="text-sm font-medium text-stone-800 truncate mt-0.5">{link.entityLabel}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-stone-800">{fromCents(link.allocatedAmountCents)}</p>
                            {link.allocatedAmountCents !== link.amountCents && (
                              <p className="text-xs text-stone-400">de {fromCents(link.amountCents)}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-lg border border-stone-100 bg-stone-50 px-4 py-2.5 flex items-center justify-between text-xs">
                    <span className="text-stone-500">Total alocado</span>
                    <span className="font-semibold text-stone-800">
                      {fromCents(movement.entityLinks.reduce((s, l) => s + l.allocatedAmountCents, 0))}
                      {" "}/ {fromCents(movement.amount)}
                    </span>
                  </div>
                </div>
              ) : movement.justificationType ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-3">Despesa justificada</p>
                  <div className="rounded-lg border border-stone-100 bg-stone-50 px-4 py-3 space-y-3">
                    {/* Justification type */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-stone-500">Tipo</span>
                      <span className="font-medium text-stone-800">{JUSTIFICATION_TYPE_LABELS[movement.justificationType]}</span>
                    </div>

                    {/* Supplier */}
                    {movement.supplierId && suppliers.length > 0 && (() => {
                      const s = suppliers.find((s) => s.id === movement.supplierId);
                      return s ? (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-stone-500">Fornecedor</span>
                          <span className="font-medium text-stone-800">{s.name}</span>
                        </div>
                      ) : null;
                    })()}

                    {/* Cost center */}
                    {movement.costCenterGroupId && (() => {
                      const g = groups.find((g) => g.id === movement.costCenterGroupId);
                      const c = categories.find((c) => c.id === movement.costCenterCategoryId);
                      return g ? (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-stone-500">Centro de custo</span>
                          <span className="font-medium text-stone-800 text-right">
                            {g.name}{c ? ` › ${c.name}` : ""}
                          </span>
                        </div>
                      ) : null;
                    })()}

                    {/* VAT */}
                    {movement.vatRate != null && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-stone-500">IVA</span>
                        <span className="font-medium text-stone-800">
                          {movement.vatRate}%{movement.vatIncluded ? " incluído" : " excluído"}
                        </span>
                      </div>
                    )}

                    {/* Document */}
                    {movement.documentUrl && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-stone-500">Documento</span>
                        <a href={movement.documentUrl} target="_blank" rel="noopener noreferrer"
                          className="font-medium text-[#ED5C32] hover:underline">
                          Ver ficheiro
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {movement.notes && (
                    <div className="mt-3 rounded-lg border border-stone-100 bg-stone-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">Notas</p>
                      <p className="text-sm text-stone-700">{movement.notes}</p>
                    </div>
                  )}
                </div>
              ) : movement.reconciliationStatus === "conciliado_sem_fatura" ? (
                <div className="rounded-lg border border-teal-100 bg-teal-50/60 px-4 py-4 flex gap-3">
                  <svg className="h-5 w-5 shrink-0 text-teal-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-teal-800">Conciliado sem fatura</p>
                    <p className="text-xs text-teal-700 mt-1">
                      {movement.movementType === "credit"
                        ? "Entrada de crédito reconhecida automaticamente — sem fatura de venda associada."
                        : "Movimento conciliado sem documento de suporte associado."}
                    </p>
                    {movement.notes && (
                      <p className="text-xs text-teal-700 mt-2 border-t border-teal-200 pt-2">{movement.notes}</p>
                    )}
                  </div>
                </div>
              ) : movement.reconciliationStatus === "transferencia_interna" ? (
                <div className="rounded-lg border border-violet-100 bg-violet-50/60 px-4 py-4 flex gap-3">
                  <svg className="h-5 w-5 shrink-0 text-violet-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 5a1 1 0 011 1v1.586l1.293-1.293a1 1 0 111.414 1.414L9.414 10l2.293 2.293a1 1 0 01-1.414 1.414L9 12.414V14a1 1 0 11-2 0v-1.586l-1.293 1.293a1 1 0 01-1.414-1.414L6.586 10 4.293 7.707a1 1 0 011.414-1.414L7 7.586V6a1 1 0 011-1z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-violet-800">Transferência interna</p>
                    {movement.notes && (
                      <p className="text-xs text-violet-700 mt-1">{movement.notes}</p>
                    )}
                  </div>
                </div>
              ) : movement.reconciliationStatus === "ignorado_com_motivo" ? (
                <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-4 flex gap-3">
                  <svg className="h-5 w-5 shrink-0 text-stone-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06L3.28 2.22zM6.116 7.176A4.003 4.003 0 0010 13.5a4 4 0 003.656-5.616L6.116 7.176zM4.07 5.13L2.457 3.518A9.959 9.959 0 000 10c0 5.523 4.477 10 10 10s10-4.477 10-10c0-2.42-.859-4.64-2.278-6.368l-1.616 1.616A7.5 7.5 0 1110 2.5a7.46 7.46 0 014.748 1.696L16.37 2.578A9.959 9.959 0 0010 0C4.477 0 0 4.477 0 10c0 1.552.354 3.022.984 4.337L4.07 5.13z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-stone-600">Ignorado com motivo</p>
                    {movement.notes && (
                      <p className="text-xs text-stone-500 mt-1">{movement.notes}</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-stone-400 text-center py-8">Sem detalhes de classificação.</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t border-[#F5C992]/40 px-6 py-4 shrink-0">
              <button type="button" onClick={onClose}
                className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
                Fechar
              </button>
              <button type="button"
                onClick={() => { setIsEditMode(true); setActiveTab(defaultTab); }}
                className="flex-1 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
                Alterar classificação
              </button>
            </div>
          </>
        ) : (
          <>
        {/* Tabs */}
        <div className="flex border-b border-[#F5C992]/40 shrink-0">
          {(
            [["sistema", "Conciliar com sistema"], ["justificar", "Justificar despesa"]] as [ClassifyTab, string][]
          ).map(([tab, label]) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab ? "border-[#ED5C32] text-[#ED5C32]" : "border-transparent text-stone-400 hover:text-stone-600"
              }`}>
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* ── Tab A: Conciliar com sistema ────────────────────────────── */}
            {activeTab === "sistema" && (
              <>
                <div className={`rounded-lg border px-4 py-3 ${overAllocated ? "border-red-200 bg-red-50" : withinTolerance && allocations.length > 0 ? "border-emerald-200 bg-emerald-50" : "border-stone-200 bg-stone-50"}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${overAllocated ? "text-red-600" : "text-stone-500"}`}>Resumo de alocação</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Valor do movimento</span>
                      <span className="font-semibold text-stone-800">{fromCents(movement.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Total alocado</span>
                      <span className={`font-semibold ${overAllocated ? "text-red-600" : "text-stone-800"}`}>{fromCents(totalAllocated)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Por alocar</span>
                      <span className={`font-semibold ${remaining < 0 ? "text-red-600" : remaining === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                        {fromCents(Math.abs(remaining))}{remaining < 0 ? " (excesso)" : ""}
                      </span>
                    </div>
                  </div>
                  {allocations.length > 0 && (
                    <div className="mt-2 h-1.5 rounded-full bg-stone-200 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${overAllocated ? "bg-red-500" : withinTolerance ? "bg-emerald-500" : "bg-amber-400"}`}
                        style={{ width: `${Math.min(100, Math.round((totalAllocated / movement.amount) * 100))}%` }} />
                    </div>
                  )}
                  {overAllocated && <p className="mt-1.5 text-xs text-red-600">Total alocado excede o valor do movimento.</p>}
                  {!overAllocated && remaining > 100 && allocations.length > 0 && (
                    <p className="mt-1.5 text-xs text-amber-600">Restam {fromCents(remaining)} por alocar — o movimento ficará parcialmente conciliado.</p>
                  )}
                  {withinTolerance && allocations.length > 0 && <p className="mt-1.5 text-xs text-emerald-600">Movimento totalmente coberto.</p>}
                </div>

                {allocations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Faturas / contas a alocar ({allocations.length})</p>
                    <div className="space-y-2">
                      {allocations.map((a) => {
                        const exceedsBalance = a.allocatedCents > a.openBalanceCents;
                        return (
                          <div key={a.entityId} className={`rounded-lg border px-3 py-2.5 ${exceedsBalance ? "border-red-200 bg-red-50" : "border-[#F5C992]/60 bg-[#FDF8F5]"}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-stone-800 truncate">{a.entityLabel}</p>
                                <p className="text-xs text-stone-400 mt-0.5">
                                  {a.entityType === "invoice" ? "Fatura" : "Conta a pagar"}{" · "}
                                  Total: {fromCents(a.totalCents)}{" · "}Em aberto: {fromCents(a.openBalanceCents)}
                                </p>
                              </div>
                              <button type="button" onClick={() => removeAllocation(a.entityId)}
                                className="shrink-0 text-stone-300 hover:text-red-400 mt-0.5" title="Remover">
                                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                </svg>
                              </button>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <label className="text-xs text-stone-500 shrink-0">A alocar (€)</label>
                              <input type="number" min="0.01" step="0.01"
                                value={(a.allocatedCents / 100).toFixed(2)}
                                onChange={(e) => updateAllocatedCents(a.entityId, Math.round(parseFloat(e.target.value || "0") * 100))}
                                className={`flex-1 rounded-md border px-2 py-1 text-sm text-right focus:outline-none ${exceedsBalance ? "border-red-400 bg-red-50 text-red-700" : "border-stone-300 bg-white focus:border-[#ED5C32]"}`} />
                              <span className="text-xs shrink-0 w-32 text-right">
                                {a.openBalanceCents - a.allocatedCents <= 0 ? (
                                  <span className="text-emerald-600 font-medium">✓ Pago na totalidade</span>
                                ) : (
                                  <span className="text-amber-600">{fromCents(a.openBalanceCents - a.allocatedCents)} em aberto</span>
                                )}
                              </span>
                            </div>
                            {exceedsBalance && <p className="text-xs text-red-600 mt-1">Excede o saldo em aberto ({fromCents(a.openBalanceCents)}).</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {allocations.length === 0 && (
                  <p className="text-xs text-stone-400 bg-stone-50 rounded-md px-3 py-3 text-center">
                    Seleciona faturas ou contas a pagar abaixo para associar a este movimento.
                  </p>
                )}

                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Sugestões automáticas</p>
                  {loadingCandidates && <p className="text-xs text-stone-400 py-1">A procurar correspondências…</p>}
                  {!loadingCandidates && candidates.filter((c) => !allocatedEntityIds.has(c.entityId)).length === 0 && (
                    <p className="text-xs text-stone-400 py-1">Nenhuma correspondência automática encontrada.</p>
                  )}
                  {candidates.filter((c) => !allocatedEntityIds.has(c.entityId)).length > 0 && (
                    <div className="space-y-1.5">
                      {candidates.filter((c) => !allocatedEntityIds.has(c.entityId)).map((c) => (
                        <EntityCard key={c.entityId} candidate={c}
                          onAdd={() => addAllocation({ entityType: c.entityType, entityId: c.entityId, entityLabel: c.entityLabel, supplierId: c.supplierId, totalCents: c.amountCents, openBalanceCents: c.openBalanceCents })} />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Procurar faturas</p>
                  <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nome do fornecedor ou nº de fatura…" className={inputCls} />
                  {loadingSearch && debouncedSearch.length >= 2 && <p className="text-xs text-stone-400 mt-2">A procurar…</p>}
                  {!loadingSearch && debouncedSearch.length >= 2 && filteredSearchResults.length === 0 && (
                    <p className="text-xs text-stone-400 mt-2">Sem resultados para "{debouncedSearch}".</p>
                  )}
                  {filteredSearchResults.length > 0 && (
                    <div className="mt-2 border border-stone-200 rounded-lg overflow-hidden">
                      <div className="space-y-1.5 p-2 max-h-56 overflow-y-auto">
                        {filteredSearchResults.map((inv) => (
                          <InvoiceCard key={inv.id} invoice={inv}
                            onAdd={() => addAllocation({ entityType: "invoice", entityId: inv.id, entityLabel: `${inv.supplierName} — ${inv.invoiceNumber}`, supplierId: inv.supplierId ?? null, totalCents: inv.totalWithVat, openBalanceCents: inv.totalWithVat })} />
                        ))}
                      </div>
                      <div className="border-t border-stone-100 bg-stone-50 px-3 py-1.5">
                        <p className="text-xs text-stone-400">{filteredSearchResults.length} resultado{filteredSearchResults.length !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Tab B: Justificar ──────────────────────────────────────── */}
            {activeTab === "justificar" && (
              <>
                <div>
                  <label className={labelCls}>Tipo de justificação *</label>
                  <select value={subType} onChange={(e) => { setSubType(e.target.value as JustificationType); setDocumentUrl(movement.documentUrl); setUploadFile(null); }} className={inputCls}>
                    {TAB_B_SUB_TYPES.map((jt) => (
                      <option key={jt} value={jt}>{JUSTIFICATION_TYPE_LABELS[jt]}</option>
                    ))}
                  </select>
                </div>

                {showsDocument(subType) && (
                  <div>
                    <label className={labelCls}>Comprovativo{subType === "recibo_comprovativo" ? " *" : " (opcional)"}</label>
                    <div className="rounded-lg border-2 border-dashed border-stone-200 p-4 text-center cursor-pointer hover:border-[#ED5C32]/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}>
                      <input ref={fileInputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFileSelect} />
                      {uploading ? <p className="text-xs text-stone-400">A carregar…</p>
                        : documentUrl ? (
                          <div className="flex items-center justify-center gap-2">
                            <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs text-emerald-600 font-medium">{uploadFile?.name ?? "Comprovativo carregado"}</span>
                            <button type="button" onClick={(e) => { e.stopPropagation(); setDocumentUrl(null); setUploadFile(null); }} className="text-xs text-stone-400 hover:text-red-500 ml-1">×</button>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-stone-500">Clique ou arraste PDF / imagem</p>
                            <p className="text-xs text-stone-300 mt-0.5">máx. 10 MB</p>
                          </div>
                        )}
                    </div>
                    {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
                  </div>
                )}

                {showsSupplier(subType) && (
                  <div className="relative">
                    <label className={labelCls}>Fornecedor{requiresSupplier(subType) ? " *" : " (opcional)"}</label>
                    <input type="text"
                      value={supplierId ? (selectedSupplier?.name ?? supplierId) : supplierSearch}
                      onChange={(e) => { setSupplierId(""); setSupplierSearch(e.target.value); setSupplierOpen(true); }}
                      onFocus={() => setSupplierOpen(true)}
                      placeholder="Pesquisar fornecedor…" className={inputCls} />
                    {supplierId && (
                      <button type="button" onClick={() => { setSupplierId(""); setSupplierSearch(""); setGroupId(""); setCategoryId(""); }}
                        className="absolute right-2 top-7 text-stone-300 hover:text-red-400">
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      </button>
                    )}
                    {supplierOpen && !supplierId && suppliers.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-md border border-stone-200 bg-white shadow-lg max-h-44 overflow-y-auto">
                        {suppliers.map((s) => (
                          <button key={s.id} type="button"
                            onClick={() => { setSupplierId(s.id); setSupplierSearch(""); setSupplierOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50">
                            {s.name}{s.nif && <span className="ml-2 text-xs text-stone-400">{s.nif}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    <a href="/financial/suppliers" target="_blank" rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-[#ED5C32] hover:underline">
                      <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                      </svg>
                      Cadastrar novo fornecedor
                    </a>
                  </div>
                )}

                {showsCostCenter(subType) && (
                  <div className="space-y-2">
                    <div>
                      <label className={labelCls}>Grupo de custo *</label>
                      <select value={groupId} onChange={(e) => handleGroupChange(e.target.value)} className={inputCls} required>
                        <option value="">Seleccionar grupo…</option>
                        {groups.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Categoria *</label>
                      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls} disabled={!groupId} required>
                        <option value="">{groupId ? "Seleccionar categoria…" : "Primeiro selecciona o grupo"}</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {showsVat(subType) && (
                  <div>
                    <label className={labelCls}>IVA</label>
                    <div className="flex gap-2 mb-2">
                      {(
                        [["included", "Inclui IVA"], ["excluded", "Não inclui IVA"], ["exempt", "Isento / N/A"]] as [VatMode, string][]
                      ).map(([mode, label]) => (
                        <button key={mode} type="button" onClick={() => setVatMode(mode)}
                          className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${vatMode === mode ? "border-[#ED5C32] bg-[#FDF8F5] text-[#ED5C32]" : "border-stone-200 text-stone-500 hover:border-stone-300"}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {vatMode !== "exempt" && (
                      <div className="flex gap-2">
                        {VAT_RATES.map((r) => (
                          <button key={r} type="button" onClick={() => setVatRate(r)}
                            className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${vatRate === r ? "border-[#ED5C32] bg-[#FDF8F5] text-[#ED5C32]" : "border-stone-200 text-stone-500 hover:border-stone-300"}`}>
                            {r}%
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {showsTransferTarget(subType) && (
                  <div>
                    <label className={labelCls}>Conta de destino</label>
                    <input type="text" value={transferTarget} onChange={(e) => setTransferTarget(e.target.value)}
                      placeholder="Ex: Conta poupança BCP IBAN PT50…" className={inputCls} />
                  </div>
                )}

                <div>
                  <label className={labelCls}>Notas{requiresNotes(subType) ? " *" : " (opcional)"}</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                    required={requiresNotes(subType)} className={inputCls}
                    placeholder={requiresNotes(subType) ? "Motivo obrigatório" : "Opcional"} />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-[#F5C992]/40 px-6 py-4 shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving || uploading || !canSubmit}
              className="flex-1 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40">
              {saving ? "A guardar…" : uploading ? "A carregar ficheiro…" : "Classificar"}
            </button>
          </div>
        </form>
          </>
        )}
      </aside>
  );

  if (inline) return panel;

  return createPortal(
    <div className="fixed inset-0 z-50 flex" aria-modal="true">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      {panel}
    </div>,
    document.body,
  );
}
