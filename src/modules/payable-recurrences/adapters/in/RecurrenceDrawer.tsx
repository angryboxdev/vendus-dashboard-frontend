import { useState, useEffect, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { NumericInput } from "../../../../components/NumericInput.tsx";
import { useFinancialBaseModule } from "../../../financial-base/financial-base.module.tsx";
import type {
  RecurrenceDTO,
  RecurrenceType,
  RecurrenceFrequency,
  PaymentMethod,
  CreateRecurrencePayload,
  UpdateRecurrencePayload,
} from "../../domain/entities/recurrence.ts";
import type { CostCenterCategory } from "../../../financial-base/domain/entities/cost-center.ts";
import {
  RECURRENCE_TYPE_LABELS,
  RECURRENCE_FREQUENCY_LABELS,
  PAYMENT_METHOD_LABELS,
} from "../../domain/entities/recurrence.ts";

const inputCls =
  "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30";
const labelCls = "block text-xs font-medium text-stone-500 mb-1";

interface Toggle {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({ label, description, value, onChange, disabled }: Toggle) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className={`text-sm font-medium ${disabled ? "text-stone-400" : "text-stone-700"}`}>
          {label}
        </p>
        <p className="text-xs text-stone-400">{description}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          value && !disabled ? "bg-[#ED5C32]" : "bg-stone-200"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <span
          className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-[22px]" : "translate-x-[2px]"
          }`}
        />
      </button>
    </div>
  );
}

interface RecurrenceDrawerProps {
  open: boolean;
  editing: RecurrenceDTO | null;
  saving: boolean;
  onClose: () => void;
  onCreate: (payload: CreateRecurrencePayload, file: File | null) => void;
  onUpdate: (id: string, payload: UpdateRecurrencePayload) => void;
}

export function RecurrenceDrawer({
  open,
  editing,
  saving,
  onClose,
  onCreate,
  onUpdate,
}: RecurrenceDrawerProps) {
  const { api: baseApi } = useFinancialBaseModule();
  const isEdit = editing !== null;

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: () => baseApi.listSuppliers({ status: "active" }),
    enabled: open,
  });

  const { data: costCenterGroups = [] } = useQuery({
    queryKey: ["cost-center-groups-active"],
    queryFn: () => baseApi.listCostCenterGroups({ isActive: true }),
    enabled: open,
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ["cost-center-categories-active"],
    queryFn: () => baseApi.listCostCenterCategories({ isActive: true }),
    enabled: open,
  });

  // Form state
  const [name, setName] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [type, setType] = useState<RecurrenceType>("fixed_contract");
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("monthly");
  const [costCenterId, setCostCenterId] = useState("");
  const [costCenterCategoryId, setCostCenterCategoryId] = useState("");
  const [category, setCategory] = useState("");
  const [estimatedAmount, setEstimatedAmount] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("transfer");
  const [requireInvoice, setRequireInvoice] = useState(false);
  const [notes, setNotes] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);

  // Categories filtered by selected cost center group
  const filteredCategories = costCenterId
    ? allCategories.filter((c: CostCenterCategory) => c.groupId === costCenterId)
    : [];

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setSupplierId(editing.supplierId ?? "");
      setSupplierName(editing.supplierName);
      setType(editing.type);
      setFrequency(editing.frequency);
      setCostCenterId(editing.costCenterId ?? "");
      setCostCenterCategoryId(editing.costCenterCategoryId ?? "");
      setCategory(editing.category ?? "");
      setEstimatedAmount(String(editing.estimatedAmountCents / 100));
      setDayOfMonth(String(editing.dayOfMonth));
      setEndDate(editing.endDate ?? "");
      setPaymentMethod(editing.paymentMethod);
      setRequireInvoice(editing.requireInvoice);
      setNotes(editing.notes ?? "");
      setDocFile(null);
    } else {
      setName("");
      setSupplierId("");
      setSupplierName("");
      setType("fixed_contract");
      setFrequency("monthly");
      setCostCenterId("");
      setCostCenterCategoryId("");
      setCategory("");
      setEstimatedAmount("");
      setDayOfMonth("1");
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndDate("");
      setPaymentMethod("transfer");
      setRequireInvoice(false);
      setNotes("");
      setDocFile(null);
    }
  }, [open, editing]);

  function handleSupplierChange(id: string) {
    setSupplierId(id);
    const s = suppliers.find((s) => s.id === id);
    setSupplierName(s?.name ?? "");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amountCents = Math.round((parseFloat(estimatedAmount) || 0) * 100);
    const selectedSupplier = supplierId
      ? suppliers.find((s) => s.id === supplierId)
      : null;
    const resolvedSupplierName = selectedSupplier?.name ?? supplierName;

    if (isEdit) {
      const payload: UpdateRecurrencePayload = {
        name,
        supplierId: supplierId || null,
        supplierName: resolvedSupplierName,
        costCenterId: costCenterId || null,
        costCenterCategoryId: costCenterCategoryId || null,
        category: category || null,
        estimatedAmountCents: amountCents,
        dayOfMonth: parseInt(dayOfMonth, 10),
        endDate: endDate || null,
        paymentMethod,
        requireInvoice,
        notes: notes || null,
      };
      onUpdate(editing!.id, payload);
    } else {
      const payload: CreateRecurrencePayload = {
        name,
        supplierId: supplierId || null,
        supplierName: resolvedSupplierName,
        type,
        frequency,
        costCenterId: costCenterId || null,
        costCenterCategoryId: costCenterCategoryId || null,
        category: category || null,
        estimatedAmountCents: amountCents,
        dayOfMonth: parseInt(dayOfMonth, 10),
        startDate,
        endDate: endDate || null,
        paymentMethod,
        requireInvoice,
        notes: notes || null,
      };
      onCreate(payload, docFile);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" aria-modal="true">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="flex h-full w-full max-w-lg min-w-0 flex-col overflow-x-hidden bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#F5C992]/40 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-stone-800">
              {isEdit ? "Editar recorrência" : "Nova recorrência"}
            </h2>
            <p className="text-xs text-stone-400">
              {isEdit
                ? "Edite os campos que pretende atualizar."
                : "Defina um pagamento recorrente e mantenha o controlo das suas despesas fixas."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-y-auto px-6 py-4"
        >
          <div className="flex-1 space-y-4">

            {/* Nome + Fornecedor */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Nome da recorrência *</label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                  placeholder="Ex: Renda / Aluguer"
                />
              </div>
              <div>
                <label className={labelCls}>Fornecedor *</label>
                <select
                  required={!supplierId && !supplierName}
                  value={supplierId}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Selecionar fornecedor</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Tipo + Centro de custo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Tipo / origem</label>
                {isEdit ? (
                  <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">
                    {RECURRENCE_TYPE_LABELS[type]}
                  </p>
                ) : (
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as RecurrenceType)}
                    className={inputCls}
                  >
                    {(Object.entries(RECURRENCE_TYPE_LABELS) as [RecurrenceType, string][]).map(
                      ([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ),
                    )}
                  </select>
                )}
              </div>
              <div>
                <label className={labelCls}>Centro de custo *</label>
                <select
                  value={costCenterId}
                  onChange={(e) => {
                    setCostCenterId(e.target.value);
                    setCostCenterCategoryId(""); // reset sub-categoria ao mudar grupo
                  }}
                  className={inputCls}
                >
                  <option value="">Selecionar centro de custo</option>
                  {costCenterGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.code} — {g.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Sub-categoria do CC (só aparece quando há grupo selecionado com categorias) */}
            {filteredCategories.length > 0 && (
              <div>
                <label className={labelCls}>Sub-categoria (opcional)</label>
                <select
                  value={costCenterCategoryId}
                  onChange={(e) => setCostCenterCategoryId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Selecionar sub-categoria</option>
                  {filteredCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Valor + Frequência + Dia de vencimento */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Valor estimado (€) *</label>
                <NumericInput
                  required
                  value={estimatedAmount}
                  onChange={(e) => setEstimatedAmount(e.target.value)}
                  className={inputCls}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className={labelCls}>Frequência</label>
                {isEdit ? (
                  <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">
                    {RECURRENCE_FREQUENCY_LABELS[frequency]}
                  </p>
                ) : (
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
                    className={inputCls}
                  >
                    {(
                      Object.entries(RECURRENCE_FREQUENCY_LABELS) as [
                        RecurrenceFrequency,
                        string,
                      ][]
                    ).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className={labelCls}>Dia de vencimento *</label>
                <select
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Selecione</option>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      Dia {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Data de início + Data de fim */}
            <div className="grid grid-cols-2 gap-3">
              {!isEdit && (
                <div>
                  <label className={labelCls}>Data de início *</label>
                  <input
                    required
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
              )}
              <div className={isEdit ? "col-span-2" : ""}>
                <label className={labelCls}>Data de fim (opcional)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Método de pagamento + Documento base */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Método de pagamento *</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className={inputCls}
                >
                  {(
                    Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]
                  ).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              {!isEdit && (
                <div className="min-w-0">
                  <label className={labelCls}>Anexar contrato / doc. base (opcional)</label>
                  <label className="flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-stone-300 px-3 py-2 text-xs text-stone-500 hover:border-[#ED5C32] hover:text-[#ED5C32] transition-colors">
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
                      <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                    </svg>
                    <span className="min-w-0 truncate">
                      {docFile ? docFile.name : "PDF, JPG, PNG até 10 MB"}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="sr-only"
                      onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Categoria */}
            <div>
              <label className={labelCls}>Categoria (opcional)</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputCls}
                placeholder="Ex: Utilities, Rendas…"
              />
            </div>

            {/* Notas */}
            <div>
              <label className={labelCls}>Observações (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={500}
                className={inputCls}
                placeholder="Adicione notas ou informações relevantes sobre esta recorrência…"
              />
              <p className="mt-0.5 text-right text-xs text-stone-400">{notes.length}/500</p>
            </div>

            {/* Toggles */}
            <div className="rounded-lg border border-stone-100 bg-stone-50 p-4">
              <ToggleRow
                label="Exigir fatura antes de marcar como pago"
                description="A ocorrência só pode ser paga após vincular uma fatura."
                value={requireInvoice}
                onChange={setRequireInvoice}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-[#F5C992]/40 pt-4 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving
                ? "A guardar…"
                : isEdit
                ? "Guardar alterações"
                : "Criar recorrência"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
