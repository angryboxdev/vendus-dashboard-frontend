import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useInvoicesModule } from "../../invoices.module.tsx";
import { useFinancialBaseModule } from "../../../financial-base/financial-base.module.tsx";
import type {
  InvoiceDTO,
  InvoiceImportResultDTO,
  ConfirmImportedInvoicePayload,
  CreateInvoiceLinePayload,
  SupplierMatchDTO,
  NewSupplierPayload,
} from "../../domain/entities/invoice.ts";
import { VALIDATION_ISSUE_LABELS } from "../../domain/entities/invoice.ts";
import type { CostCenterGroup, CostCenterCategory } from "../../../financial-base/domain/entities/cost-center.ts";

// ── helpers ──────────────────────────────────────────────────────────────────

function toCents(s: string): number {
  return Math.round(parseFloat(s.replace(",", ".")) * 100);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── ConfidenceBadge ──────────────────────────────────────────────────────────

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 85 ? "bg-emerald-50 text-emerald-700" :
    pct >= 70 ? "bg-amber-50 text-amber-700" :
    "bg-red-50 text-red-700";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      IA {pct}%
    </span>
  );
}

// ── CostCenterCascadeSelect ───────────────────────────────────────────────────

interface CostCenterCascadeSelectProps {
  groups: CostCenterGroup[];
  categories: CostCenterCategory[];
  groupId: string | null;
  categoryId: string | null;
  onChange(groupId: string | null, categoryId: string | null): void;
  inputCls: string;
}

function CostCenterCascadeSelect({
  groups,
  categories,
  groupId,
  categoryId,
  onChange,
  inputCls,
}: CostCenterCascadeSelectProps) {
  const activeGroups = groups.filter((g) => g.isActive);
  const filteredCats = categories.filter(
    (c) => c.isActive && (groupId === null || c.groupId === groupId),
  );

  function handleGroupChange(newGroupId: string) {
    const gId = newGroupId || null;
    // clear category if it no longer belongs to the new group
    const currentCat = categories.find((c) => c.id === categoryId);
    const catStillValid = currentCat && (gId === null || currentCat.groupId === gId);
    onChange(gId, catStillValid ? categoryId : null);
  }

  function handleCategoryChange(newCatId: string) {
    const cId = newCatId || null;
    if (cId) {
      const cat = categories.find((c) => c.id === cId);
      // auto-populate group when category is selected
      onChange(cat?.groupId ?? groupId, cId);
    } else {
      onChange(groupId, null);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <select
        value={groupId ?? ""}
        onChange={(e) => handleGroupChange(e.target.value)}
        className={inputCls}
      >
        <option value="">— Grupo CC —</option>
        {activeGroups.map((g) => (
          <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
        ))}
      </select>
      <select
        value={categoryId ?? ""}
        onChange={(e) => handleCategoryChange(e.target.value)}
        className={inputCls}
      >
        <option value="">— Subcategoria —</option>
        {filteredCats.map((c) => (
          <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
        ))}
      </select>
    </div>
  );
}

// ── SupplierPanel ─────────────────────────────────────────────────────────────

interface SupplierPanelProps {
  match: SupplierMatchDTO | null;
  currentSupplierId: string | null;
  currentNewSupplier: NewSupplierPayload | null;
  suppliers: {
    id: string;
    name: string;
    nif?: string | null;
    defaultCostCenterGroupId?: string | null;
    defaultCostCenterCategoryId?: string | null;
  }[];
  groups: CostCenterGroup[];
  categories: CostCenterCategory[];
  defaultName: string;
  defaultNif: string;
  onLink(
    supplierId: string | null,
    supplierName?: string,
    supplierNif?: string | null,
    defaultCcGroupId?: string | null,
    defaultCcCategoryId?: string | null,
  ): void;
  onNewSupplier(data: NewSupplierPayload | null): void;
}

function SupplierPanel({
  match,
  currentSupplierId,
  currentNewSupplier,
  suppliers,
  groups,
  categories,
  defaultName,
  defaultNif,
  onLink,
  onNewSupplier,
}: SupplierPanelProps) {
  const [showLink, setShowLink] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  // Create form state — pre-filled from invoice extraction
  const [createName, setCreateName] = useState(defaultName);
  const [createNif, setCreateNif] = useState(defaultNif);
  const [createEmail, setCreateEmail] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createAddress, setCreateAddress] = useState("");
  const [createIban, setCreateIban] = useState("");
  const [createPaymentDays, setCreatePaymentDays] = useState("");
  const [createGroupId, setCreateGroupId] = useState<string | null>(null);
  const [createCategoryId, setCreateCategoryId] = useState<string | null>(null);

  const inputCls = "w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-xs focus:border-[#ED5C32] focus:outline-none";

  // Resolve linked supplier — either auto-matched by AI or manually selected
  const linkedSupplier = (() => {
    if (!currentSupplierId) return null;
    if (match?.id === currentSupplierId)
      return { name: match.name, nif: match.nif, financialType: match.defaultFinancialType };
    const found = suppliers.find((s) => s.id === currentSupplierId);
    return found ? { name: found.name, nif: found.nif ?? null, financialType: null } : null;
  })();

  if (linkedSupplier) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            <p className="text-xs font-semibold text-emerald-700">
              {match?.id === currentSupplierId ? "Fornecedor encontrado" : "Fornecedor vinculado"}
            </p>
          </div>
          <button onClick={() => onLink(null)} className="text-[10px] text-stone-400 hover:text-stone-600 underline">
            alterar
          </button>
        </div>
        <p className="text-sm font-medium text-stone-800">{linkedSupplier.name}</p>
        {linkedSupplier.nif && <p className="text-xs text-stone-500">NIF {linkedSupplier.nif}</p>}
        {linkedSupplier.financialType && (
          <p className="text-xs text-stone-400">Tipo: {linkedSupplier.financialType} · Classificação padrão aplicada</p>
        )}
      </div>
    );
  }

  if (currentNewSupplier) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            <p className="text-xs font-semibold text-emerald-700">Novo fornecedor a criar</p>
          </div>
          <button onClick={() => onNewSupplier(null)} className="text-[10px] text-stone-400 hover:text-stone-600 underline">
            alterar
          </button>
        </div>
        <p className="text-sm font-medium text-stone-800">{currentNewSupplier.name}</p>
        {currentNewSupplier.nif && <p className="text-xs text-stone-500">NIF {currentNewSupplier.nif}</p>}
        {currentNewSupplier.iban && <p className="text-xs text-stone-400">IBAN {currentNewSupplier.iban}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <svg className="h-4 w-4 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        <p className="text-xs font-semibold text-amber-700">Fornecedor não encontrado</p>
      </div>
      <p className="text-xs text-stone-600">
        O NIF extraído não corresponde a nenhum fornecedor cadastrado.
      </p>

      {showLink && (
        <div className="space-y-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className={inputCls}
          >
            <option value="">— selecionar fornecedor —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const sup = suppliers.find((s) => s.id === selectedId);
                onLink(
                  selectedId || null,
                  sup?.name,
                  sup?.nif,
                  sup?.defaultCostCenterGroupId ?? null,
                  sup?.defaultCostCenterCategoryId ?? null,
                );
                setShowLink(false);
              }}
              disabled={!selectedId}
              className="rounded-md bg-[#ED5C32] px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              Vincular
            </button>
            <button
              onClick={() => setShowLink(false)}
              className="rounded-md px-3 py-1 text-xs text-stone-500 hover:bg-stone-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="space-y-2 rounded-lg border border-stone-200 bg-white p-3">
          <p className="text-xs font-medium text-stone-600">Dados do novo fornecedor</p>
          <input
            type="text"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Nome *"
            className={inputCls}
          />
          <input
            type="text"
            value={createNif}
            onChange={(e) => setCreateNif(e.target.value)}
            placeholder="NIF"
            className={inputCls}
          />
          <input
            type="email"
            value={createEmail}
            onChange={(e) => setCreateEmail(e.target.value)}
            placeholder="Email"
            className={inputCls}
          />
          <input
            type="text"
            value={createPhone}
            onChange={(e) => setCreatePhone(e.target.value)}
            placeholder="Telefone"
            className={inputCls}
          />
          <input
            type="text"
            value={createAddress}
            onChange={(e) => setCreateAddress(e.target.value)}
            placeholder="Morada"
            className={inputCls}
          />
          <input
            type="text"
            value={createIban}
            onChange={(e) => setCreateIban(e.target.value)}
            placeholder="IBAN"
            className={inputCls}
          />
          <input
            type="number"
            value={createPaymentDays}
            onChange={(e) => setCreatePaymentDays(e.target.value)}
            placeholder="Prazo pagamento (dias)"
            min="0"
            className={inputCls}
          />
          {groups.length > 0 && (
            <>
              <p className="text-[11px] font-medium text-stone-400 pt-1">Centro de custo padrão</p>
              <CostCenterCascadeSelect
                groups={groups}
                categories={categories}
                groupId={createGroupId}
                categoryId={createCategoryId}
                onChange={(gId, cId) => { setCreateGroupId(gId); setCreateCategoryId(cId); }}
                inputCls={inputCls}
              />
            </>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-500 hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (!createName.trim()) return;
                onNewSupplier({
                  name: createName.trim(),
                  nif: createNif.trim() || null,
                  email: createEmail.trim() || null,
                  phone: createPhone.trim() || null,
                  address: createAddress.trim() || null,
                  iban: createIban.trim() || null,
                  defaultCostCenterGroupId: createGroupId || null,
                  defaultCostCenterCategoryId: createCategoryId || null,
                  paymentTermsDays: createPaymentDays ? parseInt(createPaymentDays) : null,
                });
                setShowCreate(false);
              }}
              disabled={!createName.trim()}
              className="flex-1 rounded-md bg-[#ED5C32] px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}

      {!showLink && !showCreate && (
        <div className="space-y-1.5">
          <button
            onClick={() => setShowLink(true)}
            className="w-full rounded-md border border-stone-200 bg-white px-3 py-1.5 text-left text-xs text-stone-700 hover:bg-stone-50"
          >
            Vincular a fornecedor existente
          </button>
          <button
            onClick={() => {
              setCreateName(defaultName);
              setCreateNif(defaultNif);
              setShowCreate(true);
            }}
            className="w-full rounded-md border border-stone-200 bg-white px-3 py-1.5 text-left text-xs text-stone-700 hover:bg-stone-50"
          >
            Criar novo fornecedor
          </button>
          <button
            onClick={() => onLink(null)}
            className="w-full rounded-md border border-stone-200 bg-white px-3 py-1.5 text-left text-xs text-stone-500 hover:bg-stone-50"
          >
            Continuar sem cadastrar
          </button>
        </div>
      )}
    </div>
  );
}

// ── ValidationIssues ─────────────────────────────────────────────────────────

function ValidationIssues({ issues }: { issues: string[] }) {
  if (issues.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
      <p className="text-xs font-semibold text-amber-700">Pendências a resolver</p>
      <ul className="space-y-0.5">
        {issues.map((issue) => (
          <li key={issue} className="flex items-start gap-1.5 text-xs text-amber-700">
            <span className="mt-0.5 shrink-0">·</span>
            {VALIDATION_ISSUE_LABELS[issue] ?? issue}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── DraftLine type ────────────────────────────────────────────────────────────

interface DraftLine {
  key: string;
  description: string;
  quantity: string;
  vatRate: string;
  totalWithVat: string; // euros as decimal string
}

function newDraftLine(): DraftLine {
  return { key: crypto.randomUUID(), description: "", quantity: "1", vatRate: "23", totalWithVat: "" };
}

function draftLineToPayload(l: DraftLine): CreateInvoiceLinePayload {
  const total = Math.round(parseFloat(l.totalWithVat || "0") * 100);
  const rate = parseFloat(l.vatRate || "0");
  const qty = parseFloat(l.quantity || "1") || 1;
  const totalWithoutVat = Math.round(total / (1 + rate / 100));
  const vatAmount = total - totalWithoutVat;
  return {
    description: l.description.trim(),
    quantity: qty,
    unitCostWithoutVat: Math.round(totalWithoutVat / qty),
    vatRate: rate,
    vatAmount,
    totalWithVat: total,
  };
}

// ── EditableLinesSection ──────────────────────────────────────────────────────

interface EditableLinesSectionProps {
  lines: DraftLine[];
  onChange(lines: DraftLine[]): void;
}

function EditableLinesSection({ lines, onChange }: EditableLinesSectionProps) {
  const inputCls = "w-full rounded border border-stone-200 bg-white px-1.5 py-1 text-xs focus:border-[#ED5C32] focus:outline-none";

  function updateLine(key: string, field: keyof DraftLine, value: string) {
    onChange(lines.map((l) => l.key === key ? { ...l, [field]: value } : l));
  }

  function deleteLine(key: string) {
    onChange(lines.filter((l) => l.key !== key));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-500">Linhas da fatura</p>
        <span className="text-xs text-stone-400">{lines.length} linha{lines.length !== 1 ? "s" : ""}</span>
      </div>

      {lines.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-stone-200">
          <table className="min-w-full text-xs">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-2 py-2 text-left font-medium text-stone-500">Descrição</th>
                <th className="w-14 px-2 py-2 text-left font-medium text-stone-500">Qtd</th>
                <th className="w-16 px-2 py-2 text-left font-medium text-stone-500">IVA %</th>
                <th className="w-24 px-2 py-2 text-left font-medium text-stone-500">Total c/ IVA</th>
                <th className="w-8 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {lines.map((l) => (
                <tr key={l.key}>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={l.description}
                      onChange={(e) => updateLine(l.key, "description", e.target.value)}
                      placeholder="Descrição"
                      className={inputCls}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={l.quantity}
                      onChange={(e) => updateLine(l.key, "quantity", e.target.value)}
                      className={inputCls}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      value={l.vatRate}
                      onChange={(e) => updateLine(l.key, "vatRate", e.target.value)}
                      className={inputCls}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.totalWithVat}
                      onChange={(e) => updateLine(l.key, "totalWithVat", e.target.value)}
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => deleteLine(l.key)}
                      className="text-stone-300 hover:text-red-500"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        onClick={() => onChange([...lines, newDraftLine()])}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-300 py-2 text-xs font-medium text-stone-500 hover:border-[#ED5C32] hover:text-[#ED5C32]"
      >
        <span className="text-base leading-none">+</span> Adicionar linha
      </button>
    </div>
  );
}

// ── ReviewImportedInvoiceDrawer ───────────────────────────────────────────────

interface Props {
  importResult: InvoiceImportResultDTO;
  onClose(): void;
  onConfirmed(invoice: InvoiceDTO): void;
}

export function ReviewImportedInvoiceDrawer({ importResult, onClose, onConfirmed }: Props) {
  const { api } = useInvoicesModule();
  const fbModule = useFinancialBaseModule();
  const qc = useQueryClient();

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => fbModule.api.listSuppliers(),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["cost-center-groups"],
    queryFn: () => fbModule.api.listCostCenterGroups(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["cost-center-categories"],
    queryFn: () => fbModule.api.listCostCenterCategories(),
  });

  const inv = importResult.invoice;

  // Editable fields — initialised from AI extraction
  const [supplierName, setSupplierName] = useState(inv.supplierName);
  const [supplierNif, setSupplierNif] = useState(inv.supplierNifSnapshot ?? "");
  const [supplierId, setSupplierId] = useState<string | null>(inv.supplierId);
  const [newSupplierData, setNewSupplierData] = useState<NewSupplierPayload | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState(inv.invoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(inv.invoiceDate ?? todayStr());
  const [dueDate, setDueDate] = useState(inv.dueDate ?? "");
  const [subtotalStr, setSubtotalStr] = useState((inv.subtotalWithoutVat / 100).toFixed(2));
  const [vatStr, setVatStr] = useState((inv.totalVat / 100).toFixed(2));
  const [totalStr, setTotalStr] = useState((inv.totalWithVat / 100).toFixed(2));
  const [notes, setNotes] = useState(inv.notes ?? "");
  const [costCenterGroupId, setCostCenterGroupId] = useState<string | null>(inv.costCenterGroupId ?? null);
  const [costCenterCategoryId, setCostCenterCategoryId] = useState<string | null>(inv.costCenterCategoryId ?? null);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [paidAt, setPaidAt] = useState(inv.invoiceDate ?? todayStr());
  const [isDirectDebit, setIsDirectDebit] = useState(false);
  const [directDebitDate, setDirectDebitDate] = useState(inv.dueDate ?? "");
  const [lines, setLines] = useState<DraftLine[]>(() =>
    importResult.extractedLines.map((l, i) => ({
      key: String(i),
      description: l.description,
      quantity: l.quantity != null ? String(l.quantity) : "1",
      vatRate: l.vatRate != null ? String(l.vatRate) : "23",
      totalWithVat: l.totalWithVat != null ? (l.totalWithVat / 100).toFixed(2) : "",
    }))
  );

  function handleLink(
    id: string | null,
    name?: string,
    nif?: string | null,
    defaultCcGroupId?: string | null,
    defaultCcCategoryId?: string | null,
  ) {
    setSupplierId(id);
    setNewSupplierData(null);
    if (name) setSupplierName(name);
    if (nif !== undefined) setSupplierNif(nif ?? "");
    if (defaultCcGroupId !== undefined) setCostCenterGroupId(defaultCcGroupId);
    if (defaultCcCategoryId !== undefined) setCostCenterCategoryId(defaultCcCategoryId);
  }

  function handleNewSupplier(data: NewSupplierPayload | null) {
    setNewSupplierData(data);
    if (data) {
      setSupplierId(null);
      setSupplierName(data.name);
      if (data.nif !== undefined) setSupplierNif(data.nif ?? "");
    }
  }

  const confirmMutation = useMutation({
    mutationFn: (payload: ConfirmImportedInvoicePayload) =>
      api.confirmImportedInvoice(inv.id, payload),
    onSuccess: (confirmed) => {
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      void qc.invalidateQueries({ queryKey: ["invoice-alerts"] });
      onConfirmed(confirmed);
    },
  });

  function buildPayload(saveAsPayable: boolean): ConfirmImportedInvoicePayload {
    const payload: ConfirmImportedInvoicePayload = {
      supplierName: supplierName.trim(),
      supplierNifSnapshot: supplierNif.trim() || null,
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate,
      dueDate: isDirectDebit ? null : (dueDate || null),
      isDirectDebit,
      directDebitDate: isDirectDebit ? (directDebitDate || null) : null,
      subtotalWithoutVat: toCents(subtotalStr),
      totalVat: toCents(vatStr),
      totalWithVat: toCents(totalStr),
      notes: notes.trim() || null,
      costCenterGroupId: costCenterGroupId || null,
      costCenterCategoryId: costCenterCategoryId || null,
      saveAsPayable: (alreadyPaid || isDirectDebit) ? false : saveAsPayable,
      markAsPaid: alreadyPaid,
      paidAt: alreadyPaid ? paidAt : undefined,
      lines: lines.filter((l) => l.description.trim()).map(draftLineToPayload),
    };
    if (newSupplierData) {
      payload.newSupplier = newSupplierData;
    } else {
      payload.supplierId = supplierId ?? null;
    }
    return payload;
  }

  const saving = confirmMutation.isPending;
  const confirmError = confirmMutation.error instanceof Error
    ? confirmMutation.error.message
    : null;

  const labelCls = "block text-xs font-medium text-stone-500 mb-1";
  const inputCls =
    "w-full rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-sm focus:border-[#ED5C32] focus:outline-none";
  const inputSmCls =
    "w-full rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs focus:border-[#ED5C32] focus:outline-none";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-end bg-black/30">
      <div className="flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 shrink-0 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-base font-semibold text-stone-900">Revisar fatura importada</h2>
              <p className="mt-0.5 text-xs text-stone-500">
                Verifique os dados e corrija se necessário antes de guardar.
              </p>
            </div>
            {inv.aiConfidence != null && (
              <ConfidenceBadge value={inv.aiConfidence} />
            )}
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 disabled:opacity-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* body */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6 md:flex-row md:gap-6">
          {/* Left — editable form */}
          <div className="flex-1 space-y-5 min-w-0 md:order-first">
            {/* Validation issues */}
            <ValidationIssues issues={importResult.validationIssues.filter((issue) => {
              if (issue === "no_supplier_match" && (supplierId !== null || newSupplierData !== null)) return false;
              if (issue === "no_due_date" && (dueDate !== "" || alreadyPaid || isDirectDebit)) return false;
              return true;
            })} />

            {/* Fornecedor */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Fornecedor</p>
              <div>
                <label className={labelCls}>Nome do fornecedor</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>NIF</label>
                <input
                  type="text"
                  value={supplierNif}
                  onChange={(e) => setSupplierNif(e.target.value)}
                  className={inputCls}
                  placeholder="Opcional"
                />
              </div>
            </div>

            {/* Dados da fatura */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Dados da fatura</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Nº da fatura</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className={inputCls}
                    placeholder="Ex: MKR-2026-001"
                  />
                </div>
                <div>
                  <label className={labelCls}>Data de emissão</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
                {!isDirectDebit && (
                  <div>
                    <label className={labelCls}>Data de vencimento</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      disabled={alreadyPaid}
                      className={`${inputCls} disabled:bg-stone-50 disabled:text-stone-400`}
                    />
                  </div>
                )}
                {isDirectDebit && (
                  <div>
                    <label className={labelCls}>Data de débito</label>
                    <input
                      type="date"
                      value={directDebitDate}
                      onChange={(e) => setDirectDebitDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
                <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={alreadyPaid}
                    onChange={(e) => {
                      setAlreadyPaid(e.target.checked);
                      if (e.target.checked) {
                        setIsDirectDebit(false);
                        setDueDate("");
                        setPaidAt(invoiceDate || todayStr());
                      }
                    }}
                    className="h-4 w-4 rounded border-stone-300 text-[#ED5C32] focus:ring-[#ED5C32]"
                  />
                  Fatura já paga
                </label>
                <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isDirectDebit}
                    onChange={(e) => {
                      setIsDirectDebit(e.target.checked);
                      if (e.target.checked) {
                        setAlreadyPaid(false);
                        setDirectDebitDate(dueDate || "");
                      }
                    }}
                    className="h-4 w-4 rounded border-stone-300 text-[#ED5C32] focus:ring-[#ED5C32]"
                  />
                  Débito direto
                </label>
              </div>
              {alreadyPaid && (
                <div>
                  <label className={labelCls}>Data de pagamento</label>
                  <input
                    type="date"
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                    className={inputCls}
                  />
                </div>
              )}
            </div>

            {/* Valores */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Valores</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>Subtotal s/ IVA (€)</label>
                  <input type="number" min="0" step="0.01" value={subtotalStr} onChange={(e) => setSubtotalStr(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>IVA (€)</label>
                  <input type="number" min="0" step="0.01" value={vatStr} onChange={(e) => setVatStr(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Total c/ IVA (€)</label>
                  <input type="number" min="0" step="0.01" value={totalStr} onChange={(e) => setTotalStr(e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Notas */}
            <div>
              <label className={labelCls}>Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className={inputCls}
                placeholder="Opcional"
              />
            </div>

            {/* Centro de custo da fatura */}
            {groups.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Centro de custo <span className="normal-case font-normal text-stone-400">(propaga para todas as linhas)</span>
                </p>
                <CostCenterCascadeSelect
                  groups={groups as CostCenterGroup[]}
                  categories={categories as CostCenterCategory[]}
                  groupId={costCenterGroupId}
                  categoryId={costCenterCategoryId}
                  onChange={(gId, cId) => { setCostCenterGroupId(gId); setCostCenterCategoryId(cId); }}
                  inputCls={inputSmCls}
                />
              </div>
            )}

            {/* Editable lines */}
            <EditableLinesSection lines={lines} onChange={setLines} />

            {/* Attachment link */}
            {inv.attachmentUrl && (
              <a
                href={inv.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-[#ED5C32] hover:underline"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M15.621 4.379a3 3 0 00-4.242 0l-7 7a3 3 0 004.241 4.243h.001l.497-.5a.75.75 0 011.064 1.057l-.498.501-.002.002a4.5 4.5 0 01-6.364-6.364l7-7a4.5 4.5 0 016.368 6.36l-3.455 3.553A2.625 2.625 0 119.52 9.52l3.45-3.451a.75.75 0 111.061 1.06l-3.45 3.451a1.125 1.125 0 001.587 1.595l3.454-3.553a3 3 0 000-4.242z" clipRule="evenodd" />
                </svg>
                Ver documento original
              </a>
            )}
          </div>

          {/* Right — supplier + status */}
          <div className="w-full space-y-4 md:order-last md:w-64 md:shrink-0">
            <SupplierPanel
              match={importResult.supplierMatch}
              currentSupplierId={supplierId}
              currentNewSupplier={newSupplierData}
              suppliers={suppliers}
              groups={groups as CostCenterGroup[]}
              categories={categories as CostCenterCategory[]}
              defaultName={supplierName}
              defaultNif={supplierNif}
              onLink={handleLink}
              onNewSupplier={handleNewSupplier}
            />

            {/* Source info */}
            <div className="rounded-xl border border-stone-100 bg-stone-50 p-4 space-y-1">
              <p className="text-xs font-medium text-stone-400">Origem</p>
              <p className="text-xs text-stone-600">
                {inv.source === "pdf_import" ? "Importação PDF" : "Importação Imagem"}
              </p>
              <p className="text-xs text-stone-400">
                {new Date(inv.createdAt).toLocaleString("pt-PT")}
              </p>
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="shrink-0 border-t border-stone-100 px-4 py-3 sm:px-6 sm:py-4">
          {confirmError && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{confirmError}</p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-md px-4 py-2 text-center text-sm text-stone-500 hover:bg-stone-100 disabled:opacity-50 sm:text-left"
            >
              Cancelar
            </button>
            <div className="flex flex-col gap-2 sm:flex-row">
              {alreadyPaid && (
                <button
                  onClick={() => confirmMutation.mutate(buildPayload(false))}
                  disabled={saving}
                  className="w-full rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 sm:w-auto"
                >
                  {saving ? "A guardar…" : "Salvar como paga"}
                </button>
              )}
              {isDirectDebit && (
                <button
                  onClick={() => confirmMutation.mutate(buildPayload(false))}
                  disabled={saving}
                  className="w-full rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 sm:w-auto"
                >
                  {saving ? "A guardar…" : "Salvar com débito direto"}
                </button>
              )}
              {!alreadyPaid && !isDirectDebit && (
                <>
                  <button
                    onClick={() => confirmMutation.mutate(buildPayload(false))}
                    disabled={saving}
                    className="w-full rounded-md border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 sm:w-auto"
                  >
                    {saving ? "A guardar…" : "Salvar como pendente"}
                  </button>
                  <button
                    onClick={() => confirmMutation.mutate(buildPayload(true))}
                    disabled={saving || !dueDate}
                    className="w-full rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 sm:w-auto"
                    title={!dueDate ? "Defina a data de vencimento para gerar conta a pagar" : undefined}
                  >
                    {saving ? "A guardar…" : "Salvar e gerar conta a pagar"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
