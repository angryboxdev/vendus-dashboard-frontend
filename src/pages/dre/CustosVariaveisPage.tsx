import type {
  CustosVariaveisItem,
  CustosVariaveisPayload,
} from "./custosVariaveis.types";
import { apiDelete, apiPost, apiPut } from "../../lib/api";
import { useCallback, useEffect, useState } from "react";

import { MiniKpiCard } from "../../components/MiniKpiCard";
import { formatEUR } from "../../lib/format";
import { useDrePeriod } from "./DrePeriodContext";
import { useDreStore } from "./DreStoreContext";

type SectionKey = "producao" | "venda";

function sumValor(items: CustosVariaveisItem[]) {
  return items.reduce((a, i) => a + i.valor, 0);
}
function sumValorSemIva(items: CustosVariaveisItem[]) {
  return items.reduce((a, i) => a + i.valorSemIva, 0);
}

const EMPTY_PAYLOAD: CustosVariaveisPayload = {
  producao: [],
  venda: [],
};

export function CustosVariaveisPage() {
  const { period } = useDrePeriod();
  const {
    custosVariaveis,
    loadingCustosVariaveis: loading,
    loadCustosVariaveis,
  } = useDreStore();
  const data = custosVariaveis ?? EMPTY_PAYLOAD;
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    section: SectionKey;
    id: string;
  } | null>(null);
  const [pendingSave, setPendingSave] = useState<{
    section: SectionKey;
    existingId?: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState<SectionKey | null>(null);
  const [editForm, setEditForm] = useState<Omit<CustosVariaveisItem, "id">>({
    descricao: "",
    valor: 0,
    valorSemIva: 0,
    observacao: "",
  });

  useEffect(() => {
    loadCustosVariaveis();
  }, [loadCustosVariaveis]);

  const startEdit = useCallback((item: CustosVariaveisItem) => {
    setEditingId(item.id);
    setEditForm({
      descricao: item.descricao,
      valor: item.valor,
      valorSemIva: item.valorSemIva,
      observacao: item.observacao,
    });
    setAddingSection(null);
  }, []);

  const startAdd = useCallback((section: SectionKey) => {
    setAddingSection(section);
    setEditForm({
      descricao: "",
      valor: 0,
      valorSemIva: 0,
      observacao: "",
    });
    setEditingId(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setAddingSection(null);
  }, []);

  const saveEdit = useCallback(
    async (section: SectionKey, existingId?: string) => {
      setActionError(null);
      const qs = `year=${period.year}&month=${period.month}`;
      const baseUrl = `/api/reports/dre/custos-variaveis`;
      const payload = {
        descricao: editForm.descricao.trim(),
        valor: Number(editForm.valor) || 0,
        valorSemIva: Number(editForm.valorSemIva) || 0,
        observacao: editForm.observacao.trim(),
      };
      try {
        if (addingSection === section) {
          await apiPost(`${baseUrl}?${qs}`, { section, ...payload });
        } else {
          await apiPut(`${baseUrl}/${existingId}?${qs}`, {
            id: existingId,
            ...payload,
          });
        }
        setAddingSection(null);
        setEditingId(null);
        await loadCustosVariaveis(true);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Erro ao guardar");
      }
    },
    [period, editForm, addingSection, loadCustosVariaveis]
  );

  const deleteItem = useCallback(
    async (_section: SectionKey, id: string) => {
      setActionError(null);
      const qs = `year=${period.year}&month=${period.month}`;
      const baseUrl = `/api/reports/dre/custos-variaveis`;
      try {
        await apiDelete(`${baseUrl}/${id}?${qs}`);
        if (editingId === id) setEditingId(null);
        if (addingSection) setAddingSection(null);
        await loadCustosVariaveis(true);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Erro ao apagar");
      }
    },
    [period, editingId, addingSection, loadCustosVariaveis]
  );

  const requestDelete = useCallback((section: SectionKey, id: string) => {
    setPendingDelete({ section, id });
  }, []);

  const requestSave = useCallback(
    (section: SectionKey, existingId?: string) => {
      setPendingSave({ section, existingId });
    },
    []
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    await deleteItem(pendingDelete.section, pendingDelete.id);
    setPendingDelete(null);
  }, [pendingDelete, deleteItem]);

  const confirmSave = useCallback(async () => {
    if (!pendingSave) return;
    await saveEdit(pendingSave.section, pendingSave.existingId);
    setPendingSave(null);
  }, [pendingSave, saveEdit]);

  const totalProducaoValor = sumValor(data.producao);
  const totalProducaoSemIva = sumValorSemIva(data.producao);
  const totalVendaValor = sumValor(data.venda);
  const totalVendaSemIva = sumValorSemIva(data.venda);
  const totalGeralValor = totalProducaoValor + totalVendaValor;
  const totalGeralSemIva = totalProducaoSemIva + totalVendaSemIva;

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <p className="text-sm text-slate-500">A carregar…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h2 className="text-lg font-semibold text-slate-800">Custos Variáveis</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniKpiCard
          secondary
          title="Com IVA"
          value={formatEUR(totalGeralValor)}
        />
        <MiniKpiCard
          secondary
          title="Sem IVA"
          value={formatEUR(totalGeralSemIva)}
        />
      </div>

      {actionError ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      <CustosVariaveisTable
        title="Custos de Produção"
        section="producao"
        items={data.producao}
        totalValor={totalProducaoValor}
        totalValorSemIva={totalProducaoSemIva}
        editingId={editingId}
        addingSection={addingSection}
        editForm={editForm}
        setEditForm={setEditForm}
        onStartEdit={startEdit}
        onStartAdd={startAdd}
        onCancelEdit={cancelEdit}
        onRequestSave={requestSave}
        onRequestDelete={requestDelete}
      />

      <CustosVariaveisTable
        title="Custos de Venda"
        section="venda"
        items={data.venda}
        totalValor={totalVendaValor}
        totalValorSemIva={totalVendaSemIva}
        editingId={editingId}
        addingSection={addingSection}
        editForm={editForm}
        setEditForm={setEditForm}
        onStartEdit={startEdit}
        onStartAdd={startAdd}
        onCancelEdit={cancelEdit}
        onRequestSave={requestSave}
        onRequestDelete={requestDelete}
      />

      {pendingDelete && (
        <ConfirmModal
          title="Apagar"
          message="Tem a certeza que deseja apagar este item?"
          confirmLabel="Apagar"
          confirmClassName="bg-red-600 hover:bg-red-700 text-white"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
      {pendingSave && (
        <ConfirmModal
          title="Guardar alterações"
          message="Tem a certeza que deseja guardar?"
          confirmLabel="Guardar"
          onConfirm={confirmSave}
          onCancel={() => setPendingSave(null)}
        />
      )}
    </div>
  );
}

type CustosVariaveisTableProps = {
  title: string;
  section: SectionKey;
  items: CustosVariaveisItem[];
  totalValor: number;
  totalValorSemIva: number;
  editingId: string | null;
  addingSection: SectionKey | null;
  editForm: Omit<CustosVariaveisItem, "id">;
  setEditForm: React.Dispatch<
    React.SetStateAction<Omit<CustosVariaveisItem, "id">>
  >;
  onStartEdit: (item: CustosVariaveisItem) => void;
  onStartAdd: (section: SectionKey) => void;
  onCancelEdit: () => void;
  onRequestSave: (section: SectionKey, existingId?: string) => void;
  onRequestDelete: (section: SectionKey, id: string) => void;
};

function CustosVariaveisTable({
  title,
  section,
  items,
  totalValor,
  totalValorSemIva,
  editingId,
  addingSection,
  editForm,
  setEditForm,
  onStartEdit,
  onStartAdd,
  onCancelEdit,
  onRequestSave,
  onRequestDelete,
}: CustosVariaveisTableProps) {
  const isAdding = addingSection === section;

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-600">
            <th className="px-4 py-3 font-medium">Descrição</th>
            <th className="px-4 py-3 font-medium">Valor</th>
            <th className="px-4 py-3 font-medium">Valor (Sem IVA)</th>
            <th className="px-4 py-3 font-medium">Observação</th>
            <th className="w-24 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) =>
            editingId === item.id ? (
              <EditRow
                key={item.id}
                editForm={editForm}
                setEditForm={setEditForm}
                onSave={() => onRequestSave(section, item.id)}
                onCancel={onCancelEdit}
              />
            ) : (
              <tr
                key={item.id}
                className="border-t border-slate-100 hover:bg-slate-50/50"
              >
                <td className="px-4 py-2 text-slate-800">{item.descricao}</td>
                <td className="px-4 py-2 text-slate-800">
                  {formatEUR(item.valor)}
                </td>
                <td className="px-4 py-2 text-slate-800">
                  {formatEUR(item.valorSemIva)}
                </td>
                <td className="px-4 py-2 text-slate-600">{item.observacao}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => onStartEdit(item)}
                      className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => onRequestDelete(section, item.id)}
                      className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Apagar
                    </button>
                  </div>
                </td>
              </tr>
            )
          )}
          {isAdding && (
            <EditRow
              key="adding"
              editForm={editForm}
              setEditForm={setEditForm}
              onSave={() => onRequestSave(section)}
              onCancel={onCancelEdit}
            />
          )}
          <tr className="border-t-2 border-slate-200 bg-white font-medium">
            <td className="px-4 py-3 text-slate-800">Total</td>
            <td className="px-4 py-3 text-slate-800">
              {formatEUR(totalValor)}
            </td>
            <td className="px-4 py-3 text-slate-800">
              {formatEUR(totalValorSemIva)}
            </td>
            <td className="px-4 py-3" />
            <td className="px-4 py-3">
              <button
                type="button"
                onClick={() => onStartAdd(section)}
                className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-300"
              >
                + Adicionar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function EditRow({
  editForm,
  setEditForm,
  onSave,
  onCancel,
}: {
  editForm: Omit<CustosVariaveisItem, "id">;
  setEditForm: React.Dispatch<
    React.SetStateAction<Omit<CustosVariaveisItem, "id">>
  >;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <tr className="border-t border-slate-100 bg-amber-50/50">
      <td className="px-4 py-2">
        <input
          value={editForm.descricao}
          onChange={(e) =>
            setEditForm((f) => ({ ...f, descricao: e.target.value }))
          }
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          placeholder="Descrição"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          step="0.01"
          min="0"
          value={editForm.valor === 0 ? "" : editForm.valor}
          onChange={(e) =>
            setEditForm((f) => ({
              ...f,
              valor: Number(e.target.value) || 0,
            }))
          }
          className="w-28 rounded border border-slate-200 px-2 py-1.5 text-sm"
          placeholder="0"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          step="0.01"
          min="0"
          value={editForm.valorSemIva === 0 ? "" : editForm.valorSemIva}
          onChange={(e) =>
            setEditForm((f) => ({
              ...f,
              valorSemIva: Number(e.target.value) || 0,
            }))
          }
          className="w-28 rounded border border-slate-200 px-2 py-1.5 text-sm"
          placeholder="0"
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={editForm.observacao}
          onChange={(e) =>
            setEditForm((f) => ({ ...f, observacao: e.target.value }))
          }
          className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
          placeholder="Observação"
        />
      </td>
      <td className="px-4 py-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onSave}
            className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
          >
            Cancelar
          </button>
        </div>
      </td>
    </tr>
  );
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmClassName = "bg-slate-700 hover:bg-slate-800 text-white",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmClassName?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
        <h3
          id="confirm-modal-title"
          className="text-base font-semibold text-slate-800"
        >
          {title}
        </h3>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${confirmClassName}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
