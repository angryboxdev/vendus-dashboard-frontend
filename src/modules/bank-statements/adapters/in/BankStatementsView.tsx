import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBankStatementsModule } from "../../bank-statements.module.tsx";
import { useFinancialBaseModule } from "../../../financial-base/financial-base.module.tsx";
import { useInvoicesModule } from "../../../invoices/invoices.module.tsx";
import type { StatementPreview } from "../../domain/ports/out/bank-statements-api.port.ts";
import type { CostCenterGroup, CostCenterCategory } from "../../../financial-base/domain/entities/cost-center.ts";
import type { Supplier } from "../../../financial-base/domain/entities/supplier.ts";
import type { InvoiceDTO } from "../../../invoices/domain/entities/invoice.ts";
import {
  type BankMovementDTO,
  type BankStatementSummaryDTO,
  type ClassifyMovementPayload,
  type JustificationType,
  type MovementCandidateDTO,
  type ReconciliationStatus,
  type RiskLevel,
  type StatementStatus,
  RECONCILIATION_STATUS_LABELS,
  JUSTIFICATION_TYPE_LABELS,
  RISK_LEVEL_LABELS,
  STATEMENT_STATUS_LABELS,
} from "../../domain/entities/bank-statement.ts";
import { PageFooter } from "../../../../components/PageFooter.tsx";
import { useToast, ToastContainer } from "../../../../components/Toast.tsx";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fromCents(n: number): string {
  return (n / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function formatDate(s: string): string {
  if (!s) return "—";
  const parts = s.slice(0, 10).split("-");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function diffClass(diff: number): string {
  if (diff === 0) return "text-emerald-600";
  if (Math.abs(diff) < 100) return "text-amber-600";
  return "text-red-600";
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
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[status]}`}
    >
      {RECONCILIATION_STATUS_LABELS[status]}
    </span>
  );
}

const RISK_COLORS: Record<RiskLevel, string> = {
  low: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-red-50 text-red-700",
  critical: "bg-red-100 text-red-800 font-bold",
};

function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${RISK_COLORS[level]}`}>
      Risco {RISK_LEVEL_LABELS[level]}
    </span>
  );
}

const STMT_STATUS_COLORS: Record<StatementStatus, string> = {
  draft: "bg-stone-100 text-stone-500",
  in_review: "bg-amber-50 text-amber-700",
  completed: "bg-blue-50 text-blue-700",
  closed: "bg-emerald-50 text-emerald-700",
};

function StatementStatusBadge({ status }: { status: StatementStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STMT_STATUS_COLORS[status]}`}>
      {STATEMENT_STATUS_LABELS[status]}
    </span>
  );
}

// ── KpiCard ───────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  valueClass = "text-stone-800",
}: {
  label: string;
  value: string | number;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-stone-400">{sub}</p>}
    </div>
  );
}

// ── EditableBalanceCard ────────────────────────────────────────────────────────

function EditableBalanceCard({
  label,
  valueCents,
  disabled,
  onSave,
}: {
  label: string;
  valueCents: number;
  disabled: boolean;
  onSave: (cents: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    if (disabled) return;
    setDraft((valueCents / 100).toFixed(2));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commit() {
    const v = parseFloat(draft.replace(",", "."));
    if (!isNaN(v)) onSave(Math.round(v * 100));
    setEditing(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") setEditing(false);
  }

  return (
    <div
      className={`rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm ${!disabled ? "cursor-pointer hover:border-[#ED5C32]/40" : ""}`}
      onClick={() => !editing && startEdit()}
      title={disabled ? undefined : "Clique para editar"}
    >
      <p className="text-xs font-medium text-stone-500 flex items-center gap-1">
        {label}
        {!disabled && !editing && (
          <svg className="h-3 w-3 text-stone-300" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
          </svg>
        )}
      </p>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKey}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 w-full border-b border-[#ED5C32] bg-transparent text-xl font-bold text-stone-800 outline-none"
        />
      ) : (
        <p className="mt-1 text-xl font-bold text-stone-800">{fromCents(valueCents)}</p>
      )}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color =
    pct === 100
      ? "bg-emerald-500"
      : pct >= 60
      ? "bg-amber-400"
      : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-stone-600">{pct}%</span>
    </div>
  );
}

// ── Import Modal ──────────────────────────────────────────────────────────────

function ImportModal({
  open,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  const { api } = useBankStatementsModule();

  // Step 1: pick file; Step 2: confirm/fill metadata
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Metadata fields (pre-filled from preview)
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [movementsCount, setMovementsCount] = useState<number | null>(null);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setSelectedFile(null);
      setPreviewing(false);
      setPreviewError(null);
      setBankName("");
      setAccountNumber("");
      setOpeningBalance("");
      setClosingBalance("");
      setPeriodStart("");
      setPeriodEnd("");
      setMovementsCount(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleAnalyse() {
    if (!selectedFile) return;
    setPreviewing(true);
    setPreviewError(null);
    try {
      const preview: StatementPreview = await api.previewStatement(selectedFile);
      if (preview.bankName) setBankName(preview.bankName);
      if (preview.accountNumber) setAccountNumber(preview.accountNumber);
      if (preview.openingBalance != null) setOpeningBalance((preview.openingBalance / 100).toFixed(2));
      if (preview.closingBalance != null) setClosingBalance((preview.closingBalance / 100).toFixed(2));
      if (preview.periodStart) setPeriodStart(preview.periodStart);
      if (preview.periodEnd) setPeriodEnd(preview.periodEnd);
      setMovementsCount(preview.movementsCount);
      setStep(2);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Erro ao analisar o ficheiro.");
    } finally {
      setPreviewing(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;
    const fd = new FormData();
    fd.append("file", selectedFile);
    if (bankName) fd.append("bankName", bankName);
    if (accountNumber) fd.append("accountNumber", accountNumber);
    if (openingBalance) fd.append("openingBalance", String(Math.round(parseFloat(openingBalance) * 100)));
    if (closingBalance) fd.append("closingBalance", String(Math.round(parseFloat(closingBalance) * 100)));
    if (periodStart) fd.append("periodStart", periodStart);
    if (periodEnd) fd.append("periodEnd", periodEnd);
    fd.append("currency", "EUR");
    onSubmit(fd);
  }

  const labelCls = "block text-xs font-medium text-stone-500 mb-1";
  const inputCls =
    "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F5C992]/40 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-stone-800">Importar Extrato Bancário</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              {step === 1 ? "Passo 1 de 2 — selecionar ficheiro" : "Passo 2 de 2 — confirmar dados"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-stone-400 hover:bg-stone-100">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="px-6 py-6 space-y-5">
            <div>
              <label className={labelCls}>Ficheiro CSV ou XLSX</label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="w-full text-sm text-stone-600"
                onChange={(e) => {
                  setSelectedFile(e.target.files?.[0] ?? null);
                  setPreviewError(null);
                }}
              />
              <p className="mt-1 text-xs text-stone-400">
                Suporta CSV (Millennium BCP ou genérico PT) e Excel (.xlsx / .xls).
              </p>
            </div>

            {previewError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{previewError}</p>
            )}

            <div className="flex gap-3 border-t border-[#F5C992]/40 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!selectedFile || previewing}
                onClick={handleAnalyse}
                className="flex-1 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {previewing ? "A analisar…" : "Analisar ficheiro →"}
              </button>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
            {/* Summary pill */}
            {movementsCount != null && (
              <div className="flex items-center gap-2 rounded-lg bg-[#FDF8F5] border border-[#F5C992]/40 px-4 py-2.5">
                <svg className="h-4 w-4 text-[#ED5C32] shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-stone-700">
                  <span className="font-semibold">{movementsCount}</span> movimentos detetados em <span className="font-semibold">{selectedFile?.name}</span>
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  Banco *
                  {!bankName && <span className="ml-1 text-amber-500">(não detetado)</span>}
                </label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className={inputCls}
                  placeholder="ex: Millennium BCP"
                />
              </div>
              <div>
                <label className={labelCls}>
                  Conta / IBAN *
                  {!accountNumber && <span className="ml-1 text-amber-500">(não detetado)</span>}
                </label>
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className={inputCls}
                  placeholder="ex: PT50..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Saldo inicial (€) *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  className={inputCls}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className={labelCls}>Saldo final extrato (€) *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(e.target.value)}
                  className={inputCls}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Período início</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Período fim</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex gap-3 border-t border-[#F5C992]/40 pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                ← Voltar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "A importar…" : "Importar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Classify Drawer ───────────────────────────────────────────────────────────

const VAT_RATES = [0, 6, 13, 23] as const;
type VatMode = "included" | "excluded" | "exempt";

type ClassifyTab = "sistema" | "justificar";

// Sub-types shown in Tab B (excludes "fatura" which belongs to Tab A)
const TAB_B_SUB_TYPES: JustificationType[] = [
  "recibo_comprovativo",
  "despesa_bancaria_automatica",
  "contrato_recorrencia",
  "transferencia_interna",
  "emprestimo_financiamento",
  "sem_justificativa",
];

// Which sub-types show each optional section
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
function showsTransferTarget(jt: JustificationType) {
  return jt === "transferencia_interna";
}
function requiresSupplier(jt: JustificationType) {
  return jt === "contrato_recorrencia";
}
function requiresCostCenter(jt: JustificationType) {
  return showsCostCenter(jt);
}
function requiresNotes(jt: JustificationType) {
  return jt === "sem_justificativa";
}

function EntityCard({ candidate, selected, onToggle }: {
  candidate: MovementCandidateDTO;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-colors ${
        selected ? "border-[#ED5C32] bg-[#FDF8F5]" : "border-stone-200 hover:border-stone-300"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-stone-800 truncate">{candidate.entityLabel}</span>
        <span className="shrink-0 text-xs text-stone-400">{Math.round(candidate.confidence * 100)}%</span>
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-xs text-stone-500">{fromCents(candidate.amountCents)}</span>
        <span className="text-xs text-stone-300">·</span>
        <span className="text-xs text-stone-400">{formatDate(candidate.date)}</span>
        <span className="text-xs text-stone-300">·</span>
        <span className={`text-xs font-medium ${candidate.entityType === "invoice" ? "text-blue-600" : "text-violet-600"}`}>
          {candidate.entityType === "invoice" ? "Fatura" : "Conta a pagar"}
        </span>
      </div>
    </button>
  );
}

function InvoiceCard({ invoice, selected, onToggle }: {
  invoice: InvoiceDTO;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-colors ${
        selected ? "border-[#ED5C32] bg-[#FDF8F5]" : "border-stone-200 hover:border-stone-300"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-stone-800 truncate">{invoice.supplierName}</span>
        <span className="text-xs text-stone-400">{fromCents(invoice.totalWithVat)}</span>
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-xs text-stone-500">Nº {invoice.invoiceNumber}</span>
        <span className="text-xs text-stone-300">·</span>
        <span className="text-xs text-stone-400">{formatDate(invoice.invoiceDate)}</span>
        <span className="text-xs text-stone-300">·</span>
        <span className="text-xs font-medium text-blue-600">Fatura</span>
      </div>
    </button>
  );
}

function ClassifyDrawer({
  movement,
  onClose,
  onSave,
  onReconcile,
  saving,
}: {
  movement: BankMovementDTO;
  onClose: () => void;
  onSave: (payload: ClassifyMovementPayload) => void;
  onReconcile: (entityLinks: Array<{ entityType: "invoice" | "payable_entry"; entityId: string; supplierId: string | null }>) => void;
  saving: boolean;
}) {
  const { api } = useBankStatementsModule();
  const fbApi = useFinancialBaseModule().api;
  const invApi = useInvoicesModule().api;

  const labelCls = "block text-xs font-medium text-stone-500 mb-1";
  const inputCls = "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#ED5C32]";

  // ─── Tab state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ClassifyTab>("sistema");

  // ─── Tab A: Sistema ───────────────────────────────────────────────────────
  const [selectedCandidates, setSelectedCandidates] = useState<MovementCandidateDTO[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<InvoiceDTO[]>([]);
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

  // ─── Tab B: Justificar ────────────────────────────────────────────────────
  const [subType, setSubType] = useState<JustificationType>(
    movement.justificationType && movement.justificationType !== "fatura"
      ? movement.justificationType
      : "recibo_comprovativo"
  );
  const [notes, setNotes] = useState(movement.notes ?? "");
  const [transferTarget, setTransferTarget] = useState("");

  // Cost center
  const [groupId, setGroupId] = useState<string>(movement.costCenterGroupId ?? "");
  const [categoryId, setCategoryId] = useState<string>(movement.costCenterCategoryId ?? "");

  // Supplier
  const [supplierId, setSupplierId] = useState<string>(movement.supplierId ?? "");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);

  // VAT
  const [vatMode, setVatMode] = useState<VatMode>("exempt");
  const [vatRate, setVatRate] = useState<number>(23);

  // Document upload
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(movement.documentUrl);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Reference data ───────────────────────────────────────────────────────
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

  // Auto-fill cost center from supplier
  useEffect(() => {
    if (selectedSupplier) {
      if (selectedSupplier.defaultCostCenterGroupId && !groupId) {
        setGroupId(selectedSupplier.defaultCostCenterGroupId);
      }
      if (selectedSupplier.defaultCostCenterCategoryId && !categoryId) {
        setCategoryId(selectedSupplier.defaultCostCenterCategoryId);
      }
    }
  }, [selectedSupplier, groupId, categoryId]);

  // Reset category when group changes
  function handleGroupChange(newGroupId: string) {
    setGroupId(newGroupId);
    setCategoryId("");
  }

  // ─── Document upload ──────────────────────────────────────────────────────
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

  // ─── Submit ───────────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (activeTab === "sistema") {
      const links: Array<{ entityType: "invoice" | "payable_entry"; entityId: string; supplierId: string | null }> = [
        ...selectedCandidates.map((c) => ({
          entityType: c.entityType,
          entityId: c.entityId,
          supplierId: c.supplierId,
        })),
        ...selectedInvoices.map((inv) => ({
          entityType: "invoice" as const,
          entityId: inv.id,
          supplierId: inv.supplierId ?? null,
        })),
      ];
      if (links.length > 0) onReconcile(links);
      return;
    }

    // Tab B
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
    if (showsTransferTarget(subType) && transferTarget) {
      payload.notes = transferTarget + (notes ? `\n${notes}` : "");
    }

    onSave(payload);
  }

  // ─── Validation ───────────────────────────────────────────────────────────
  const canSubmitA = activeTab === "sistema" && (selectedCandidates.length > 0 || selectedInvoices.length > 0);
  const canSubmitB = activeTab === "justificar" && (
    !requiresSupplier(subType) || !!supplierId
  ) && (
    !requiresCostCenter(subType) || (!!groupId && !!categoryId)
  ) && (
    !requiresNotes(subType) || !!notes.trim()
  ) && !uploading;

  const canSubmit = canSubmitA || canSubmitB;

  // Invoice search results filtered to remove duplicates with candidates
  const candidateEntityIds = new Set(candidates.map((c) => c.entityId));
  const filteredSearchResults = invoiceSearchResults.filter(
    (inv) => !candidateEntityIds.has(inv.id)
  );

  // Running total for Tab A
  const selectedCandidateIds = new Set(selectedCandidates.map((c) => c.entityId));
  const selectedInvoiceIds = new Set(selectedInvoices.map((i) => i.id));
  const totalSelected =
    selectedCandidates.reduce((s, c) => s + c.amountCents, 0) +
    selectedInvoices.reduce((s, inv) => s + inv.totalWithVat, 0);
  const amountDiff = movement.amount - totalSelected;
  const withinTolerance = Math.abs(amountDiff) <= 100;

  return (
    <div className="fixed inset-0 z-50 flex" aria-modal="true">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#F5C992]/40 px-6 py-4 shrink-0">
          <div>
            <p className="text-xs font-medium text-stone-400">Classificar movimento</p>
            <h2 className="text-base font-bold text-stone-800 mt-0.5 truncate max-w-sm">{movement.description}</h2>
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

        {/* Tabs */}
        <div className="flex border-b border-[#F5C992]/40 px-6 shrink-0">
          {([["sistema", "Conciliar com sistema"], ["justificar", "Justificar despesa"]] as [ClassifyTab, string][]).map(
            ([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-1 mr-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-[#ED5C32] text-[#ED5C32]"
                    : "border-transparent text-stone-400 hover:text-stone-600"
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

            {/* ── Tab A: Sistema ─────────────────────────────────────────── */}
            {activeTab === "sistema" && (
              <>
                {/* Currently linked entities */}
                {movement.entityLinks.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                      Entidades associadas
                    </p>
                    <div className="space-y-1.5">
                      {movement.entityLinks.map((link) => (
                        <div key={link.id} className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm">
                          <div className="min-w-0">
                            <p className="font-medium text-stone-800 truncate">{link.entityLabel}</p>
                            <p className="text-xs text-stone-500 mt-0.5">
                              {link.entityType === "invoice" ? "Fatura" : "Conta a pagar"}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-stone-700 ml-3 shrink-0">
                            {fromCents(link.amountCents)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {movement.reconciliationAmountDiff != null && (
                      <p className="mt-2 text-xs text-yellow-700 bg-yellow-50 rounded-md px-3 py-2">
                        Diferença não coberta: {fromCents(Math.abs(movement.reconciliationAmountDiff))}
                      </p>
                    )}
                  </div>
                )}

                {/* Auto-matched suggestions */}
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                    Sugestões automáticas
                  </p>
                  {loadingCandidates && <p className="text-xs text-stone-400 py-1">A procurar correspondências…</p>}
                  {!loadingCandidates && candidates.length === 0 && (
                    <p className="text-xs text-stone-400 py-1">Nenhuma correspondência automática encontrada.</p>
                  )}
                  {candidates.length > 0 && (
                    <div className="space-y-1.5">
                      {candidates.map((c) => (
                        <EntityCard
                          key={c.entityId}
                          candidate={c}
                          selected={selectedCandidateIds.has(c.entityId)}
                          onToggle={() => {
                            setSelectedCandidates((prev) =>
                              prev.some((x) => x.entityId === c.entityId)
                                ? prev.filter((x) => x.entityId !== c.entityId)
                                : [...prev, c]
                            );
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Free search */}
                <div>
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                    Procurar outra fatura
                  </p>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Nome do fornecedor ou nº de fatura…"
                    className={inputCls}
                  />
                  {loadingSearch && debouncedSearch.length >= 2 && (
                    <p className="text-xs text-stone-400 mt-2">A procurar…</p>
                  )}
                  {!loadingSearch && debouncedSearch.length >= 2 && filteredSearchResults.length === 0 && (
                    <p className="text-xs text-stone-400 mt-2">Sem resultados para "{debouncedSearch}".</p>
                  )}
                  {filteredSearchResults.length > 0 && (
                    <div className="space-y-1.5 mt-2 max-h-56 overflow-y-auto pr-1">
                      {filteredSearchResults.map((inv) => (
                        <InvoiceCard
                          key={inv.id}
                          invoice={inv}
                          selected={selectedInvoiceIds.has(inv.id)}
                          onToggle={() => {
                            setSelectedInvoices((prev) =>
                              prev.some((x) => x.id === inv.id)
                                ? prev.filter((x) => x.id !== inv.id)
                                : [...prev, inv]
                            );
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Running total bar */}
                {(selectedCandidates.length > 0 || selectedInvoices.length > 0) ? (
                  <div className={`rounded-md px-3 py-2.5 text-xs ${withinTolerance ? "bg-emerald-50" : "bg-yellow-50"}`}>
                    <div className="flex items-center justify-between font-medium">
                      <span className={withinTolerance ? "text-emerald-700" : "text-yellow-700"}>
                        {withinTolerance ? "Correspondência completa" : "Correspondência parcial"}
                      </span>
                      <span className={withinTolerance ? "text-emerald-700" : "text-yellow-700"}>
                        {fromCents(totalSelected)} / {fromCents(movement.amount)}
                      </span>
                    </div>
                    {!withinTolerance && (
                      <p className="mt-0.5 text-yellow-600">
                        Diferença: {fromCents(Math.abs(amountDiff))} — o movimento ficará com pendência.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                    Selecciona uma ou mais faturas / contas a pagar para associar a este movimento.
                  </p>
                )}
              </>
            )}

            {/* ── Tab B: Justificar ──────────────────────────────────────── */}
            {activeTab === "justificar" && (
              <>
                {/* Sub-type */}
                <div>
                  <label className={labelCls}>Tipo de justificação *</label>
                  <select
                    value={subType}
                    onChange={(e) => {
                      setSubType(e.target.value as JustificationType);
                      setDocumentUrl(movement.documentUrl);
                      setUploadFile(null);
                    }}
                    className={inputCls}
                  >
                    {TAB_B_SUB_TYPES.map((jt) => (
                      <option key={jt} value={jt}>{JUSTIFICATION_TYPE_LABELS[jt]}</option>
                    ))}
                  </select>
                </div>

                {/* Document upload */}
                {showsDocument(subType) && (
                  <div>
                    <label className={labelCls}>
                      Comprovativo{subType === "recibo_comprovativo" ? " *" : " (opcional)"}
                    </label>
                    <div
                      className="rounded-lg border-2 border-dashed border-stone-200 p-4 text-center cursor-pointer hover:border-[#ED5C32]/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                      {uploading ? (
                        <p className="text-xs text-stone-400">A carregar…</p>
                      ) : documentUrl ? (
                        <div className="flex items-center justify-center gap-2">
                          <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs text-emerald-600 font-medium">
                            {uploadFile?.name ?? "Comprovativo carregado"}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setDocumentUrl(null); setUploadFile(null); }}
                            className="text-xs text-stone-400 hover:text-red-500 ml-1"
                          >
                            ×
                          </button>
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

                {/* Supplier */}
                {showsSupplier(subType) && (
                  <div className="relative">
                    <label className={labelCls}>
                      Fornecedor{requiresSupplier(subType) ? " *" : " (opcional)"}
                    </label>
                    <input
                      type="text"
                      value={supplierId ? (selectedSupplier?.name ?? supplierId) : supplierSearch}
                      onChange={(e) => {
                        setSupplierId("");
                        setSupplierSearch(e.target.value);
                        setSupplierOpen(true);
                      }}
                      onFocus={() => setSupplierOpen(true)}
                      placeholder="Pesquisar fornecedor…"
                      className={inputCls}
                    />
                    {supplierId && (
                      <button
                        type="button"
                        onClick={() => { setSupplierId(""); setSupplierSearch(""); setGroupId(""); setCategoryId(""); }}
                        className="absolute right-2 top-7 text-stone-300 hover:text-red-400"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                        </svg>
                      </button>
                    )}
                    {supplierOpen && !supplierId && suppliers.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-md border border-stone-200 bg-white shadow-lg max-h-44 overflow-y-auto">
                        {suppliers.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => { setSupplierId(s.id); setSupplierSearch(""); setSupplierOpen(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
                          >
                            {s.name}
                            {s.nif && <span className="ml-2 text-xs text-stone-400">{s.nif}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                    <a
                      href="/financial/suppliers"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-[#ED5C32] hover:underline"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                      </svg>
                      Cadastrar novo fornecedor
                    </a>
                  </div>
                )}

                {/* Cost center */}
                {showsCostCenter(subType) && (
                  <div className="space-y-2">
                    <div>
                      <label className={labelCls}>Grupo de custo *</label>
                      <select
                        value={groupId}
                        onChange={(e) => handleGroupChange(e.target.value)}
                        className={inputCls}
                        required
                      >
                        <option value="">Seleccionar grupo…</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Categoria *</label>
                      <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className={inputCls}
                        disabled={!groupId}
                        required
                      >
                        <option value="">{groupId ? "Seleccionar categoria…" : "Primeiro selecciona o grupo"}</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* VAT */}
                {showsVat(subType) && (
                  <div>
                    <label className={labelCls}>IVA</label>
                    <div className="flex gap-2 mb-2">
                      {([["included", "Inclui IVA"], ["excluded", "Não inclui IVA"], ["exempt", "Isento / N/A"]] as [VatMode, string][]).map(
                        ([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setVatMode(mode)}
                            className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                              vatMode === mode
                                ? "border-[#ED5C32] bg-[#FDF8F5] text-[#ED5C32]"
                                : "border-stone-200 text-stone-500 hover:border-stone-300"
                            }`}
                          >
                            {label}
                          </button>
                        )
                      )}
                    </div>
                    {vatMode !== "exempt" && (
                      <div className="flex gap-2">
                        {VAT_RATES.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setVatRate(r)}
                            className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
                              vatRate === r
                                ? "border-[#ED5C32] bg-[#FDF8F5] text-[#ED5C32]"
                                : "border-stone-200 text-stone-500 hover:border-stone-300"
                            }`}
                          >
                            {r}%
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Transfer target */}
                {showsTransferTarget(subType) && (
                  <div>
                    <label className={labelCls}>Conta de destino</label>
                    <input
                      type="text"
                      value={transferTarget}
                      onChange={(e) => setTransferTarget(e.target.value)}
                      placeholder="Ex: Conta poupança BCP IBAN PT50…"
                      className={inputCls}
                    />
                  </div>
                )}

                {/* Notes */}
                <div>
                  <label className={labelCls}>
                    Notas{requiresNotes(subType) ? " *" : " (opcional)"}
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    required={requiresNotes(subType)}
                    className={inputCls}
                    placeholder={requiresNotes(subType) ? "Motivo obrigatório" : "Opcional"}
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-[#F5C992]/40 px-6 py-4 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || uploading || !canSubmit}
              className="flex-1 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "A guardar…" : uploading ? "A carregar ficheiro…" : "Classificar"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

// ── Statement Detail ──────────────────────────────────────────────────────────

type MovementTab = "all" | "unresolved" | "suggestions" | "high_risk" | "partial";

function StatementDetail({
  statementId,
  onBack,
  onDelete,
}: {
  statementId: string;
  onBack: () => void;
  onDelete: () => void;
}) {
  const { api } = useBankStatementsModule();
  const qc = useQueryClient();
  const { toasts, show: showToast } = useToast();
  const [movTab, setMovTab] = useState<MovementTab>("all");
  const [classifying, setClassifying] = useState<BankMovementDTO | null>(null);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["bank-statement", statementId],
    queryFn: () => api.getStatement(statementId),
  });

  const updateBalancesMut = useMutation({
    mutationFn: ({ opening, closing }: { opening: number; closing: number }) =>
      api.updateStatementBalances(statementId, opening, closing),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bank-statement", statementId] });
      void qc.invalidateQueries({ queryKey: ["bank-statements"] });
    },
    onError: (e: Error) => alert(`Erro ao guardar saldos: ${e.message}`),
  });

  const applyRulesMut = useMutation({
    mutationFn: () => api.applyAutoRules(statementId),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["bank-statement", statementId] });
      void qc.invalidateQueries({ queryKey: ["bank-statements"] });
      alert(`Regras aplicadas: ${res.appliedCount} movimento(s) classificado(s). Progresso: ${res.reconciliationProgress}%`);
    },
    onError: (e: Error) => alert(`Erro: ${e.message}`),
  });

  const suggestMut = useMutation({
    mutationFn: () => api.suggestMatches(statementId),
    onSuccess: (suggestions) => {
      void qc.invalidateQueries({ queryKey: ["bank-statement", statementId] });
      alert(`${suggestions.length} sugestão(ões) gerada(s).`);
    },
    onError: (e: Error) => alert(`Erro: ${e.message}`),
  });

  const closeMut = useMutation({
    mutationFn: () => api.closeStatement(statementId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bank-statement", statementId] });
      void qc.invalidateQueries({ queryKey: ["bank-statements"] });
    },
    onError: (e: Error) => alert(`Não é possível fechar: ${e.message}`),
  });

  const classifyMut = useMutation({
    mutationFn: (args: { movementId: string; payload: ClassifyMovementPayload }) =>
      api.classifyMovement(args.movementId, args.payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bank-statement", statementId] });
      void qc.invalidateQueries({ queryKey: ["bank-statements"] });
      setClassifying(null);
      showToast("Movimento classificado com sucesso");
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });

  const reconcileMut = useMutation({
    mutationFn: (args: { movementId: string; entityLinks: Array<{ entityType: "invoice" | "payable_entry"; entityId: string; supplierId: string | null }> }) =>
      api.reconcileMovement(args.movementId, args.entityLinks),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bank-statement", statementId] });
      void qc.invalidateQueries({ queryKey: ["bank-statements"] });
      setClassifying(null);
      showToast("Movimento conciliado com sucesso");
    },
    onError: (e: Error) => showToast(e.message, "error"),
  });


  const filteredMovements = useMemo(() => {
    if (!detail) return [];
    switch (movTab) {
      case "unresolved":
        return detail.movements.filter((m) => !m.isResolved);
      case "suggestions":
        return detail.movements.filter((m) => m.reconciliationStatus === "sugestao");
      case "high_risk":
        return detail.movements.filter(
          (m) => m.riskLevel === "high" || m.riskLevel === "critical"
        );
      case "partial":
        return detail.movements.filter((m) => m.reconciliationStatus === "conciliado_parcial");
      default:
        return detail.movements;
    }
  }, [detail, movTab]);

  const unresolvedCount = detail?.movements.filter((m) => !m.isResolved).length ?? 0;
  const suggestionCount =
    detail?.movements.filter((m) => m.reconciliationStatus === "sugestao").length ?? 0;
  const highRiskCount =
    detail?.movements.filter(
      (m) => (m.riskLevel === "high" || m.riskLevel === "critical") && !m.isResolved
    ).length ?? 0;
  const partialCount =
    detail?.movements.filter((m) => m.reconciliationStatus === "conciliado_parcial").length ?? 0;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-stone-400">A carregar extrato…</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-500">Extrato não encontrado.</p>
      </div>
    );
  }

  const isClosed = detail.status === "closed";

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} />
      {/* Breadcrumb / back */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="text-sm text-[#ED5C32] hover:underline flex items-center gap-1"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Extratos
        </button>
        <span className="text-stone-300">/</span>
        <span className="text-sm font-medium text-stone-700">{detail.bankName}</span>
        <span className="text-stone-300">/</span>
        <span className="text-sm text-stone-500">{detail.accountNumber}</span>
      </div>

      {/* Header info */}
      <div className="rounded-xl border border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-stone-900">{detail.bankName}</h2>
              <StatementStatusBadge status={detail.status} />
            </div>
            <p className="mt-1 text-sm text-stone-500">
              {detail.accountNumber} · {formatDate(detail.periodStart)} – {formatDate(detail.periodEnd)}
            </p>
            {detail.sourceFileName && (
              <p className="mt-0.5 text-xs text-stone-400">Ficheiro: {detail.sourceFileName}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => applyRulesMut.mutate()}
              disabled={applyRulesMut.isPending || isClosed}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40"
            >
              {applyRulesMut.isPending ? "A aplicar…" : "Aplicar regras"}
            </button>
            <button
              onClick={() => suggestMut.mutate()}
              disabled={suggestMut.isPending || isClosed}
              className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40"
            >
              {suggestMut.isPending ? "A sugerir…" : "Sugerir conciliações"}
            </button>
            {!isClosed && (
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Fechar a conciliação? Esta ação valida que o saldo fecha e não há pendências críticas."
                    )
                  ) {
                    closeMut.mutate();
                  }
                }}
                disabled={closeMut.isPending}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {closeMut.isPending ? "A fechar…" : "Fechar conciliação"}
              </button>
            )}
            <button
              onClick={onDelete}
              title="Eliminar extrato"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
            >
              Eliminar extrato
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-stone-500">Progresso da conciliação</span>
            <span className="text-xs text-stone-400">
              {detail.importedMovementsCount - unresolvedCount} / {detail.importedMovementsCount} movimentos resolvidos
            </span>
          </div>
          <ProgressBar value={detail.reconciliationProgress} />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <EditableBalanceCard
          label="Saldo inicial"
          valueCents={detail.openingBalance}
          disabled={isClosed || updateBalancesMut.isPending}
          onSave={(v) => updateBalancesMut.mutate({ opening: v, closing: detail.closingBalance })}
        />
        <EditableBalanceCard
          label="Saldo extrato"
          valueCents={detail.closingBalance}
          disabled={isClosed || updateBalancesMut.isPending}
          onSave={(v) => updateBalancesMut.mutate({ opening: detail.openingBalance, closing: v })}
        />
        <KpiCard
          label="Saldo calculado"
          value={fromCents(detail.calculatedClosingBalance)}
          valueClass={diffClass(detail.balanceDifference)}
        />
        <KpiCard
          label="Diferença de saldo"
          value={fromCents(detail.balanceDifference)}
          sub={detail.balanceDifference === 0 ? "Saldo fecha ✓" : "Saldo não fecha"}
          valueClass={diffClass(detail.balanceDifference)}
        />
      </div>

      {/* Movements */}
      <div className="rounded-xl border border-[#F5C992]/40 bg-white overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-[#F5C992]/40 px-4 pt-1">
          {(
            [
              { key: "all" as MovementTab, label: "Todos", count: detail.importedMovementsCount },
              { key: "unresolved" as MovementTab, label: "Não resolvidos", count: unresolvedCount },
              { key: "suggestions" as MovementTab, label: "Sugestões", count: suggestionCount },
              { key: "high_risk" as MovementTab, label: "Alto risco", count: highRiskCount },
              { key: "partial" as MovementTab, label: "Parciais", count: partialCount },
            ] as { key: MovementTab; label: string; count: number }[]
          ).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setMovTab(key)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                movTab === key
                  ? "border-[#ED5C32] text-[#ED5C32]"
                  : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              {label}
              {count > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    movTab === key
                      ? "bg-[#ED5C32]/10 text-[#ED5C32]"
                      : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        {filteredMovements.length === 0 ? (
          <div className="py-12 text-center text-sm text-stone-400">Nenhum movimento nesta categoria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-stone-50/60">
                <tr>
                  {(
                    [
                      { label: "Data",       align: "left"  },
                      { label: "Descrição",  align: "left"  },
                      { label: "Tipo",       align: "left"  },
                      { label: "Valor",      align: "right" },
                      { label: "Saldo após", align: "right" },
                      { label: "Estado",     align: "left"  },
                      { label: "Ações",      align: "center" },
                    ] as { label: string; align: "left" | "right" | "center" }[]
                  ).map(({ label, align }) => (
                    <th
                      key={label}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-stone-500 ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5C992]/30">
                {filteredMovements.map((m) => (
                  <tr
                    key={m.id}
                    className={`hover:bg-[#FDF8F5] ${
                      (m.riskLevel === "high" || m.riskLevel === "critical") && !m.isResolved
                        ? "bg-red-50/20"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-xs text-stone-500 whitespace-nowrap">
                      {formatDate(m.bookingDate)}
                    </td>
                    <td className="px-4 py-3 max-w-[240px]">
                      <span className="block truncate text-stone-800 font-medium">{m.description}</span>
                      {m.notes && (
                        <span className="text-xs text-stone-400 truncate block">{m.notes}</span>
                      )}
                      {m.matchedEntityId && m.reconciliationStatus === "sugestao" && (
                        <span className="text-xs text-blue-500 truncate block">
                          Sugestão: {m.matchedEntityId.slice(0, 8)}…{" "}
                          {m.confidenceScore != null && `(${Math.round(m.confidenceScore * 100)}%)`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium ${
                          m.movementType === "debit" ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {m.movementType === "debit" ? "Débito" : "Crédito"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                      <span
                        className={m.movementType === "debit" ? "text-red-700" : "text-emerald-700"}
                      >
                        {m.movementType === "debit" ? "−" : "+"}
                        {fromCents(m.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-stone-500 whitespace-nowrap">
                      {fromCents(m.balanceAfter)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ReconciliationBadge
                          status={
                            m.movementType === "credit" && m.reconciliationStatus === "pendente_de_documento"
                              ? "conciliado_sem_fatura"
                              : m.reconciliationStatus
                          }
                        />
                        {m.reconciliationStatus === "conciliado_parcial" && m.reconciliationAmountDiff != null && (
                          <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-yellow-100 text-yellow-800">
                            Δ {fromCents(Math.abs(m.reconciliationAmountDiff))}
                          </span>
                        )}
                        {m.movementType === "debit"
                          ? <RiskBadge level={m.riskLevel} />
                          : <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-stone-100 text-stone-400">Sem Risco</span>
                        }
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {m.movementType === "debit" && (
                        m.reconciliationStatus === "sugestao" ? (
                          <button
                            onClick={() => setClassifying(m)}
                            disabled={isClosed}
                            className="rounded-md px-2 py-1 text-xs font-medium text-[#ED5C32] hover:bg-orange-50 disabled:opacity-40"
                          >
                            Classificar
                          </button>
                        ) : !m.isResolved ? (
                          <button
                            onClick={() => setClassifying(m)}
                            disabled={isClosed}
                            className="rounded-md px-2 py-1 text-xs font-medium text-[#ED5C32] hover:bg-orange-50 disabled:opacity-40"
                          >
                            Classificar
                          </button>
                        ) : (
                          <button
                            onClick={() => setClassifying(m)}
                            disabled={isClosed}
                            className="rounded-md px-2 py-1 text-xs font-medium text-stone-400 hover:bg-stone-50 disabled:opacity-40"
                          >
                            Editar
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Classify drawer */}
      {classifying && (
        <ClassifyDrawer
          movement={classifying}
          onClose={() => setClassifying(null)}
          onSave={(payload) =>
            classifyMut.mutate({ movementId: classifying.id, payload })
          }
          onReconcile={(entityLinks) =>
            reconcileMut.mutate({ movementId: classifying.id, entityLinks })
          }
          saving={classifyMut.isPending || reconcileMut.isPending}
        />
      )}
    </div>
  );
}

// ── Statements List ───────────────────────────────────────────────────────────

function StatementsList({
  onSelect,
  onImport,
  onDelete,
}: {
  onSelect: (id: string) => void;
  onImport: () => void;
  onDelete: (id: string) => void;
}) {
  const { api } = useBankStatementsModule();
  const { data: statements = [], isLoading } = useQuery({
    queryKey: ["bank-statements"],
    queryFn: () => api.listStatements(),
  });

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="py-16 text-center text-sm text-stone-400">A carregar extratos…</div>
      ) : statements.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-stone-400 mb-4">Nenhum extrato importado ainda.</p>
          <button
            onClick={onImport}
            className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Importar primeiro extrato
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {statements.map((s) => (
            <StatementCard
              key={s.id}
              statement={s}
              onClick={() => onSelect(s.id)}
              onDelete={() => onDelete(s.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatementCard({
  statement: s,
  onClick,
  onDelete,
}: {
  statement: BankStatementSummaryDTO;
  onClick: () => void;
  onDelete: () => void;
}) {
  const diffOk = s.balanceDifference === 0;
  return (
    <div className="relative rounded-xl border border-[#F5C992]/40 bg-white shadow-sm hover:shadow-md hover:border-[#ED5C32]/30 transition-all">
      <button
        onClick={onClick}
        className="text-left w-full p-4"
      >
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="font-semibold text-stone-800">{s.bankName}</p>
            <p className="text-xs text-stone-400 mt-0.5">{s.accountNumber}</p>
          </div>
          <StatementStatusBadge status={s.status} />
        </div>

        <p className="text-xs text-stone-500 mb-3">
          {formatDate(s.periodStart)} – {formatDate(s.periodEnd)}
        </p>

        <ProgressBar value={s.reconciliationProgress} />

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-stone-400">Movimentos</span>
            <p className="font-semibold text-stone-700">{s.importedMovementsCount}</p>
          </div>
          <div>
            <span className="text-stone-400">Diferença</span>
            <p className={`font-semibold ${diffOk ? "text-emerald-600" : "text-red-600"}`}>
              {fromCents(s.balanceDifference)}
            </p>
          </div>
        </div>
      </button>

      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Eliminar extrato"
        className="absolute top-3 right-3 rounded-md p-1.5 text-stone-300 hover:bg-red-50 hover:text-red-500 transition-colors"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────────

export function BankStatementsView() {
  const { api } = useBankStatementsModule();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);

  const importMut = useMutation({
    mutationFn: (fd: FormData) => api.importStatement(fd),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["bank-statements"] });
      setShowImport(false);
      setSelectedId(result.id);
    },
    onError: (e: Error) => alert(`Erro ao importar: ${e.message}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteStatement(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["bank-statements"] });
      setSelectedId(null);
    },
    onError: (e: Error) => alert(`Erro ao eliminar: ${e.message}`),
  });

  function handleDelete(id: string) {
    if (!window.confirm("Tens a certeza que queres eliminar este extrato e todos os seus movimentos? Esta ação não pode ser desfeita.")) return;
    deleteMut.mutate(id);
  }

  return (
    <div className="min-h-screen bg-[#FAF6F3]">
      {/* Header */}
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Conciliação Bancária</h1>
            <p className="mt-0.5 text-sm text-stone-500">
              {selectedId ? "Espelho do banco — movimentos e conciliação" : "Extratos importados"}
            </p>
          </div>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Importar extrato
          </button>
        </div>
      </div>

      <div className="p-6">
        {selectedId ? (
          <StatementDetail
            statementId={selectedId}
            onBack={() => setSelectedId(null)}
            onDelete={() => handleDelete(selectedId)}
          />
        ) : (
          <StatementsList
            onSelect={setSelectedId}
            onImport={() => setShowImport(true)}
            onDelete={handleDelete}
          />
        )}
      </div>

      <ImportModal
        open={showImport}
        saving={importMut.isPending}
        onClose={() => setShowImport(false)}
        onSubmit={(fd) => importMut.mutate(fd)}
      />

      <PageFooter />
    </div>
  );
}
