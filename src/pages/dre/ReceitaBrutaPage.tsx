import type {
  ReceitaBrutaItem,
  ReceitaBrutaPayload,
  ReceitaBrutaSectionKey,
} from "./receitaBruta.types";
import { apiDelete, apiPost, apiPut } from "../../lib/api";
import { useCallback, useEffect, useState } from "react";

import { RECEITA_BRUTA_TAX_RATE } from "./receitaBruta.types";
import { formatEUR } from "../../lib/format";
import { useDrePeriod } from "./DrePeriodContext";
import { useDreStore } from "./DreStoreContext";

function sumValor(items: ReceitaBrutaItem[]) {
  return items.reduce((a, i) => a + i.valor, 0);
}
function sumTaxa(items: ReceitaBrutaItem[]) {
  return items.reduce((a, i) => a + i.taxa, 0);
}

const EMPTY_PAYLOAD: ReceitaBrutaPayload = {
  dinheiro: [],
  tpa: [],
  apps: [],
};

export function ReceitaBrutaPage() {
  const { period } = useDrePeriod();
  const {
    receitaBruta,
    loadingReceitaBruta: loading,
    loadReceitaBruta,
  } = useDreStore();
  const data = receitaBruta ?? EMPTY_PAYLOAD;
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    section: ReceitaBrutaSectionKey;
    id: string;
  } | null>(null);
  const [pendingSave, setPendingSave] = useState<{
    section: ReceitaBrutaSectionKey;
    existingId?: string;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingSection, setAddingSection] =
    useState<ReceitaBrutaSectionKey | null>(null);
  const [editForm, setEditForm] = useState<Omit<ReceitaBrutaItem, "id">>({
    descricao: "",
    valor: 0,
    taxa: 0,
    observacao: "",
  });

  useEffect(() => {
    loadReceitaBruta();
  }, [loadReceitaBruta]);

  const startEdit = useCallback((item: ReceitaBrutaItem) => {
    setEditingId(item.id);
    setEditForm({
      descricao: item.descricao,
      valor: item.valor,
      taxa: item.taxa,
      observacao: item.observacao,
    });
    setAddingSection(null);
  }, []);

  const startAdd = useCallback((section: ReceitaBrutaSectionKey) => {
    setAddingSection(section);
    setEditForm({
      descricao: "",
      valor: 0,
      taxa: 0,
      observacao: "",
    });
    setEditingId(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setAddingSection(null);
  }, []);

  const updateFormValor = useCallback(
    (section: ReceitaBrutaSectionKey, valor: number) => {
      const rate = RECEITA_BRUTA_TAX_RATE[section];
      setEditForm((f) => ({
        ...f,
        valor,
        taxa: Math.round(valor * rate * 100) / 100,
      }));
    },
    []
  );

  const saveEdit = useCallback(
    async (section: ReceitaBrutaSectionKey, existingId?: string) => {
      setActionError(null);
      const qs = `year=${period.year}&month=${period.month}`;
      const baseUrl = "/api/reports/dre/receita-bruta";
      const payload = {
        descricao: editForm.descricao.trim(),
        valor: Number(editForm.valor) || 0,
        taxa: Number(editForm.taxa) || 0,
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
        await loadReceitaBruta(true);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Erro ao guardar");
      }
    },
    [period, editForm, addingSection, loadReceitaBruta]
  );

  const deleteItem = useCallback(
    async (_section: ReceitaBrutaSectionKey, id: string) => {
      setActionError(null);
      const qs = `year=${period.year}&month=${period.month}`;
      const baseUrl = "/api/reports/dre/receita-bruta";
      try {
        await apiDelete(`${baseUrl}/${id}?${qs}`);
        if (editingId === id) setEditingId(null);
        if (addingSection) setAddingSection(null);
        await loadReceitaBruta(true);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : "Erro ao apagar");
      }
    },
    [period, editingId, addingSection, loadReceitaBruta]
  );

  const requestDelete = useCallback(
    (section: ReceitaBrutaSectionKey, id: string) => {
      setPendingDelete({ section, id });
    },
    [setPendingDelete]
  );

  const requestSave = useCallback(
    (section: ReceitaBrutaSectionKey, existingId?: string) => {
      setPendingSave({ section, existingId });
    },
    [setPendingSave]
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

  const totalDinheiroValor = sumValor(data.dinheiro);
  const totalDinheiroTaxa = sumTaxa(data.dinheiro);
  const totalTpaValor = sumValor(data.tpa);
  const totalTpaTaxa = sumTaxa(data.tpa);
  const totalAppsValor = sumValor(data.apps);
  const totalAppsTaxa = sumTaxa(data.apps);
  const totalBruto = totalDinheiroValor + totalTpaValor + totalAppsValor;
  const totalTaxas = totalDinheiroTaxa + totalTpaTaxa + totalAppsTaxa;
  const totalLiquido = totalBruto - totalTaxas;

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <p className="text-sm text-slate-500">A carregar…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h2 className="text-lg font-semibold text-slate-800">Receita Bruta</h2>
      <p className="mt-2 mb-1 text-sm text-slate-800">
        Total Bruto: <span className="font-bold">{formatEUR(totalBruto)}</span>
      </p>
      <p className="text-sm text-slate-800">
        Total Líquido:{" "}
        <span className="font-bold">{formatEUR(totalLiquido)}</span>
      </p>

      {actionError ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      ) : null}

      <ReceitaBrutaTable
        title="Dinheiro"
        section="dinheiro"
        items={data.dinheiro}
        totalValor={totalDinheiroValor}
        totalTaxa={totalDinheiroTaxa}
        editingId={editingId}
        addingSection={addingSection}
        editForm={editForm}
        setEditForm={setEditForm}
        updateFormValor={updateFormValor}
        onStartEdit={startEdit}
        onStartAdd={startAdd}
        onCancelEdit={cancelEdit}
        onRequestSave={requestSave}
        onRequestDelete={requestDelete}
      />

      <ReceitaBrutaTable
        title="TPA"
        section="tpa"
        items={data.tpa}
        totalValor={totalTpaValor}
        totalTaxa={totalTpaTaxa}
        editingId={editingId}
        addingSection={addingSection}
        editForm={editForm}
        setEditForm={setEditForm}
        updateFormValor={updateFormValor}
        onStartEdit={startEdit}
        onStartAdd={startAdd}
        onCancelEdit={cancelEdit}
        onRequestSave={requestSave}
        onRequestDelete={requestDelete}
      />

      <ReceitaBrutaTable
        title="Apps"
        section="apps"
        items={data.apps}
        totalValor={totalAppsValor}
        totalTaxa={totalAppsTaxa}
        editingId={editingId}
        addingSection={addingSection}
        editForm={editForm}
        setEditForm={setEditForm}
        updateFormValor={updateFormValor}
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

type ReceitaBrutaTableProps = {
  title: string;
  section: ReceitaBrutaSectionKey;
  items: ReceitaBrutaItem[];
  totalValor: number;
  totalTaxa: number;
  editingId: string | null;
  addingSection: ReceitaBrutaSectionKey | null;
  editForm: Omit<ReceitaBrutaItem, "id">;
  setEditForm: React.Dispatch<
    React.SetStateAction<Omit<ReceitaBrutaItem, "id">>
  >;
  updateFormValor: (section: ReceitaBrutaSectionKey, valor: number) => void;
  onStartEdit: (item: ReceitaBrutaItem) => void;
  onStartAdd: (section: ReceitaBrutaSectionKey) => void;
  onCancelEdit: () => void;
  onRequestSave: (section: ReceitaBrutaSectionKey, existingId?: string) => void;
  onRequestDelete: (section: ReceitaBrutaSectionKey, id: string) => void;
};

function ReceitaBrutaTable({
  title,
  section,
  items,
  totalValor,
  totalTaxa,
  editingId,
  addingSection,
  editForm,
  setEditForm,
  updateFormValor,
  onStartEdit,
  onStartAdd,
  onCancelEdit,
  onRequestSave,
  onRequestDelete,
}: ReceitaBrutaTableProps) {
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
            <th className="px-4 py-3 font-medium">
              Taxa ({RECEITA_BRUTA_TAX_RATE[section] * 100}%)
            </th>
            <th className="px-4 py-3 font-medium">Observação</th>
            <th className="w-24 px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) =>
            editingId === item.id ? (
              <ReceitaBrutaEditRow
                key={item.id}
                section={section}
                editForm={editForm}
                setEditForm={setEditForm}
                updateFormValor={updateFormValor}
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
                  {formatEUR(item.taxa)}
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
            <ReceitaBrutaEditRow
              section={section}
              editForm={editForm}
              setEditForm={setEditForm}
              updateFormValor={updateFormValor}
              onSave={() => onRequestSave(section)}
              onCancel={onCancelEdit}
            />
          )}
          <tr className="border-t-2 border-slate-200 bg-white font-medium">
            <td className="px-4 py-3 text-slate-800">Total</td>
            <td className="px-4 py-3 text-slate-800">
              {formatEUR(totalValor)}
            </td>
            <td className="px-4 py-3 text-slate-800">{formatEUR(totalTaxa)}</td>
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

function ReceitaBrutaEditRow({
  section,
  editForm,
  setEditForm,
  updateFormValor,
  onSave,
  onCancel,
}: {
  section: ReceitaBrutaSectionKey;
  editForm: Omit<ReceitaBrutaItem, "id">;
  setEditForm: React.Dispatch<
    React.SetStateAction<Omit<ReceitaBrutaItem, "id">>
  >;
  updateFormValor: (section: ReceitaBrutaSectionKey, valor: number) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const handleValorChange = useCallback(
    (valor: number) => {
      updateFormValor(section, valor);
    },
    [section, updateFormValor]
  );

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
          onChange={(e) => {
            const v = Number(e.target.value) || 0;
            handleValorChange(v);
          }}
          className="w-28 rounded border border-slate-200 px-2 py-1.5 text-sm"
          placeholder="0"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          step="0.01"
          min="0"
          value={editForm.taxa === 0 ? "" : editForm.taxa}
          onChange={(e) =>
            setEditForm((f) => ({
              ...f,
              taxa: Number(e.target.value) || 0,
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
