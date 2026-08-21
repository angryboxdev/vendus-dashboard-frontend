import { useState, useEffect, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { NumericInput } from "../../../../components/NumericInput.tsx";
import { useFinancialBaseModule } from "../../../financial-base/financial-base.module.tsx";
import {
  type CreateManualObligationPayload,
  type PaymentMethod,
  PAYMENT_METHOD_LABELS,
} from "../../domain/entities/financial-obligation.ts";

const inputCls =
  "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30";
const labelCls = "block text-xs font-medium text-stone-500 mb-1";

interface ManualObligationDrawerProps {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onCreate: (payload: CreateManualObligationPayload) => void;
}

export function ManualObligationDrawer({
  open,
  saving,
  onClose,
  onCreate,
}: ManualObligationDrawerProps) {
  const { api: baseApi } = useFinancialBaseModule();

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

  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [costCenterId, setCostCenterId] = useState("");

  useEffect(() => {
    if (!open) return;
    setSupplierId("");
    setSupplierName("");
    setDescription("");
    setAmount("");
    setDueDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("");
    setCostCenterId("");
  }, [open]);

  function handleSupplierChange(id: string) {
    setSupplierId(id);
    const s = suppliers.find((s) => s.id === id);
    setSupplierName(s?.name ?? "");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amountCents = Math.round((parseFloat(amount) || 0) * 100);
    const resolvedSupplierName =
      (supplierId ? suppliers.find((s) => s.id === supplierId)?.name : undefined) ??
      supplierName;

    const payload: CreateManualObligationPayload = {
      supplierId: supplierId || null,
      supplierName: resolvedSupplierName,
      description,
      amountCents,
      dueDate,
      paymentMethod: (paymentMethod as PaymentMethod) || null,
      costCenterId: costCenterId || null,
    };
    onCreate(payload);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" aria-modal="true">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md min-w-0 flex-col overflow-x-hidden bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#F5C992]/40 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-stone-800">Nova obrigação manual</h2>
            <p className="text-xs text-stone-400">
              Registe um pagamento avulso sem recorrência associada.
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

            {/* Fornecedor */}
            <div>
              <label className={labelCls}>Fornecedor</label>
              <select
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

            {/* Descrição */}
            <div>
              <label className={labelCls}>Descrição *</label>
              <input
                required
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputCls}
                placeholder="Ex: Despesa de manutenção"
              />
            </div>

            {/* Valor + Vencimento */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Valor (€) *</label>
                <NumericInput
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={inputCls}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className={labelCls}>Data de vencimento *</label>
                <input
                  required
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Método de pagamento */}
            <div>
              <label className={labelCls}>Método de pagamento</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | "")}
                className={inputCls}
              >
                <option value="">Não especificado</option>
                {(Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][]).map(
                  ([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ),
                )}
              </select>
            </div>

            {/* Centro de custo */}
            <div>
              <label className={labelCls}>Centro de custo</label>
              <select
                value={costCenterId}
                onChange={(e) => setCostCenterId(e.target.value)}
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

          {/* Footer */}
          <div className="mt-6 flex justify-end gap-3 border-t border-stone-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "A guardar…" : "Criar obrigação"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}
