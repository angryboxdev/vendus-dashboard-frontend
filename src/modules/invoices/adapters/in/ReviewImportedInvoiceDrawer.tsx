import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../../../lib/api.ts";
import { NumericInput } from "../../../../components/NumericInput.tsx";
import { LocationSelect } from "../../../../components/LocationSelect.tsx";
import { useInvoicesModule } from "../../invoices.module.tsx";
import { useFinancialBaseModule } from "../../../financial-base/financial-base.module.tsx";
import type {
  InvoiceDTO,
  InvoiceImportResultDTO,
  ConfirmImportedInvoicePayload,
  CreateInvoiceLinePayload,
  SupplierMatchDTO,
  NewSupplierPayload,
  LineDetailMode,
  InvoiceLineType,
  InvoiceDocumentType,
  StockReviewOverride,
} from "../../domain/entities/invoice.ts";
import { VALIDATION_ISSUE_LABELS, INVOICE_LINE_TYPE_LABELS, DOCUMENT_TYPE_LABELS, STOCK_REVIEW_OVERRIDE_LABELS } from "../../domain/entities/invoice.ts";
import type { CostCenterGroup, CostCenterCategory } from "../../../financial-base/domain/entities/cost-center.ts";
import {
  amountsPayload, docPriceToField, docQuantityToField, lineValueFields, previewDetailed, previewSimple, typedToCents,
  type DraftAmountHeader,
} from "../../domain/services/draft-amounts.ts";
import { describeIssues, ROUNDING_CENTS_PER_RATE, type InvoiceAmounts } from "../../domain/services/invoice-amounts.service.ts";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Euros escritos → cêntimos, em decimal exato (sem float). */
function toCents(s: string): number {
  return typedToCents(s) ?? 0;
}

function fromCents(c: number): string {
  return (c / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
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
  const [isEditing, setIsEditing] = useState(false);

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
    if (isEditing) {
      return (
        <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-2">
          <p className="text-xs font-semibold text-stone-600">Alterar fornecedor</p>
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
                setIsEditing(false);
              }}
              disabled={!selectedId}
              className="rounded-md bg-[#ED5C32] px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              Vincular
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="rounded-md px-3 py-1 text-xs text-stone-500 hover:bg-stone-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      );
    }

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
          <button
            onClick={() => { setIsEditing(true); setSelectedId(currentSupplierId ?? ""); }}
            className="text-[10px] text-stone-400 hover:text-stone-600 underline"
          >
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
          <NumericInput
            decimals={0}
            value={createPaymentDays}
            onChange={(e) => setCreatePaymentDays(e.target.value)}
            placeholder="Prazo pagamento (dias)"
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
  type: InvoiceLineType;
  quantity: string;
  unit: string;
  unitCost: string; // preço unitário s/ IVA antes de desconto, em euros (string decimal, todas as casas)
  vatRate: string;  // "0" | "6" | "13" | "23" | "" (por validar — nunca se assume 0%)
  /** Desconto comercial da linha: % ou € (a mesma operação). */
  discountKind: "pct" | "amount";
  discountValue: string;
  catId: string;
  locationId: string | null;
}

function newDraftLine(): DraftLine {
  return {
    key: crypto.randomUUID(),
    description: "",
    type: "other",
    quantity: "1",
    unit: "",
    unitCost: "",
    vatRate: "23",
    discountKind: "pct",
    discountValue: "",
    catId: "",
    locationId: null,
  };
}

/** Valores vêm do motor único (pré-visualização); o servidor recalcula tudo ao confirmar. */
function draftLineToPayload(l: DraftLine, preview: InvoiceAmounts | null): CreateInvoiceLinePayload {
  return {
    description: l.description.trim(),
    type: l.type,
    unit: l.unit.trim() || null,
    ...lineValueFields(l, preview),
    costCenterCategoryId: l.catId || null,
    // Optional (D4): omitted means "organization-wide, no store". Never defaulted.
    locationId: l.locationId,
  };
}

// Normaliza uma taxa de IVA extraída pela IA para uma das opções standard do select
function normalizeVatRate(rate: number | null): string {
  if (rate == null) return "";
  const std = [0, 6, 13, 23];
  const closest = std.reduce((a, b) => Math.abs(b - rate) < Math.abs(a - rate) ? b : a);
  return String(closest);
}

// ── EditableLinesSection ──────────────────────────────────────────────────────

interface EditableLinesSectionProps {
  lines: DraftLine[];
  categories: CostCenterCategory[];
  preview: InvoiceAmounts;
  onChange(lines: DraftLine[]): void;
}

function EditableLinesSection({ lines, categories, preview, onChange }: EditableLinesSectionProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const activeCategories = categories.filter((c) => c.isActive);
  const fieldCls = "w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]";

  function updateLine(key: string, patch: Partial<DraftLine>) {
    onChange(lines.map((l) => l.key === key ? { ...l, ...patch } : l));
  }

  function deleteLine(key: string) {
    if (expandedKey === key) setExpandedKey(null);
    onChange(lines.filter((l) => l.key !== key));
  }

  function addLine() {
    const draft = newDraftLine();
    onChange([...lines, draft]);
    setExpandedKey(draft.key);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-500">Linhas da fatura</p>
        <span className="text-xs text-stone-400">{lines.length} linha{lines.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Cards de linhas — valores do motor único (decimal exato) */}
      {lines.map((l) => {
        const isExpanded = expandedKey === l.key;
        const computed = preview.lines.find((x) => x.id === l.key);
        const totalWithoutVat = computed?.netCents ?? 0;
        const lineDiscount = (computed?.lineDiscountCents ?? 0) + (computed?.globalDiscountCents ?? 0);
        const vatAmount = preview.lineVatCents.get(l.key) ?? 0;
        const totalWithVat = totalWithoutVat + vatAmount;
        const cat = activeCategories.find((c) => c.id === l.catId);

        return (
          <div key={l.key} className="space-y-2 rounded-lg border border-stone-200 bg-white p-3">
            {/* Linha 1: descrição + acções */}
            <div className="flex items-center justify-between gap-2">
              {isExpanded ? (
                <input
                  type="text"
                  value={l.description}
                  onChange={(e) => updateLine(l.key, { description: e.target.value })}
                  placeholder="Descrição *"
                  className="flex-1 rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]"
                  autoFocus
                />
              ) : (
                <p className="flex-1 text-sm font-semibold text-stone-800 truncate">
                  {l.description || <span className="font-normal italic text-stone-400">Sem descrição</span>}
                </p>
              )}
              <div className="flex items-center gap-3 shrink-0">
                {isExpanded ? (
                  <>
                    <button
                      type="button"
                      onClick={() => deleteLine(l.key)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Eliminar
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedKey(null)}
                      className="text-xs text-stone-400 hover:text-stone-600"
                    >
                      Fechar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setExpandedKey(l.key)}
                    className="text-xs font-medium text-[#ED5C32] hover:underline"
                  >
                    Editar
                  </button>
                )}
              </div>
            </div>

            {/* Collapsed: resumo de valores + tipo + CC */}
            {!isExpanded && (
              <>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-stone-500">
                  <span>Qtd: <span className="font-medium text-stone-700">{l.quantity}{l.unit ? ` ${l.unit}` : ""}</span></span>
                  <span>Un s/IVA: <span className="font-medium text-stone-700">{l.unitCost ? `${l.unitCost} €` : "—"}</span></span>
                  {lineDiscount > 0 && (
                    <span>Desconto: <span className="font-medium text-stone-700">−{fromCents(lineDiscount)}</span></span>
                  )}
                  <span>IVA: {l.vatRate === "" ? <span className="font-medium text-amber-600">por validar</span> : <span className="font-medium text-stone-700">{l.vatRate}%</span>}</span>
                  <span>Base: <span className="font-medium text-stone-700">{fromCents(totalWithoutVat)}</span></span>
                  <span>IVA Total: <span className="font-medium text-stone-700">{fromCents(vatAmount)}</span></span>
                  <span>Total: <span className="font-semibold text-stone-800">{fromCents(totalWithVat)}</span></span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">
                    {INVOICE_LINE_TYPE_LABELS[l.type]}
                  </span>
                  {cat ? (
                    <span className="truncate font-medium text-stone-700">{cat.code} — {cat.name}</span>
                  ) : (
                    <span className="italic text-stone-400">Sem classificação</span>
                  )}
                </div>
              </>
            )}

            {/* Expanded: form completo */}
            {isExpanded && (
              <div className="space-y-2.5 pt-1">
                {/* Tipo */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-500">Tipo</label>
                  <select
                    value={l.type}
                    onChange={(e) => updateLine(l.key, { type: e.target.value as InvoiceLineType })}
                    className={fieldCls}
                  >
                    {(Object.entries(INVOICE_LINE_TYPE_LABELS) as [InvoiceLineType, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                {/* Qtd + Unidade */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-500">Quantidade</label>
                    <NumericInput
                      decimals={3}
                      value={l.quantity}
                      onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                      placeholder="1"
                      className={fieldCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-500">Unidade</label>
                    <input
                      type="text"
                      value={l.unit}
                      onChange={(e) => updateLine(l.key, { unit: e.target.value })}
                      placeholder="ex: kg, un"
                      className={fieldCls}
                    />
                  </div>
                </div>
                {/* Preço unit + IVA */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-500">Preço unit. s/ IVA (€)</label>
                    <NumericInput
                      value={l.unitCost}
                      onChange={(e) => updateLine(l.key, { unitCost: e.target.value })}
                      placeholder="0.00"
                      className={fieldCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-500">Taxa IVA</label>
                    <select
                      value={l.vatRate}
                      onChange={(e) => updateLine(l.key, { vatRate: e.target.value })}
                      className={fieldCls}
                    >
                      {l.vatRate === "" && <option value="">— por validar —</option>}
                      <option value="0">IVA 0%</option>
                      <option value="6">IVA 6%</option>
                      <option value="13">IVA 13%</option>
                      <option value="23">IVA 23%</option>
                    </select>
                  </div>
                </div>
                {/* Desconto comercial da linha: % ou € (a mesma operação) */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-500">Desconto da linha</label>
                  <div className="grid grid-cols-[auto_1fr] gap-2">
                    <select
                      value={l.discountKind}
                      onChange={(e) => updateLine(l.key, { discountKind: e.target.value as "pct" | "amount" })}
                      className={fieldCls}
                      aria-label="Tipo de desconto"
                    >
                      <option value="pct">%</option>
                      <option value="amount">€</option>
                    </select>
                    <NumericInput
                      value={l.discountValue}
                      onChange={(e) => updateLine(l.key, { discountValue: e.target.value })}
                      placeholder={l.discountKind === "pct" ? "ex: 10" : "0.00"}
                      className={fieldCls}
                    />
                  </div>
                </div>
                {/* Subcategoria CC */}
                {activeCategories.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-500">Subcategoria CC</label>
                    <select
                      value={l.catId}
                      onChange={(e) => updateLine(l.key, { catId: e.target.value })}
                      className={fieldCls}
                    >
                      <option value="">— nenhuma —</option>
                      {activeCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Loja (D4): opcional — um custo pode ser da organização e de nenhuma loja */}
                <LocationSelect
                  value={l.locationId}
                  onChange={(locationId) => updateLine(l.key, { locationId })}
                  allowUnset
                  label="Loja"
                  className={fieldCls}
                />
                {/* Preview do total calculado */}
                {(computed?.grossCents ?? 0) > 0 && (
                  <p className="text-xs text-stone-500 tabular-nums">
                    Bruto {fromCents(computed!.grossCents)}
                    {lineDiscount > 0 && <> · Desconto −{fromCents(lineDiscount)}</>}
                    {" "}· Base {fromCents(totalWithoutVat)} · Total c/ IVA:{" "}
                    <span className="font-semibold text-stone-800">{fromCents(totalWithVat)}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={addLine}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-300 py-2 text-xs font-medium text-stone-500 hover:border-[#ED5C32] hover:text-[#ED5C32]"
      >
        <span className="text-base leading-none">+</span> Adicionar linha
      </button>
    </div>
  );
}

// ── AmountsSummary ───────────────────────────────────────────────────────────

interface AmountsSummaryProps {
  detailed: boolean;
  /** Modo detalhado: resultado do motor; modo simples: null. */
  preview: InvoiceAmounts | null;
  simple: { differenceCents: number; finalDifferenceCents: number; canFinalize: boolean };
  header: DraftAmountHeader;
  declaredTotalCents: number;
  /** Diferença antes de qualquer ajuste de arredondamento. */
  rawDifferenceCents: number | null;
  roundingOn: boolean;
  onHeaderChange(patch: Partial<DraftAmountHeader>): void;
  onRoundingToggle(on: boolean): void;
}

/**
 * Quadro de valores (F1 §1.3): substitui o antigo "Saldo". Bruto − descontos
 * = base; base + IVA por taxa + ajustes = total calculado; "Diferença para a
 * fatura" = total do documento − total calculado. Só se finaliza a 0,00 €.
 */
export function AmountsSummary({ detailed, preview, simple, header, declaredTotalCents, rawDifferenceCents, roundingOn, onHeaderChange, onRoundingToggle }: AmountsSummaryProps) {
  const fieldCls = "w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]";
  const adjustmentsCents = typedToCents(header.adjustments) ?? 0;
  const finalDifference = detailed ? preview?.finalDifferenceCents ?? null : simple.finalDifferenceCents;
  const canFinalize = detailed ? !!preview?.canFinalize : simple.canFinalize;
  const rates = Math.max(1, preview?.vatByRate.length ?? 1);
  const roundingAllowed = rawDifferenceCents !== null && rawDifferenceCents !== 0 && Math.abs(rawDifferenceCents) <= rates * ROUNDING_CENTS_PER_RATE;
  const blocking = detailed ? (preview?.blocking ?? []).filter((i) => i.code !== "difference") : [];
  const signed = (c: number) => (c < 0 ? `−${fromCents(-c)}` : fromCents(c));
  const row = (label: string, value: string, strong = false) => (
    <div className={`flex justify-between gap-4 ${strong ? "font-semibold text-stone-800" : "text-stone-600"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );

  return (
    <div className="space-y-3 rounded-lg border border-stone-200 p-3 text-xs">
      {detailed && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500">Desconto global adicional</label>
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <select value={header.globalDiscountKind} onChange={(e) => onHeaderChange({ globalDiscountKind: e.target.value as "pct" | "amount" })} className={fieldCls} aria-label="Tipo de desconto global">
                <option value="pct">%</option>
                <option value="amount">€</option>
              </select>
              <NumericInput value={header.globalDiscountValue} onChange={(e) => onHeaderChange({ globalDiscountValue: e.target.value })} placeholder="—" className={fieldCls} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500" title="Desconto impresso no rodapé do documento. Se for só o resumo dos descontos das linhas, não é aplicado outra vez.">Desconto no rodapé (€)</label>
            <NumericInput value={header.footerDiscount} onChange={(e) => onHeaderChange({ footerDiscount: e.target.value })} placeholder="—" className={fieldCls} />
          </div>
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-500" title="Portes, ecovalor ou outros valores documentados que somam ao total (podem ser negativos).">Ajustes documentados (€)</label>
        <NumericInput value={header.adjustments} onChange={(e) => onHeaderChange({ adjustments: e.target.value })} placeholder="0.00" className={fieldCls} />
      </div>

      <div className="space-y-1 border-t border-stone-100 pt-2">
        {detailed && preview ? (
          <>
            {row("Bruto antes de descontos", fromCents(preview.grossCents))}
            {row("Desconto", preview.discountCents ? `−${fromCents(preview.discountCents)}` : fromCents(0))}
            {preview.footer === "summary_of_lines" && <p className="text-[11px] text-stone-400">O desconto do rodapé resume os descontos das linhas — não é aplicado outra vez.</p>}
            {row("Base após descontos", fromCents(preview.netCents))}
            {preview.vatByRate.map((v) => row(`IVA ${v.rate.replace(".", ",")}% (base ${fromCents(v.baseCents)})`, fromCents(v.vatCents)))}
            {adjustmentsCents !== 0 && row("Ajustes", signed(adjustmentsCents))}
            {row("Total calculado", fromCents(preview.totalCents), true)}
          </>
        ) : (
          <>
            {row("Base + IVA" + (adjustmentsCents ? " + ajustes" : ""), fromCents(declaredTotalCents - simple.differenceCents), true)}
          </>
        )}
        {row("Total da fatura", fromCents(declaredTotalCents))}
        {header.roundingCents !== 0 && row(`Ajuste de arredondamento (${header.roundingReason.trim() || "sem motivo"})`, signed(header.roundingCents))}
        <div className={`flex justify-between gap-4 rounded-md px-2 py-1.5 font-bold ${finalDifference === 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          <span>Diferença para a fatura</span>
          <span className="tabular-nums">{finalDifference === null ? "—" : signed(finalDifference)}</span>
        </div>
      </div>

      {roundingAllowed && (
        <div className="space-y-1.5 rounded-md bg-amber-50 px-2 py-2 text-amber-800">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={roundingOn} onChange={(e) => onRoundingToggle(e.target.checked)} />
            Registar {signed(rawDifferenceCents!)} como ajuste de arredondamento (máx. {ROUNDING_CENTS_PER_RATE} cêntimo por taxa de IVA)
          </label>
          {roundingOn && (
            <input type="text" value={header.roundingReason} onChange={(e) => onHeaderChange({ roundingReason: e.target.value })} placeholder="Motivo (obrigatório, ex.: IVA arredondado por linha no documento)" className={fieldCls} />
          )}
        </div>
      )}

      {!canFinalize && (
        <p className="text-red-600">
          {blocking.length > 0 ? `Por resolver: ${describeIssues(blocking)}. ` : ""}
          Só pode confirmar quando a diferença for 0,00 €.
        </p>
      )}
    </div>
  );
}

// ── ReviewImportedInvoiceDrawer ───────────────────────────────────────────────

interface Props {
  importResult: InvoiceImportResultDTO;
  /**
   * "confirm" (default): the post-import review screen — draft_ai/pending_review
   * → pending via confirmImportedInvoice. "edit": reopens this same screen for an
   * already-confirmed invoice ("Editar fatura completa" in InvoiceDetailDrawer) —
   * saves via updateInvoice + line replacement instead, and hides the
   * import-only affordances (AI confidence, validation issues, paid/DD quick
   * transitions) that don't apply to editing a live invoice.
   */
  mode?: "confirm" | "edit";
  /** mode "edit" only: ids of the invoice's current lines, replaced wholesale on save. */
  existingLineIds?: string[];
  onClose(): void;
  onConfirmed(invoice: InvoiceDTO): void;
  /** Abrir um documento já existente (conflito de identidade fiscal: original/duplicado parecido). */
  onOpenExisting?(invoiceId: string): void;
}

/** 409/422 do backend com `code` (identidade fiscal, versão, valores). */
interface ConfirmConflict {
  code: string;
  message: string;
  existingInvoiceId?: string | null;
  identityId?: string;
  candidates?: { invoiceId: string | null; seriesNumber: string }[];
}

export function ReviewImportedInvoiceDrawer({ importResult, mode = "confirm", existingLineIds = [], onClose, onConfirmed, onOpenExisting }: Props) {
  const { api } = useInvoicesModule();
  const fbModule = useFinancialBaseModule();
  const qc = useQueryClient();
  const isEdit = mode === "edit";

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
  // Math.abs: os totais vêm sempre com o sinal já aplicado (negativo para
  // notas de crédito) — o formulário mostra sempre a magnitude tal como
  // aparece no documento; o sinal é reaplicado pelo backend a partir de
  // documentType (Invoice.normalizeAmountSign), nunca escrito pelo utilizador.
  const [subtotalStr, setSubtotalStr] = useState((Math.abs(inv.subtotalWithoutVat) / 100).toFixed(2));
  const [vatStr, setVatStr] = useState((Math.abs(inv.totalVat) / 100).toFixed(2));
  const [totalStr, setTotalStr] = useState((Math.abs(inv.totalWithVat) / 100).toFixed(2));
  const [docType, setDocType] = useState<InvoiceDocumentType>(inv.documentType ?? "invoice");
  const [notes, setNotes] = useState(inv.notes ?? "");
  const [stockReviewOverride, setStockReviewOverride] = useState<StockReviewOverride>(inv.stockReviewOverride ?? "auto");
  const [stockReviewOverrideReason, setStockReviewOverrideReason] = useState(inv.stockReviewOverrideReason ?? "");
  const [costCenterGroupId, setCostCenterGroupId] = useState<string | null>(inv.costCenterGroupId ?? null);
  const [costCenterCategoryId, setCostCenterCategoryId] = useState<string | null>(inv.costCenterCategoryId ?? null);
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [paidAt, setPaidAt] = useState(inv.invoiceDate ?? todayStr());
  const [isDirectDebit, setIsDirectDebit] = useState(false);
  const [directDebitDate, setDirectDebitDate] = useState(inv.dueDate ?? "");
  // Em edição, mantém o heurístico antigo (reflete o estado real já
  // gravado — `importResult.extractedLines` é sintetizado a partir das
  // linhas atuais da fatura nesse modo). Numa importação nova, enquanto o
  // utilizador não escolher manualmente (`manualDetailMode`), o modo é
  // derivado da preferência do fornecedor: "normalmente gera revisão de
  // stock" → "Detalhar por linha" (sem linhas, o Stock nunca consegue
  // resolver a revisão — ver RecordInvoiceFinalizedForStockUseCase);
  // qualquer outra preferência (ou nenhuma) → "Classificação única" (o
  // default do `main`; a preferência do fornecedor só o muda para quem
  // normalmente gera revisão de stock).
  const [manualDetailMode, setManualDetailMode] = useState<LineDetailMode | null>(
    isEdit ? (importResult.extractedLines.length > 0 ? "detailed" : "simple") : null
  );
  const supplierDefaultStockPolicy = suppliers.find((s) => s.id === supplierId)?.defaultStockPolicy;
  const detailMode: LineDetailMode =
    manualDetailMode ?? (supplierDefaultStockPolicy === "usually_creates_review" ? "detailed" : "simple");
  // Módulo Stock (Compra por rever) — mudar "Impacto no stock" ou descartar
  // linhas detalhadas pode tornar órfã uma revisão de stock já criada para
  // esta fatura ainda não aplicada. O backend responde 409 com
  // `requiresConfirmation: true` nesse caso (ver shared-stock-review-guard
  // no backend); mostramos um diálogo de confirmação e, se aceite,
  // reenviamos o mesmo pedido com `confirmRemoveStockReview: true`.
  const [stockReviewConfirmMessage, setStockReviewConfirmMessage] = useState<string | null>(null);

  const [lines, setLines] = useState<DraftLine[]>(() =>
    importResult.extractedLines.map((l, i) => {
      const hasDiscount = (l.discountPct ?? 0) > 0 || (l.discountAmount ?? 0) > 0;
      // Preço unitário antes de desconto, com todas as casas do documento; só se deriva do
      // total líquido quando não há desconto (senão o desconto seria aplicado duas vezes).
      const unitCost = docPriceToField(
        l.unitPriceText,
        l.unitPriceWithoutVat,
        !hasDiscount && l.totalWithoutVat != null ? { totalCents: l.totalWithoutVat, quantity: l.quantity ?? 1 } : undefined,
      );
      return {
        key: String(i),
        description: l.description,
        type: "other" as InvoiceLineType,
        // "20.000" resolve-se pelo bruto impresso; sem leitura única fica para validar.
        quantity: docQuantityToField(l.quantityText, l.quantity, unitCost, l.grossWithoutDiscount),
        unit: "",
        unitCost,
        vatRate: normalizeVatRate(l.vatRate),
        discountKind: (l.discountPct ?? 0) > 0 ? "pct" : (l.discountAmount ?? 0) > 0 ? "amount" : "pct",
        discountValue: (l.discountPct ?? 0) > 0 ? String(l.discountPct) : (l.discountAmount ?? 0) > 0 ? (l.discountAmount! / 100).toFixed(2) : "",
        catId: "",
        locationId: null,
      };
    })
  );

  // Valores do documento (F1 §1.3) — descontos globais/rodapé, ajustes e quadro de IVA extraídos.
  const extracted = importResult.extractedAmounts;
  const [amountsHeader, setAmountsHeader] = useState<Omit<DraftAmountHeader, "totalStr" | "subtotalStr" | "vatStr" | "roundingCents">>(() => ({
    globalDiscountKind: (extracted?.globalDiscountPct ?? 0) > 0 ? "pct" : (extracted?.globalDiscountAmount ?? 0) > 0 ? "amount" : "pct",
    globalDiscountValue: (extracted?.globalDiscountPct ?? 0) > 0 ? String(extracted!.globalDiscountPct) : (extracted?.globalDiscountAmount ?? 0) > 0 ? (extracted!.globalDiscountAmount! / 100).toFixed(2) : "",
    footerDiscount: (extracted?.footerDiscountAmount ?? 0) > 0 ? (extracted!.footerDiscountAmount! / 100).toFixed(2) : "",
    adjustments: "",
    roundingReason: "",
    vatSummary: extracted?.vatSummary ?? null,
  }));
  const [roundingOn, setRoundingOn] = useState(false);
  // Conflitos devolvidos ao confirmar e as decisões explícitas da pessoa.
  const [conflict, setConflict] = useState<ConfirmConflict | null>(null);
  const [notADuplicate, setNotADuplicate] = useState(false);
  const [completeStockIdentityId, setCompleteStockIdentityId] = useState<string | null>(
    importResult.fiscal?.kind === "existing_stock_only" ? importResult.fiscal.identityId ?? null : null,
  );
  const [lastSaveAsPayable, setLastSaveAsPayable] = useState(false);

  // Pré-visualização com o mesmo motor do servidor (que recalcula ao confirmar).
  const activeLines = lines.filter((l) => l.description.trim());
  const baseHeader: DraftAmountHeader = { ...amountsHeader, totalStr, subtotalStr, vatStr, roundingCents: 0 };
  const rawPreview = detailMode === "detailed" ? previewDetailed(baseHeader, activeLines) : null;
  const rawSimple = previewSimple(baseHeader);
  const rawDifferenceCents = rawPreview ? rawPreview.differenceCents : rawSimple.differenceCents;
  const roundingCents = roundingOn && rawDifferenceCents !== null ? rawDifferenceCents : 0;
  const header: DraftAmountHeader = { ...baseHeader, roundingCents };
  const preview = detailMode === "detailed" ? previewDetailed(header, activeLines) : null;
  const simplePreview = previewSimple(header);
  const amountsOk = preview ? preview.canFinalize : simplePreview.canFinalize;

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
    onError: (err) => {
      const data = err instanceof ApiError ? (err.data as Partial<ConfirmConflict> | null) : null;
      setConflict(data?.code ? { ...data, code: data.code, message: err.message } : null);
    },
  });

  function confirm(saveAsPayable: boolean, extra: Partial<ConfirmImportedInvoicePayload> = {}) {
    setLastSaveAsPayable(saveAsPayable);
    setConflict(null);
    confirmMutation.mutate({ ...buildPayload(saveAsPayable), ...extra });
  }

  /** Decisão explícita depois de um conflito: repete o mesmo pedido com a escolha da pessoa. */
  function resolveConflict(extra: Partial<ConfirmImportedInvoicePayload>) {
    if (extra.notADuplicate) setNotADuplicate(true);
    if (extra.completeStockIdentityId) setCompleteStockIdentityId(extra.completeStockIdentityId);
    confirm(lastSaveAsPayable, extra);
  }

  // Edit mode: the invoice is already confirmed (any status), so saving goes
  // through the regular update endpoints instead of confirmImportedInvoice
  // (which requires draft_ai/pending_review and has import-only side effects
  // like creating a payable entry or marking as paid). Lines are replaced
  // wholesale — deleted then re-added from the draft — matching the "as if
  // freshly imported" framing: type/category/unit/location reset to blank,
  // same as a fresh import's extracted lines, for the user to reclassify.
  const editMutation = useMutation({
    // `confirmRemove` chega como variável do `mutate(confirmRemove)`, nunca
    // de estado React — evita o problema clássico de `setState` + `mutate()`
    // no mesmo handler lerem o valor antigo por causa do fecho (closure) do
    // render corrente.
    mutationFn: async (confirmRemove: boolean) => {
      let resolvedSupplierId = supplierId;
      if (newSupplierData) {
        const created = await fbModule.api.createSupplier(newSupplierData);
        resolvedSupplierId = created.id;
      }

      await api.updateInvoice(inv.id, {
        supplierId: resolvedSupplierId,
        supplierName: supplierName.trim(),
        supplierNifSnapshot: supplierNif.trim() || null,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        dueDate: dueDate || null,
        subtotalWithoutVat: toCents(subtotalStr),
        totalVat: toCents(vatStr),
        totalWithVat: toCents(totalStr),
        notes: notes.trim() || null,
        costCenterGroupId: detailMode === "simple" ? (costCenterGroupId || null) : null,
        costCenterCategoryId: detailMode === "simple" ? (costCenterCategoryId || null) : null,
        stockReviewOverride,
        stockReviewOverrideReason: stockReviewOverride === "force_skip" ? (stockReviewOverrideReason.trim() || null) : null,
        confirmRemoveStockReview: confirmRemove || undefined,
      });

      await api.setLineDetailMode(inv.id, detailMode, confirmRemove || undefined);
      if (detailMode === "detailed") {
        for (const lineId of existingLineIds) {
          await api.deleteLine(inv.id, lineId);
        }
        for (const l of activeLines) {
          await api.addLine(inv.id, draftLineToPayload(l, preview));
        }
      }

      return api.getInvoice(inv.id);
    },
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ["invoices"] });
      void qc.invalidateQueries({ queryKey: ["invoice-alerts"] });
      onConfirmed(updated);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409 && (err.data as { requiresConfirmation?: boolean } | null)?.requiresConfirmation) {
        setStockReviewConfirmMessage(err.message);
      }
    },
  });

  function confirmStockReviewRemovalAndRetry() {
    setStockReviewConfirmMessage(null);
    editMutation.mutate(true);
  }

  function cancelStockReviewConfirm() {
    setStockReviewConfirmMessage(null);
    // Limpa o erro 409 guardado pelo useMutation — sem isto, o banner de
    // erro normal (`confirmError` abaixo) reapareceria com a mesma
    // mensagem de pedido-de-confirmação, como se fosse um erro bloqueante.
    editMutation.reset();
  }

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
      documentType: docType,
      notes: notes.trim() || null,
      stockReviewOverride,
      stockReviewOverrideReason: stockReviewOverride === "force_skip" ? (stockReviewOverrideReason.trim() || null) : null,
      saveAsPayable: (alreadyPaid || isDirectDebit || docType === "credit_note") ? false : saveAsPayable,
      markAsPaid: alreadyPaid,
      paidAt: alreadyPaid ? paidAt : undefined,
    };
    // O servidor recalcula tudo com o motor único; estes valores só orientam o pedido.
    payload.amounts = amountsPayload(header, detailMode === "detailed");
    if (inv.version !== undefined) payload.expectedVersion = inv.version;
    if (notADuplicate) payload.notADuplicate = true;
    if (completeStockIdentityId) payload.completeStockIdentityId = completeStockIdentityId;
    if (detailMode === "detailed") {
      payload.lines = activeLines.map((l) => draftLineToPayload(l, preview));
      // Em modo detailed não enviamos classificação de fatura — evita sobrescrever categorias per-linha
      payload.costCenterGroupId = null;
      payload.costCenterCategoryId = null;
    } else {
      payload.lines = [];
      payload.costCenterGroupId = costCenterGroupId || null;
      payload.costCenterCategoryId = costCenterCategoryId || null;
    }
    if (newSupplierData) {
      payload.newSupplier = newSupplierData;
    } else {
      payload.supplierId = supplierId ?? null;
    }
    return payload;
  }

  const [showPdf, setShowPdf] = useState(!!inv.attachmentUrl);

  const saving = isEdit ? editMutation.isPending : confirmMutation.isPending;
  const activeError = isEdit ? editMutation.error : confirmMutation.error;
  // Enquanto o diálogo de confirmação de remoção da revisão de stock está
  // visível, não duplicamos a mesma mensagem no banner de erro normal.
  const confirmError = stockReviewConfirmMessage || conflict ? null : activeError instanceof Error ? activeError.message : null;
  // Confirmar só com os valores reconciliados ao cêntimo (o servidor volta a verificar).
  const blockFinalize = !isEdit && !amountsOk;
  const blockTitle = blockFinalize ? "Os valores não batem com a fatura — a diferença tem de ser 0,00 €." : undefined;

  const labelCls = "block text-xs font-medium text-stone-500 mb-1";
  const inputCls =
    "w-full rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-sm focus:border-[#ED5C32] focus:outline-none";
  const inputSmCls =
    "w-full rounded-md border border-stone-200 bg-white px-2.5 py-1.5 text-xs focus:border-[#ED5C32] focus:outline-none";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-end bg-black/30">
      <div className={`flex h-full w-full flex-row bg-white shadow-2xl transition-[max-width] duration-300 ${showPdf && inv.attachmentUrl ? "max-w-[1280px]" : "max-w-3xl"}`}>
        {/* Left column — form */}
        <div className="flex flex-1 flex-col overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 shrink-0 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-base font-semibold text-stone-900">
                {isEdit ? "Editar fatura completa" : "Revisar fatura importada"}
              </h2>
              <p className="mt-0.5 text-xs text-stone-500">
                {isEdit
                  ? "Corrige qualquer campo desde a raiz — fornecedor, número, valores e linhas."
                  : "Verifique os dados e corrija se necessário antes de guardar."}
              </p>
            </div>
            {!isEdit && inv.aiConfidence != null && (
              <ConfidenceBadge value={inv.aiConfidence} />
            )}
          </div>
          <div className="flex items-center gap-2">
            {inv.attachmentUrl && (
              <button
                onClick={() => setShowPdf((v) => !v)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${showPdf ? "border-stone-300 bg-stone-100 text-stone-700" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"}`}
              >
                {showPdf ? "Fechar doc." : "Ver documento"}
              </button>
            )}
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
        </div>

        {/* body */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-6">
          {/* Validation issues — import-only, not relevant when editing a live invoice */}
          {!isEdit && (
            <ValidationIssues issues={importResult.validationIssues.filter((issue) => {
              if (issue === "no_supplier_match" && (supplierId !== null || newSupplierData !== null)) return false;
              if (issue === "no_due_date" && (dueDate !== "" || alreadyPaid || isDirectDebit)) return false;
              return true;
            })} />
          )}

          {/* Fornecedor — 2 colunas: campos à esq, card à dir */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Fornecedor</p>
            <div className="grid grid-cols-2 gap-4 items-start">
              <div className="space-y-3">
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
            </div>
          </div>

          {/* Tipo de documento */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Tipo de documento</p>
            <div className="flex gap-2">
              {(Object.entries(DOCUMENT_TYPE_LABELS) as [InvoiceDocumentType, string][]).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDocType(type)}
                  className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${docType === type ? "border-[#ED5C32] bg-[#FDF8F5] text-[#ED5C32]" : "border-stone-200 text-stone-500 hover:border-stone-300"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {!isEdit && importResult.validationIssues.includes("credit_note_detected") && (
              <p className="text-xs text-amber-600">Identificámos termos de nota de crédito no documento — confirma antes de guardar.</p>
            )}
          </div>

          {/* Dados da fatura — largura total */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Dados da fatura</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
            {!isEdit && (
              <div className="flex flex-wrap gap-4">
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
            )}
          </div>

          {/* Valores — largura total */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Valores</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Subtotal s/ IVA (€)</label>
                <NumericInput value={subtotalStr} onChange={(e) => setSubtotalStr(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>IVA (€)</label>
                <NumericInput value={vatStr} onChange={(e) => setVatStr(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Total c/ IVA (€)</label>
                <NumericInput value={totalStr} onChange={(e) => setTotalStr(e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          {/* Notas — largura total */}
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

          {/* Impacto no stock — largura total */}
          <div>
            <label className={labelCls}>Impacto no stock</label>
            <select
              value={stockReviewOverride}
              onChange={(e) => setStockReviewOverride(e.target.value as StockReviewOverride)}
              className={inputCls}
            >
              {(Object.entries(STOCK_REVIEW_OVERRIDE_LABELS) as [StockReviewOverride, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {stockReviewOverride === "force_skip" && (
              <input
                type="text"
                value={stockReviewOverrideReason}
                onChange={(e) => setStockReviewOverrideReason(e.target.value)}
                className={`${inputCls} mt-2`}
                placeholder="Motivo (opcional)"
              />
            )}
          </div>

          {/* Modo de classificação — largura total */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Modo de classificação</p>
            <div className="flex rounded-lg border border-stone-200 p-0.5 bg-stone-50">
              <button
                type="button"
                onClick={() => setManualDetailMode("simple")}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  detailMode === "simple"
                    ? "bg-white text-stone-800 shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                Classificação única
              </button>
              <button
                type="button"
                onClick={() => setManualDetailMode("detailed")}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  detailMode === "detailed"
                    ? "bg-white text-stone-800 shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                Detalhar por linha
              </button>
            </div>
          </div>

          {/* Modo simples: centro de custo global */}
          {detailMode === "simple" && groups.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Centro de custo</p>
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

          {/* Modo detalhado: linhas editáveis com subcategoria por linha */}
          {detailMode === "detailed" && (
            <EditableLinesSection
              lines={lines}
              categories={categories as CostCenterCategory[]}
              preview={preview!}
              onChange={setLines}
            />
          )}

          {/* Valores: bruto, descontos, base, IVA por taxa, total e diferença para a fatura */}
          <AmountsSummary
            detailed={detailMode === "detailed"}
            preview={preview}
            simple={simplePreview}
            header={header}
            declaredTotalCents={toCents(totalStr)}
            rawDifferenceCents={rawDifferenceCents}
            roundingOn={roundingOn}
            onHeaderChange={(patch) => setAmountsHeader((h) => ({ ...h, ...patch }))}
            onRoundingToggle={setRoundingOn}
          />

          {/* Origem — no final */}
          <div className="flex items-center gap-2 pt-1 text-xs text-stone-400">
            <span className="font-medium text-stone-500">
              {inv.source === "pdf_import" ? "Importação PDF" : "Importação Imagem"}
            </span>
            <span>·</span>
            <span>{new Date(inv.createdAt).toLocaleString("pt-PT")}</span>
          </div>
        </div>

        {/* footer */}
        <div className="shrink-0 border-t border-stone-100 px-4 py-3 sm:px-6 sm:py-4">
          {confirmError && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{confirmError}</p>
          )}
          {conflict && (
            <div className="mb-3 space-y-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p>{conflict.message}</p>
              <div className="flex flex-wrap gap-2">
                {conflict.code === "existing_finance" && conflict.existingInvoiceId && onOpenExisting && (
                  <button type="button" onClick={() => onOpenExisting(conflict.existingInvoiceId!)} className="rounded-md border border-amber-300 bg-white px-2.5 py-1 font-medium hover:bg-amber-100">
                    Abrir documento existente
                  </button>
                )}
                {conflict.code === "existing_stock_only" && conflict.identityId && (
                  <button type="button" disabled={saving} onClick={() => resolveConflict({ completeStockIdentityId: conflict.identityId! })} className="rounded-md border border-amber-300 bg-white px-2.5 py-1 font-medium hover:bg-amber-100 disabled:opacity-50">
                    Completar lançamento existente
                  </button>
                )}
                {conflict.code === "possible_duplicate" && (
                  <>
                    {onOpenExisting && (conflict.candidates ?? []).filter((c) => c.invoiceId).map((c) => (
                      <button key={c.invoiceId} type="button" onClick={() => onOpenExisting(c.invoiceId!)} className="rounded-md border border-amber-300 bg-white px-2.5 py-1 font-medium hover:bg-amber-100">
                        Comparar com {c.seriesNumber}
                      </button>
                    ))}
                    <button type="button" disabled={saving} onClick={() => resolveConflict({ notADuplicate: true })} className="rounded-md border border-amber-300 bg-white px-2.5 py-1 font-medium hover:bg-amber-100 disabled:opacity-50">
                      Não é duplicado — confirmar
                    </button>
                  </>
                )}
                {conflict.code === "identity_incomplete" && <span className="font-medium">Completar dados: NIF do fornecedor e número do documento (acima).</span>}
                {conflict.code === "version_conflict" && <span className="font-medium">Feche e volte a abrir o documento para ver a versão atual.</span>}
              </div>
            </div>
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
              {isEdit ? (
                <button
                  onClick={() => editMutation.mutate(false)}
                  disabled={saving}
                  className="w-full rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 sm:w-auto"
                >
                  {saving ? "A guardar…" : "Guardar alterações"}
                </button>
              ) : (
                <>
                  {alreadyPaid && (
                    <button
                      onClick={() => confirm(false)}
                      disabled={saving || blockFinalize}
                      title={blockTitle}
                      className="w-full rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 sm:w-auto"
                    >
                      {saving ? "A guardar…" : "Salvar como paga"}
                    </button>
                  )}
                  {isDirectDebit && (
                    <button
                      onClick={() => confirm(false)}
                      disabled={saving || blockFinalize}
                      title={blockTitle}
                      className="w-full rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 sm:w-auto"
                    >
                      {saving ? "A guardar…" : "Salvar com débito direto"}
                    </button>
                  )}
                  {!alreadyPaid && !isDirectDebit && (
                    <>
                      <button
                        onClick={() => confirm(false)}
                        disabled={saving || blockFinalize}
                        title={blockTitle}
                        className="w-full rounded-md border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 sm:w-auto"
                      >
                        {saving ? "A guardar…" : "Salvar como pendente"}
                      </button>
                      {docType !== "credit_note" && (
                        <button
                          onClick={() => confirm(true)}
                          disabled={saving || !dueDate || blockFinalize}
                          className="w-full rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 sm:w-auto"
                          title={blockTitle ?? (!dueDate ? "Defina a data de vencimento para gerar conta a pagar" : undefined)}
                        >
                          {saving ? "A guardar…" : "Salvar e gerar conta a pagar"}
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        </div>
        {/* Right column — PDF panel */}
        {showPdf && inv.attachmentUrl && (
          <div className="flex w-[580px] shrink-0 flex-col border-l border-[#F5C992]/40">
            <div className="flex items-center justify-between border-b border-[#F5C992]/40 px-4 py-2 shrink-0">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Documento original</p>
              <a
                href={inv.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-[#ED5C32] hover:underline"
              >
                Abrir em nova janela ↗
              </a>
            </div>
            <iframe
              src={inv.attachmentUrl}
              title="Documento original"
              className="w-full flex-1"
              style={{ border: "none" }}
            />
          </div>
        )}
      </div>

      {/* Confirmação — remover revisão de stock ainda não aplicada (409 requiresConfirmation) */}
      {stockReviewConfirmMessage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
            <p className="text-sm font-semibold text-stone-800">Revisão de stock associada</p>
            <p className="mt-2 text-sm text-stone-600">{stockReviewConfirmMessage}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={cancelStockReviewConfirm}
                className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
              >
                Cancelar
              </button>
              <button
                onClick={confirmStockReviewRemovalAndRetry}
                disabled={editMutation.isPending}
                className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
