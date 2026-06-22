import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFinancialBaseModule } from "../../financial-base.module.tsx";
import { useInvoicesModule } from "../../../invoices/invoices.module.tsx";
import { PageFooter } from "../../../../components/PageFooter.tsx";
import type { CostCenterGroup, CostCenterCategory } from "../../domain/entities/cost-center.ts";
import {
  type Supplier,
  type CreateSupplierPayload,
  type UpdateSupplierPayload,
} from "../../domain/entities/supplier.ts";

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "active" | "inactive" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${status === "active" ? "bg-emerald-500" : "bg-stone-400"}`}
      />
      {status === "active" ? "Ativo" : "Inativo"}
    </span>
  );
}

// ── Drawer (create / edit) ────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-[#ED5C32] focus:ring-1 focus:ring-[#ED5C32]/30";

interface DrawerProps {
  open: boolean;
  editing: Supplier | null;
  groups: CostCenterGroup[];
  categories: CostCenterCategory[];
  onClose: () => void;
  onSave: (payload: CreateSupplierPayload | UpdateSupplierPayload, id?: string) => void;
  saving: boolean;
}

function SupplierDrawer({ open, editing, groups, categories, onClose, onSave, saving }: DrawerProps) {
  const isEdit = editing !== null;

  const [name,                     setName]                     = useState(editing?.name ?? "");
  const [nif,                      setNif]                      = useState(editing?.nif ?? "");
  const [email,                    setEmail]                    = useState(editing?.email ?? "");
  const [phone,                    setPhone]                    = useState(editing?.phone ?? "");
  const [address,                  setAddress]                  = useState(editing?.address ?? "");
  const [iban,                     setIban]                     = useState(editing?.iban ?? "");
  const [defaultGroupId,           setDefaultGroupId]           = useState(editing?.defaultCostCenterGroupId ?? "");
  const [defaultCategoryId,        setDefaultCategoryId]        = useState(editing?.defaultCostCenterCategoryId ?? "");
  const [paymentTermsDays,         setPaymentTermsDays]         = useState(
    editing?.paymentTermsDays != null ? String(editing.paymentTermsDays) : "",
  );
  const [notes,                    setNotes]                    = useState(editing?.notes ?? "");

  // Filter categories by selected group
  const filteredCategories = categories.filter(
    (c) => c.isActive && (!defaultGroupId || c.groupId === defaultGroupId),
  );

  function handleGroupChange(groupId: string) {
    setDefaultGroupId(groupId);
    setDefaultCategoryId(""); // reset category when group changes
  }

  function handleSubmit(e: React.FormEvent) {
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
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
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
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Aldeia Portugal"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">NIF</label>
              <input
                value={nif}
                onChange={(e) => setNif(e.target.value)}
                placeholder="500000000"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-stone-700">Telefone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+351 9xx xxx xxx"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contacto@fornecedor.pt"
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Morada</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, número, cidade"
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">IBAN</label>
            <input
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="PT50 0000 0000 0000 0000 0000 0"
              className={`${inputCls} font-mono`}
            />
          </div>

          {/* Centro de custo padrão — two cascading dropdowns */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              Grupo de CC padrão
            </label>
            <select
              value={defaultGroupId}
              onChange={(e) => handleGroupChange(e.target.value)}
              className={inputCls}
            >
              <option value="">Nenhum</option>
              {activeGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.code} — {g.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              Subcategoria de CC padrão
            </label>
            <select
              value={defaultCategoryId}
              onChange={(e) => setDefaultCategoryId(e.target.value)}
              disabled={!defaultGroupId}
              className={`${inputCls} disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400`}
            >
              <option value="">Nenhuma</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            {!defaultGroupId && (
              <p className="mt-1 text-xs text-stone-400">Selecione um grupo primeiro.</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              Prazo de pagamento (dias)
            </label>
            <input
              type="number"
              min={0}
              value={paymentTermsDays}
              onChange={(e) => setPaymentTermsDays(e.target.value)}
              placeholder="30"
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Informações adicionais…"
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
            {saving ? "A guardar…" : isEdit ? "Guardar alterações" : "Criar fornecedor"}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function SuppliersView() {
  const { api } = useFinancialBaseModule();
  const { api: invoicesApi } = useInvoicesModule();
  const qc = useQueryClient();

  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [editing,      setEditing]      = useState<Supplier | null>(null);
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState<"active" | "inactive" | "">("");

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.listSuppliers(),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["cost-center-groups"],
    queryFn: () => api.listCostCenterGroups(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["cost-center-categories"],
    queryFn: () => api.listCostCenterCategories(),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => invoicesApi.listInvoices(),
  });

  const groupMap    = new Map(groups.map((g) => [g.id, g]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const invoiceCountBySupplierId = invoices.reduce<Record<string, number>>((acc, inv) => {
    if (inv.supplierId) acc[inv.supplierId] = (acc[inv.supplierId] ?? 0) + 1;
    return acc;
  }, {});

  const saveMutation = useMutation({
    mutationFn: ({
      payload,
      id,
    }: {
      payload: CreateSupplierPayload | UpdateSupplierPayload;
      id?: string;
    }) =>
      id
        ? api.updateSupplier(id, payload as UpdateSupplierPayload)
        : api.createSupplier(payload as CreateSupplierPayload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["suppliers"] });
      setDrawerOpen(false);
      setEditing(null);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "inactive" }) =>
      api.setSupplierStatus(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });

  const filtered = suppliers.filter((s) => {
    if (filterStatus && s.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !s.name.toLowerCase().includes(q) &&
        !(s.nif ?? "").toLowerCase().includes(q) &&
        !(s.email ?? "").toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const hasFilters = search !== "" || filterStatus !== "";

  const drawerKey = `supplier-${editing?.id ?? "new"}`;

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      {/* Header */}
      <div className="border-b border-[#F5C992]/40 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-stone-900">Fornecedores</h1>
            <p className="mt-0.5 text-sm text-stone-500">
              Gerencie os fornecedores associados a faturas e centros de custo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setDrawerOpen(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Novo fornecedor
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                clipRule="evenodd"
              />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por nome, NIF ou email…"
              className="w-72 rounded-lg border border-stone-200 bg-white py-1.5 pl-9 pr-4 text-sm text-stone-700 shadow-sm outline-none transition focus:border-[#ED5C32]"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "active" | "inactive" | "")}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 shadow-sm outline-none transition focus:border-[#ED5C32]"
          >
            <option value="">Todos os estados</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={() => { setSearch(""); setFilterStatus(""); }}
              className="text-sm text-stone-400 transition-colors hover:text-stone-600"
            >
              Limpar filtros
            </button>
          )}

          <span className="ml-auto text-sm text-stone-400">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-[#F5C992]/40 bg-white shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-stone-400">
              A carregar…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16">
              <p className="text-sm font-medium text-stone-500">
                {hasFilters
                  ? "Sem resultados para os filtros aplicados."
                  : "Ainda não há fornecedores."}
              </p>
              {!hasFilters && (
                <button
                  type="button"
                  onClick={() => { setEditing(null); setDrawerOpen(true); }}
                  className="mt-1 text-sm font-medium text-[#ED5C32] transition-colors hover:text-[#A3211A]"
                >
                  Criar o primeiro
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/60 text-left text-xs font-semibold uppercase tracking-wide text-stone-400">
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">NIF</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">CC Padrão</th>
                  <th className="px-4 py-3 text-center">Faturas</th>
                  <th className="px-4 py-3">Prazo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {filtered.map((s) => {
                  const group    = s.defaultCostCenterGroupId    ? groupMap.get(s.defaultCostCenterGroupId)    : null;
                  const category = s.defaultCostCenterCategoryId ? categoryMap.get(s.defaultCostCenterCategoryId) : null;
                  return (
                    <tr key={s.id} className="group transition-colors hover:bg-[#FAF6F3]/60">
                      <td className="px-4 py-3">
                        <span className="font-medium text-stone-800">{s.name}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-stone-500">
                        {s.nif ?? <span className="text-stone-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {s.email ? (
                          <a
                            href={`mailto:${s.email}`}
                            className="text-stone-500 transition-colors hover:text-[#ED5C32]"
                          >
                            {s.email}
                          </a>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                        {s.phone && <p className="text-xs text-stone-400">{s.phone}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {group ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-600">
                              {group.code}
                            </span>
                            {category && (
                              <span className="text-xs text-stone-400">{category.code}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {invoiceCountBySupplierId[s.id] ? (
                          <span className="inline-flex items-center justify-center rounded-full bg-[#FDF0E8] px-2.5 py-0.5 text-xs font-semibold text-[#ED5C32]">
                            {invoiceCountBySupplierId[s.id]}
                          </span>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-stone-500">
                        {s.paymentTermsDays != null ? (
                          `${s.paymentTermsDays}d`
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            title="Editar"
                            onClick={() => { setEditing(s); setDrawerOpen(true); }}
                            className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                          >
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            title={s.status === "active" ? "Desativar" : "Ativar"}
                            onClick={() =>
                              toggleStatusMutation.mutate({
                                id: s.id,
                                status: s.status === "active" ? "inactive" : "active",
                              })
                            }
                            className={`rounded-lg p-1.5 transition-colors hover:bg-stone-100 ${
                              s.status === "active"
                                ? "text-stone-400 hover:text-red-500"
                                : "text-stone-400 hover:text-emerald-600"
                            }`}
                          >
                            {s.status === "active" ? (
                              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </button>
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

      <SupplierDrawer
        key={drawerKey}
        open={drawerOpen}
        editing={editing}
        groups={groups}
        categories={categories}
        onClose={() => { setDrawerOpen(false); setEditing(null); }}
        onSave={(payload, id) => saveMutation.mutate({ payload, id })}
        saving={saveMutation.isPending}
      />
      <PageFooter />
    </div>
  );
}
