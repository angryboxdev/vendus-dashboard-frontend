import { useState, type FormEvent } from "react";
import { NumericInput } from "../../../../components/NumericInput.tsx";
import type { CostCenterGroup, CostCenterCategory } from "../../domain/entities/cost-center.ts";
import type { Supplier, CreateSupplierPayload, UpdateSupplierPayload } from "../../domain/entities/supplier.ts";

const inputCls =
  "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30";

interface SupplierDrawerProps {
  open: boolean;
  editing: Supplier | null;
  groups: CostCenterGroup[];
  categories: CostCenterCategory[];
  onClose: () => void;
  onSave: (payload: CreateSupplierPayload | UpdateSupplierPayload, id?: string) => void;
  saving: boolean;
}

export function SupplierDrawer({ open, editing, groups, categories, onClose, onSave, saving }: SupplierDrawerProps) {
  const isEdit = editing !== null;

  const [name,              setName]              = useState(editing?.name ?? "");
  const [nif,               setNif]               = useState(editing?.nif ?? "");
  const [email,             setEmail]             = useState(editing?.email ?? "");
  const [phone,             setPhone]             = useState(editing?.phone ?? "");
  const [address,           setAddress]           = useState(editing?.address ?? "");
  const [iban,              setIban]              = useState(editing?.iban ?? "");
  const [defaultGroupId,    setDefaultGroupId]    = useState(editing?.defaultCostCenterGroupId ?? "");
  const [defaultCategoryId, setDefaultCategoryId] = useState(editing?.defaultCostCenterCategoryId ?? "");
  const [paymentTermsDays,  setPaymentTermsDays]  = useState(
    editing?.paymentTermsDays != null ? String(editing.paymentTermsDays) : "",
  );
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const filteredCategories = categories.filter(
    (c) => c.isActive && (!defaultGroupId || c.groupId === defaultGroupId),
  );

  function handleGroupChange(groupId: string) {
    setDefaultGroupId(groupId);
    setDefaultCategoryId("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      name,
      nif: nif || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      iban: iban || null,
      defaultCostCenterGroupId: defaultGroupId || null,
      defaultCostCenterCategoryId: defaultCategoryId || null,
      paymentTermsDays: paymentTermsDays ? Number(paymentTermsDays) : null,
      notes: notes || null,
    };
    onSave(payload, isEdit ? editing!.id : undefined);
  }

  if (!open) return null;

  const activeGroups = groups.filter((g) => g.isActive);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#F5C992]/40 px-6 py-4">
          <h2 className="text-base font-semibold text-stone-800">
            {isEdit ? "Editar fornecedor" : "Novo fornecedor"}
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

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              Nome <span className="text-red-500">*</span>
            </label>
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Aldeia Portugal" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">NIF</label>
              <input value={nif} onChange={(e) => setNif(e.target.value)} placeholder="500000000" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">Telefone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+351 9xx xxx xxx" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contacto@fornecedor.pt" className={inputCls} />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Morada</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, cidade" className={inputCls} />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">IBAN</label>
            <input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="PT50 0000 0000 0000 0000 0000 0" className={`${inputCls} font-mono`} />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Grupo de CC padrão</label>
            <select value={defaultGroupId} onChange={(e) => handleGroupChange(e.target.value)} className={inputCls}>
              <option value="">Nenhum</option>
              {activeGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Subcategoria de CC padrão</label>
            <select
              value={defaultCategoryId}
              onChange={(e) => setDefaultCategoryId(e.target.value)}
              disabled={!defaultGroupId}
              className={`${inputCls} disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400`}
            >
              <option value="">Nenhuma</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
              ))}
            </select>
            {!defaultGroupId && <p className="mt-1 text-xs text-stone-400">Selecione um grupo primeiro.</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Prazo de pagamento (dias)</label>
            <NumericInput
              decimals={0}
              value={paymentTermsDays}
              onChange={(e) => setPaymentTermsDays(e.target.value)}
              placeholder="30"
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Notas</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Informações adicionais…" className={inputCls} />
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 border-t border-stone-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            onClick={handleSubmit}
            className="rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity disabled:opacity-60"
          >
            {saving ? "A guardar…" : isEdit ? "Guardar alterações" : "Criar fornecedor"}
          </button>
        </div>
      </aside>
    </>
  );
}
