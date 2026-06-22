import { useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFinancialBaseModule } from "../../financial-base.module.tsx";
import {
  FINANCIAL_TYPE_LABELS,
  FINANCIAL_TYPE_COLORS,
  type CostCenterGroup,
  type CostCenterCategory,
  type CreateCostCenterGroupPayload,
  type UpdateCostCenterGroupPayload,
  type CreateCostCenterCategoryPayload,
  type UpdateCostCenterCategoryPayload,
  type FinancialType,
  type SeedResult,
} from "../../domain/entities/cost-center.ts";
import type { Supplier } from "../../domain/entities/supplier.ts";
import { useInvoicesModule } from "../../../invoices/invoices.module.tsx";
import type { InvoiceDTO, InvoiceLineDTO } from "../../../invoices/domain/entities/invoice.ts";
import { PageFooter } from "../../../../components/PageFooter.tsx";

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_FINANCIAL_TYPES = Object.keys(FINANCIAL_TYPE_LABELS) as FinancialType[];

const inputCls =
  "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30";

// ── Shared small components ───────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent = "text-stone-900",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-[#F5C992]/40 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accent}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-stone-400">{sub}</p>}
    </div>
  );
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isActive ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-stone-400"}`} />
      {isActive ? "Ativo" : "Inativo"}
    </span>
  );
}

function FinancialTypeBadge({ type }: { type: FinancialType }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${FINANCIAL_TYPE_COLORS[type]}`}>
      {FINANCIAL_TYPE_LABELS[type]}
    </span>
  );
}

function BoolIcon({ value }: { value: boolean }) {
  if (value) {
    return (
      <svg className="mx-auto h-4 w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return <span className="block text-center text-stone-300">—</span>;
}

function EditIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
    </svg>
  );
}

function DeactivateIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ActivateIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

function PlusSmIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
    </svg>
  );
}

// ── Toggle action button ──────────────────────────────────────────────────────

function ToggleBtn({
  isActive,
  disabled,
  onClick,
}: {
  isActive: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={isActive ? "Desativar" : "Ativar"}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg p-1.5 transition-colors hover:bg-stone-100 disabled:opacity-40 ${
        isActive ? "text-stone-400 hover:text-red-500" : "text-stone-400 hover:text-emerald-600"
      }`}
    >
      {isActive ? <DeactivateIcon /> : <ActivateIcon />}
    </button>
  );
}

// ── GroupDrawer ────────────────────────────────────────────────────────────────

interface GroupDrawerProps {
  open: boolean;
  editing: CostCenterGroup | null;
  onClose: () => void;
  onSave: (payload: CreateCostCenterGroupPayload | UpdateCostCenterGroupPayload, id?: string) => void;
  saving: boolean;
}

function GroupDrawer({ open, editing, onClose, onSave, saving }: GroupDrawerProps) {
  const isEdit = editing !== null;

  const [code,        setCode]        = useState(editing?.code ?? "");
  const [name,        setName]        = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [sortOrder,   setSortOrder]   = useState(editing?.sortOrder != null ? String(editing.sortOrder) : "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEdit && editing) {
      onSave(
        { name, description: description || null, sortOrder: sortOrder ? Number(sortOrder) : undefined },
        editing.id,
      );
    } else {
      onSave({ code, name, description: description || null, sortOrder: sortOrder ? Number(sortOrder) : undefined });
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#F5C992]/40 px-6 py-4">
          <h2 className="text-base font-semibold text-stone-800">
            {isEdit ? "Editar grupo" : "Novo grupo de centro de custo"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          >
            <CloseIcon />
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
                placeholder="ex: OPD"
                className={inputCls}
              />
              <p className="mt-1 text-xs text-stone-400">
                Código único, convertido para maiúsculas. Ex: OPD, PES, EST.
              </p>
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
              placeholder="ex: Operação Direta"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Descrição opcional…"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Ordem de apresentação</label>
            <input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
              className={inputCls}
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
            {saving ? "A guardar…" : isEdit ? "Guardar alterações" : "Criar grupo"}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── CategoryDrawer ────────────────────────────────────────────────────────────

interface CategoryDrawerProps {
  open: boolean;
  editing: CostCenterCategory | null;
  groups: CostCenterGroup[];
  defaultGroupId?: string;
  onClose: () => void;
  onSave: (
    payload: CreateCostCenterCategoryPayload | UpdateCostCenterCategoryPayload,
    id?: string,
  ) => void;
  saving: boolean;
}

function CategoryDrawer({
  open,
  editing,
  groups,
  defaultGroupId,
  onClose,
  onSave,
  saving,
}: CategoryDrawerProps) {
  const isEdit = editing !== null;

  const [groupId,              setGroupId]              = useState(editing?.groupId ?? defaultGroupId ?? "");
  const [code,                 setCode]                 = useState(editing?.code ?? "");
  const [name,                 setName]                 = useState(editing?.name ?? "");
  const [financialType,        setFinancialType]        = useState<FinancialType>(editing?.financialType ?? "cmv");
  const [affectsDre,           setAffectsDre]           = useState(editing?.affectsDre ?? false);
  const [affectsCashflow,      setAffectsCashflow]      = useState(editing?.affectsCashflow ?? false);
  const [affectsProfitability, setAffectsProfitability] = useState(editing?.affectsProfitability ?? false);
  const [requiresChannel,      setRequiresChannel]      = useState(editing?.requiresChannel ?? false);
  const [requiresAllocation,   setRequiresAllocation]   = useState(editing?.requiresAllocation ?? false);
  const [description,          setDescription]          = useState(editing?.description ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEdit && editing) {
      onSave(
        {
          name,
          financialType,
          affectsDre,
          affectsCashflow,
          affectsProfitability,
          requiresChannel,
          requiresAllocation,
          description: description || null,
        },
        editing.id,
      );
    } else {
      onSave({
        groupId,
        code,
        name,
        financialType,
        affectsDre,
        affectsCashflow,
        affectsProfitability,
        requiresChannel,
        requiresAllocation,
        description: description || null,
      });
    }
  }

  if (!open) return null;

  const FLAGS = [
    { label: "Afeta DRE",            checked: affectsDre,            setter: setAffectsDre },
    { label: "Afeta Fluxo de Caixa", checked: affectsCashflow,       setter: setAffectsCashflow },
    { label: "Afeta Rentabilidade",  checked: affectsProfitability,  setter: setAffectsProfitability },
    { label: "Exige Canal",          checked: requiresChannel,       setter: setRequiresChannel },
    { label: "Exige Rateio",         checked: requiresAllocation,    setter: setRequiresAllocation },
  ] as const;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#F5C992]/40 px-6 py-4">
          <h2 className="text-base font-semibold text-stone-800">
            {isEdit ? "Editar subcategoria" : "Nova subcategoria"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
          >
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          {!isEdit && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-700">
                  Grupo <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Selecionar grupo…</option>
                  {groups
                    .filter((g) => g.isActive)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.code} — {g.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-stone-700">
                  Código <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="ex: OPD.01"
                  className={inputCls}
                />
                <p className="mt-1 text-xs text-stone-400">Código único, convertido para maiúsculas.</p>
              </div>
            </>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: CMV / Ingredientes"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              Tipo financeiro <span className="text-red-500">*</span>
            </label>
            <select
              value={financialType}
              onChange={(e) => setFinancialType(e.target.value as FinancialType)}
              className={inputCls}
            >
              {ALL_FINANCIAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FINANCIAL_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-stone-700">Impactos financeiros</label>
            <div className="flex flex-col gap-2.5">
              {FLAGS.map(({ label, checked, setter }) => (
                <label key={label} className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setter(e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 accent-[#ED5C32]"
                  />
                  <span className="text-sm text-stone-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Descrição opcional…"
              className={inputCls}
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
            {saving ? "A guardar…" : isEdit ? "Guardar alterações" : "Criar subcategoria"}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Tab 1: Estrutura Essencial ────────────────────────────────────────────────

interface Tab1Props {
  groups: CostCenterGroup[];
  categories: CostCenterCategory[];
  onEditGroup: (g: CostCenterGroup) => void;
  onToggleGroup: (g: CostCenterGroup) => void;
  onEditCategory: (c: CostCenterCategory) => void;
  onToggleCategory: (c: CostCenterCategory) => void;
  onAddCategory: (groupId: string) => void;
  togglingGroup: string | null;
  togglingCategory: string | null;
}

function Tab1Estrutura({
  groups,
  categories,
  onEditGroup,
  onToggleGroup,
  onEditCategory,
  onToggleCategory,
  onAddCategory,
  togglingGroup,
  togglingCategory,
}: Tab1Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const activeGroups = groups.filter((g) => g.isActive).length;
  const activeCategories = categories.filter((c) => c.isActive).length;
  const affectsDreCount = categories.filter((c) => c.affectsDre && c.isActive).length;

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Grupos ativos" value={String(activeGroups)} sub={`${groups.length} no total`} />
        <KpiCard
          label="Subcategorias ativas"
          value={String(activeCategories)}
          sub={`${categories.length} no total`}
        />
        <KpiCard label="Afetam DRE" value={String(affectsDreCount)} accent="text-emerald-700" />
        <KpiCard
          label="Fora da DRE"
          value={String(activeCategories - affectsDreCount)}
          accent="text-stone-500"
        />
      </div>

      {/* Accordion */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#F5C992]/40 bg-white py-16 text-center shadow-sm">
          <p className="text-sm font-medium text-stone-500">Ainda não há grupos de centros de custo.</p>
          <p className="mt-1 text-xs text-stone-400">
            Use o separador "Cadastro Essencial" para carregar os dados padrão ou criar manualmente.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white shadow-sm">
          {groups.map((g, idx) => {
            const gCats = categories.filter((c) => c.groupId === g.id);
            const isExpanded = expandedIds.has(g.id);
            return (
              <div key={g.id} className={idx > 0 ? "border-t border-stone-100" : ""}>
                {/* Group row */}
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAF6F3]/40">
                  <button
                    type="button"
                    onClick={() => toggleExpand(g.id)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <svg
                      className={`h-4 w-4 flex-shrink-0 text-stone-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-xs font-semibold text-stone-700">
                      {g.code}
                    </span>
                    <span className="font-medium text-stone-800">{g.name}</span>
                    <span className="ml-1 text-xs text-stone-400">
                      {gCats.length} subcategoria{gCats.length !== 1 ? "s" : ""}
                    </span>
                  </button>
                  <ActiveBadge isActive={g.isActive} />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Editar"
                      onClick={() => onEditGroup(g)}
                      className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                    >
                      <EditIcon />
                    </button>
                    <ToggleBtn
                      isActive={g.isActive}
                      disabled={togglingGroup === g.id}
                      onClick={() => onToggleGroup(g)}
                    />
                  </div>
                </div>

                {/* Expanded categories */}
                {isExpanded && (
                  <div className="border-t border-stone-50 bg-stone-50/30">
                    {gCats.length === 0 ? (
                      <p className="px-12 py-4 text-xs text-stone-400">Nenhuma subcategoria neste grupo.</p>
                    ) : (
                      <div className="divide-y divide-stone-50">
                        {gCats.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center gap-3 py-2.5 pl-12 pr-4 hover:bg-[#FAF6F3]/40"
                          >
                            <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-600">
                              {c.code}
                            </span>
                            <span className="flex-1 text-sm text-stone-700">{c.name}</span>
                            <FinancialTypeBadge type={c.financialType} />
                            <div className="flex items-center gap-1.5">
                              {c.affectsDre && (
                                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-600">
                                  DRE
                                </span>
                              )}
                              {c.affectsCashflow && (
                                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">
                                  Fluxo
                                </span>
                              )}
                              {c.affectsProfitability && (
                                <span className="rounded bg-purple-50 px-1.5 py-0.5 text-xs text-purple-600">
                                  Rent.
                                </span>
                              )}
                            </div>
                            <ActiveBadge isActive={c.isActive} />
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                title="Editar"
                                onClick={() => onEditCategory(c)}
                                className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                              >
                                <EditIcon />
                              </button>
                              <ToggleBtn
                                isActive={c.isActive}
                                disabled={togglingCategory === c.id}
                                onClick={() => onToggleCategory(c)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-end px-4 py-2">
                      <button
                        type="button"
                        onClick={() => onAddCategory(g.id)}
                        className="flex items-center gap-1.5 text-xs font-medium text-[#ED5C32] transition-colors hover:text-[#A3211A]"
                      >
                        <PlusSmIcon />
                        Adicionar subcategoria
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab 2: Regras Financeiras ──────────────────────────────────────────────────

interface Tab2Props {
  groups: CostCenterGroup[];
  categories: CostCenterCategory[];
  onEditCategory: (c: CostCenterCategory) => void;
  onToggleCategory: (c: CostCenterCategory) => void;
  togglingCategory: string | null;
}

function Tab2Regras({
  groups,
  categories,
  onEditCategory,
  onToggleCategory,
  togglingCategory,
}: Tab2Props) {
  const [filterGroup,  setFilterGroup]  = useState("");
  const [filterType,   setFilterType]   = useState<FinancialType | "">("");
  const [filterActive, setFilterActive] = useState<"" | "true" | "false">("");

  const groupMap = new Map(groups.map((g) => [g.id, g]));

  const filtered = categories.filter((c) => {
    if (filterGroup && c.groupId !== filterGroup) return false;
    if (filterType  && c.financialType !== filterType) return false;
    if (filterActive === "true"  && !c.isActive) return false;
    if (filterActive === "false" && c.isActive)  return false;
    return true;
  });

  const hasFilters = filterGroup !== "" || filterType !== "" || filterActive !== "";

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 shadow-sm outline-none transition focus:border-[#ED5C32]"
        >
          <option value="">Todos os grupos</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.code} — {g.name}
            </option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FinancialType | "")}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 shadow-sm outline-none transition focus:border-[#ED5C32]"
        >
          <option value="">Todos os tipos</option>
          {ALL_FINANCIAL_TYPES.map((t) => (
            <option key={t} value={t}>{FINANCIAL_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value as "" | "true" | "false")}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 shadow-sm outline-none transition focus:border-[#ED5C32]"
        >
          <option value="">Todos os estados</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={() => { setFilterGroup(""); setFilterType(""); setFilterActive(""); }}
            className="text-sm text-stone-400 transition-colors hover:text-stone-600"
          >
            Limpar filtros
          </button>
        )}
        <span className="ml-auto text-sm text-stone-400">
          {filtered.length} subcategoria{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[#F5C992]/40 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-stone-400">
            {hasFilters ? "Sem resultados para os filtros aplicados." : "Nenhuma subcategoria ainda."}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/60 text-left font-semibold uppercase tracking-wide text-stone-400">
                <th className="px-3 py-3">Código</th>
                <th className="px-3 py-3">Subcategoria</th>
                <th className="px-3 py-3">Grupo</th>
                <th className="px-3 py-3">Tipo financeiro</th>
                <th className="px-3 py-3 text-center">DRE</th>
                <th className="px-3 py-3 text-center">Fluxo</th>
                <th className="px-3 py-3 text-center">Rent.</th>
                <th className="px-3 py-3 text-center">Canal</th>
                <th className="px-3 py-3 text-center">Rateio</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map((c) => {
                const group = groupMap.get(c.groupId);
                return (
                  <tr key={c.id} className="group hover:bg-[#FAF6F3]/60">
                    <td className="px-3 py-2.5">
                      <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono font-medium text-stone-600">
                        {c.code}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-stone-800">{c.name}</td>
                    <td className="px-3 py-2.5">
                      {group ? (
                        <span className="rounded bg-stone-50 px-1.5 py-0.5 font-mono text-stone-500">
                          {group.code}
                        </span>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <FinancialTypeBadge type={c.financialType} />
                    </td>
                    <td className="px-3 py-2.5"><BoolIcon value={c.affectsDre} /></td>
                    <td className="px-3 py-2.5"><BoolIcon value={c.affectsCashflow} /></td>
                    <td className="px-3 py-2.5"><BoolIcon value={c.affectsProfitability} /></td>
                    <td className="px-3 py-2.5"><BoolIcon value={c.requiresChannel} /></td>
                    <td className="px-3 py-2.5"><BoolIcon value={c.requiresAllocation} /></td>
                    <td className="px-3 py-2.5"><ActiveBadge isActive={c.isActive} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          title="Editar"
                          onClick={() => onEditCategory(c)}
                          className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                        >
                          <EditIcon />
                        </button>
                        <ToggleBtn
                          isActive={c.isActive}
                          disabled={togglingCategory === c.id}
                          onClick={() => onToggleCategory(c)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Tab 3: Aplicação em Faturas ────────────────────────────────────────────────

interface Tab3Props {
  groups: CostCenterGroup[];
  categories: CostCenterCategory[];
  suppliers: Supplier[];
  invoices: InvoiceDTO[];
}

function FlagBadge({ value, yes }: { value: boolean; yes: string }) {
  if (value) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${yes}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
        Sim
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-400">
      <span className="h-1.5 w-1.5 rounded-full bg-stone-300" />
      Não
    </span>
  );
}

function Tab3Aplicacao({ groups, categories, suppliers, invoices }: Tab3Props) {
  const { api: invoicesApi } = useInvoicesModule();
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);

  const { data: lines = [] } = useQuery<InvoiceLineDTO[]>({
    queryKey: ["invoice-lines-all"],
    queryFn: () => invoicesApi.listInvoiceLines(),
  });

  const invoiceMap   = new Map(invoices.map((inv) => [inv.id, inv]));
  const supplierMap  = new Map(suppliers.map((s) => [s.id, s]));
  const groupMap     = new Map(groups.map((g) => [g.id, g]));
  const categoryMap  = new Map(categories.map((c) => [c.id, c]));

  // Aggregate lines by costCenterCategoryId
  type CatRow = {
    categoryId: string;
    totalWithoutVat: number;
    invoiceIds: Set<string>;
    supplierNames: Set<string>;
    // invoice breakdown for expand: invoiceId → subtotal in this category
    byInvoice: Map<string, number>;
  };

  const catMap = new Map<string, CatRow>();
  for (const line of lines) {
    if (!line.costCenterCategoryId) continue;
    const inv = invoiceMap.get(line.invoiceId);
    if (!inv) continue;
    const catId = line.costCenterCategoryId;
    if (!catMap.has(catId)) {
      catMap.set(catId, { categoryId: catId, totalWithoutVat: 0, invoiceIds: new Set(), supplierNames: new Set(), byInvoice: new Map() });
    }
    const row = catMap.get(catId)!;
    const lineSubtotal = line.unitCostWithoutVat * line.quantity;
    row.totalWithoutVat += lineSubtotal;
    row.invoiceIds.add(line.invoiceId);
    if (inv.supplierName) row.supplierNames.add(inv.supplierName);
    row.byInvoice.set(line.invoiceId, (row.byInvoice.get(line.invoiceId) ?? 0) + lineSubtotal);
  }

  const rows = [...catMap.values()]
    .map((r) => ({ ...r, category: categoryMap.get(r.categoryId), group: undefined as CostCenterGroup | undefined }))
    .map((r) => ({ ...r, group: r.category ? groupMap.get(r.category.groupId) : undefined }))
    .filter((r) => r.category && r.group)
    .sort((a, b) => (a.group!.code + a.category!.code).localeCompare(b.group!.code + b.category!.code));

  const fmt = (cents: number) =>
    (cents / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });

  return (
    <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white shadow-sm">
      <div className="border-b border-[#F5C992]/40 px-5 py-3">
        <h3 className="text-sm font-semibold text-stone-800">Lançamentos classificados</h3>
        <p className="mt-0.5 text-xs text-stone-400">
          Despesas agrupadas por subcategoria de centro de custo, com base nas linhas de fatura reais.
          Clique numa linha para ver as faturas que a compõem.
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 py-12">
          <p className="text-sm text-stone-400">Nenhuma linha de fatura classificada encontrada.</p>
          <p className="text-xs text-stone-400">Classifique as linhas de fatura para ver os dados aqui.</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50/60 text-left text-xs font-semibold uppercase tracking-wide text-stone-400">
              <th className="px-4 py-3">Grupo</th>
              <th className="px-4 py-3">Subcategoria</th>
              <th className="px-4 py-3 text-center">Faturas</th>
              <th className="px-4 py-3">Fornecedores</th>
              <th className="px-4 py-3 text-right">Total s/ IVA</th>
              <th className="px-4 py-3 text-center">DRE</th>
              <th className="px-4 py-3 text-center">Fluxo</th>
              <th className="px-4 py-3 text-center">Rentab.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isOpen = expandedCatId === row.categoryId;
              const cat    = row.category!;
              const grp    = row.group!;
              return (
                <Fragment key={row.categoryId}>
                  {/* Summary row */}
                  <tr
                    onClick={() => setExpandedCatId(isOpen ? null : row.categoryId)}
                    className="cursor-pointer border-t border-stone-100 hover:bg-[#FAF6F3]/60"
                  >
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-600">
                        {grp.code}
                      </span>
                      <span className="ml-1.5 text-xs text-stone-500">{grp.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-stone-700">{cat.code}</span>
                      <span className="ml-1 text-xs text-stone-400">— {cat.name}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center rounded-full bg-[#FDF0E8] px-2.5 py-0.5 text-xs font-semibold text-[#ED5C32]">
                        {row.invoiceIds.size}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-stone-500">
                      {[...row.supplierNames].join(", ")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-stone-800">
                      {fmt(row.totalWithoutVat)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <FlagBadge value={cat.affectsDre} yes="bg-emerald-50 text-emerald-700" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <FlagBadge value={cat.affectsCashflow} yes="bg-blue-50 text-blue-700" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <FlagBadge value={cat.affectsProfitability} yes="bg-purple-50 text-purple-700" />
                    </td>
                  </tr>

                  {/* Expanded invoices */}
                  {isOpen && (
                    <tr className="border-t border-stone-100 bg-[#FAF6F3]/40">
                      <td colSpan={8} className="px-6 py-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                          Faturas que contribuem para {cat.code}
                        </p>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-stone-400">
                              <th className="pb-1.5 pr-8">Documento</th>
                              <th className="pb-1.5 pr-8">Fornecedor</th>
                              <th className="pb-1.5 pr-8">Data</th>
                              <th className="pb-1.5 text-right">Valor s/ IVA nesta cat.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {[...row.byInvoice.entries()].map(([invId, subtotal]) => {
                              const inv = invoiceMap.get(invId);
                              if (!inv) return null;
                              const sup = inv.supplierId ? supplierMap.get(inv.supplierId) : null;
                              return (
                                <tr key={invId}>
                                  <td className="py-1.5 pr-8 font-mono text-stone-600">{inv.invoiceNumber}</td>
                                  <td className="py-1.5 pr-8 font-medium text-stone-700">
                                    {sup?.name ?? inv.supplierName}
                                  </td>
                                  <td className="py-1.5 pr-8 text-stone-500">{inv.invoiceDate}</td>
                                  <td className="py-1.5 text-right tabular-nums font-medium text-stone-800">
                                    {fmt(subtotal)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Tab 4: Cadastro Essencial ──────────────────────────────────────────────────

interface Tab4Props {
  groups: CostCenterGroup[];
  categories: CostCenterCategory[];
  onNewGroup: () => void;
  onEditGroup: (g: CostCenterGroup) => void;
  onToggleGroup: (g: CostCenterGroup) => void;
  onNewCategory: () => void;
  onEditCategory: (c: CostCenterCategory) => void;
  onToggleCategory: (c: CostCenterCategory) => void;
  onSeed: () => void;
  seeding: boolean;
  seedResult: SeedResult | null;
  togglingGroup: string | null;
  togglingCategory: string | null;
}

function Tab4Cadastro({
  groups,
  categories,
  onNewGroup,
  onEditGroup,
  onToggleGroup,
  onNewCategory,
  onEditCategory,
  onToggleCategory,
  onSeed,
  seeding,
  seedResult,
  togglingGroup,
  togglingCategory,
}: Tab4Props) {
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  return (
    <div className="flex flex-col gap-6">
      {/* Seed */}
      {groups.length === 0 ? (
        <div className="rounded-xl border border-[#F5C992]/60 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-stone-800">Carregar dados padrão</h3>
          <p className="mt-1 text-sm text-stone-500">
            Popule automaticamente os 7 grupos e 28 subcategorias padrão. Esta operação é idempotente
            — pode ser executada múltiplas vezes sem duplicar dados.
          </p>
          <button
            type="button"
            onClick={onSeed}
            disabled={seeding}
            className="mt-4 flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {seeding ? "A carregar…" : "Carregar dados padrão (seed)"}
          </button>
          {seedResult && (
            <p className="mt-2 text-xs text-emerald-600">
              {seedResult.groupsCreated} grupo{seedResult.groupsCreated !== 1 ? "s" : ""} e{" "}
              {seedResult.categoriesCreated} subcategoria{seedResult.categoriesCreated !== 1 ? "s" : ""} criados.
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl border border-stone-100 bg-white px-5 py-3 shadow-sm">
          <div>
            <span className="text-sm font-medium text-stone-700">Seed de dados padrão</span>
            <span className="ml-2 text-xs text-stone-400">(idempotente — seguro re-executar)</span>
          </div>
          <div className="flex items-center gap-3">
            {seedResult && (
              <span className="text-xs text-emerald-600">
                {seedResult.groupsCreated}g + {seedResult.categoriesCreated}s criados
              </span>
            )}
            <button
              type="button"
              onClick={onSeed}
              disabled={seeding}
              className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-60"
            >
              {seeding ? "A carregar…" : "Re-executar seed"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Groups */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-700">Grupos ({groups.length})</h3>
            <button
              type="button"
              onClick={onNewGroup}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <PlusSmIcon />
              Novo grupo
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white shadow-sm">
            {groups.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-sm text-stone-400">
                Sem grupos.
              </div>
            ) : (
              <div className="divide-y divide-stone-50">
                {groups.map((g) => (
                  <div
                    key={g.id}
                    className="group flex items-center gap-3 px-4 py-3 hover:bg-[#FAF6F3]/40"
                  >
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-stone-700">
                      {g.code}
                    </span>
                    <span className="flex-1 text-sm font-medium text-stone-800">{g.name}</span>
                    <span className="text-xs text-stone-400">
                      {categories.filter((c) => c.groupId === g.id).length} sub
                    </span>
                    <ActiveBadge isActive={g.isActive} />
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => onEditGroup(g)}
                        className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                      >
                        <EditIcon />
                      </button>
                      <ToggleBtn
                        isActive={g.isActive}
                        disabled={togglingGroup === g.id}
                        onClick={() => onToggleGroup(g)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-700">Subcategorias ({categories.length})</h3>
            <button
              type="button"
              onClick={onNewCategory}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <PlusSmIcon />
              Nova subcategoria
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white shadow-sm">
            {categories.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-sm text-stone-400">
                Sem subcategorias.
              </div>
            ) : (
              <div className="max-h-[480px] divide-y divide-stone-50 overflow-y-auto">
                {categories.map((c) => {
                  const group = groupMap.get(c.groupId);
                  return (
                    <div
                      key={c.id}
                      className="group flex items-center gap-2.5 px-4 py-2.5 hover:bg-[#FAF6F3]/40"
                    >
                      <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs text-stone-600">
                        {c.code}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-stone-800">{c.name}</span>
                      {group && (
                        <span className="text-xs text-stone-400">{group.code}</span>
                      )}
                      <ActiveBadge isActive={c.isActive} />
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => onEditCategory(c)}
                          className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                        >
                          <EditIcon />
                        </button>
                        <ToggleBtn
                          isActive={c.isActive}
                          disabled={togglingCategory === c.id}
                          onClick={() => onToggleCategory(c)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

type MainTab = "estrutura" | "regras" | "aplicacao" | "cadastro";

const TABS: { id: MainTab; label: string }[] = [
  { id: "estrutura", label: "Estrutura Essencial" },
  { id: "regras",    label: "Regras Financeiras" },
  { id: "aplicacao", label: "Aplicação em Faturas" },
  { id: "cadastro",  label: "Cadastro Essencial" },
];

export function CostCentersView() {
  const { api } = useFinancialBaseModule();
  const { api: invoicesApi } = useInvoicesModule();
  const qc = useQueryClient();

  const [tab, setTab] = useState<MainTab>("estrutura");

  // Drawer state — use keys to reset internal form state on each open
  const [groupDrawerOpen,    setGroupDrawerOpen]    = useState(false);
  const [editingGroup,       setEditingGroup]       = useState<CostCenterGroup | null>(null);
  const [catDrawerOpen,      setCatDrawerOpen]      = useState(false);
  const [editingCategory,    setEditingCategory]    = useState<CostCenterCategory | null>(null);
  const [newCatDefaultGroup, setNewCatDefaultGroup] = useState<string | undefined>(undefined);

  const [togglingGroup,    setTogglingGroup]    = useState<string | null>(null);
  const [togglingCategory, setTogglingCategory] = useState<string | null>(null);

  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);

  // Queries
  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ["cost-center-groups"],
    queryFn: () => api.listCostCenterGroups(),
  });

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["cost-center-categories"],
    queryFn: () => api.listCostCenterCategories(),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.listSuppliers(),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => invoicesApi.listInvoices(),
  });

  // Mutations
  const saveGroupMutation = useMutation({
    mutationFn: ({
      payload,
      id,
    }: {
      payload: CreateCostCenterGroupPayload | UpdateCostCenterGroupPayload;
      id?: string;
    }) =>
      id
        ? api.updateCostCenterGroup(id, payload as UpdateCostCenterGroupPayload)
        : api.createCostCenterGroup(payload as CreateCostCenterGroupPayload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cost-center-groups"] });
      setGroupDrawerOpen(false);
      setEditingGroup(null);
    },
  });

  const saveCategoryMutation = useMutation({
    mutationFn: ({
      payload,
      id,
    }: {
      payload: CreateCostCenterCategoryPayload | UpdateCostCenterCategoryPayload;
      id?: string;
    }) =>
      id
        ? api.updateCostCenterCategory(id, payload as UpdateCostCenterCategoryPayload)
        : api.createCostCenterCategory(payload as CreateCostCenterCategoryPayload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cost-center-categories"] });
      setCatDrawerOpen(false);
      setEditingCategory(null);
      setNewCatDefaultGroup(undefined);
    },
  });

  const toggleGroupMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.setCostCenterGroupStatus(id, isActive),
    onMutate: ({ id }) => setTogglingGroup(id),
    onSettled: () => setTogglingGroup(null),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["cost-center-groups"] }),
  });

  const toggleCategoryMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.setCostCenterCategoryStatus(id, isActive),
    onMutate: ({ id }) => setTogglingCategory(id),
    onSettled: () => setTogglingCategory(null),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["cost-center-categories"] }),
  });

  const seedMutation = useMutation({
    mutationFn: () => api.seedDefaultCostCenters(),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["cost-center-groups"] });
      void qc.invalidateQueries({ queryKey: ["cost-center-categories"] });
      setSeedResult(result);
    },
  });

  function openEditGroup(g: CostCenterGroup) {
    setEditingGroup(g);
    setGroupDrawerOpen(true);
  }

  function openEditCategory(c: CostCenterCategory) {
    setEditingCategory(c);
    setCatDrawerOpen(true);
  }

  function openNewCategory(groupId?: string) {
    setEditingCategory(null);
    setNewCatDefaultGroup(groupId);
    setCatDrawerOpen(true);
  }

  const isLoading = loadingGroups || loadingCategories;

  const groupDrawerKey = `group-${editingGroup?.id ?? "new"}`;
  const catDrawerKey   = `cat-${editingCategory?.id ?? "new"}-${newCatDefaultGroup ?? "none"}`;

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      {/* Header */}
      <div className="border-b border-[#F5C992]/40 bg-white px-6 pt-4">
        <div className="flex items-center justify-between pb-4">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Centros de Custo</h1>
            <p className="mt-0.5 text-sm text-stone-500">
              Estruture despesas em grupos e subcategorias com regras financeiras precisas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setEditingGroup(null); setGroupDrawerOpen(true); }}
              className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 shadow-sm transition-colors hover:bg-stone-50"
            >
              + Novo grupo
            </button>
            <button
              type="button"
              onClick={() => openNewCategory()}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              Nova subcategoria
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`mr-6 border-b-2 pb-3 text-sm font-medium transition-colors ${
                tab === id
                  ? "border-[#ED5C32] text-[#ED5C32]"
                  : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-sm text-stone-400">
            A carregar…
          </div>
        ) : (
          <>
            {tab === "estrutura" && (
              <Tab1Estrutura
                groups={groups}
                categories={categories}
                onEditGroup={openEditGroup}
                onToggleGroup={(g) => toggleGroupMutation.mutate({ id: g.id, isActive: !g.isActive })}
                onEditCategory={openEditCategory}
                onToggleCategory={(c) => toggleCategoryMutation.mutate({ id: c.id, isActive: !c.isActive })}
                onAddCategory={(groupId) => openNewCategory(groupId)}
                togglingGroup={togglingGroup}
                togglingCategory={togglingCategory}
              />
            )}
            {tab === "regras" && (
              <Tab2Regras
                groups={groups}
                categories={categories}
                onEditCategory={openEditCategory}
                onToggleCategory={(c) => toggleCategoryMutation.mutate({ id: c.id, isActive: !c.isActive })}
                togglingCategory={togglingCategory}
              />
            )}
            {tab === "aplicacao" && (
              <Tab3Aplicacao
                groups={groups}
                categories={categories}
                suppliers={suppliers}
                invoices={invoices}
              />
            )}
            {tab === "cadastro" && (
              <Tab4Cadastro
                groups={groups}
                categories={categories}
                onNewGroup={() => { setEditingGroup(null); setGroupDrawerOpen(true); }}
                onEditGroup={openEditGroup}
                onToggleGroup={(g) => toggleGroupMutation.mutate({ id: g.id, isActive: !g.isActive })}
                onNewCategory={() => openNewCategory()}
                onEditCategory={openEditCategory}
                onToggleCategory={(c) => toggleCategoryMutation.mutate({ id: c.id, isActive: !c.isActive })}
                onSeed={() => seedMutation.mutate()}
                seeding={seedMutation.isPending}
                seedResult={seedResult}
                togglingGroup={togglingGroup}
                togglingCategory={togglingCategory}
              />
            )}
          </>
        )}
      </div>

      {/* Drawers — keyed so state resets on each open */}
      <GroupDrawer
        key={groupDrawerKey}
        open={groupDrawerOpen}
        editing={editingGroup}
        onClose={() => { setGroupDrawerOpen(false); setEditingGroup(null); }}
        onSave={(payload, id) => saveGroupMutation.mutate({ payload, id })}
        saving={saveGroupMutation.isPending}
      />
      <CategoryDrawer
        key={catDrawerKey}
        open={catDrawerOpen}
        editing={editingCategory}
        groups={groups}
        defaultGroupId={newCatDefaultGroup}
        onClose={() => { setCatDrawerOpen(false); setEditingCategory(null); setNewCatDefaultGroup(undefined); }}
        onSave={(payload, id) => saveCategoryMutation.mutate({ payload, id })}
        saving={saveCategoryMutation.isPending}
      />

      <PageFooter />
    </div>
  );
}
