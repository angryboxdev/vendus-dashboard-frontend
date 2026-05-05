import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  fetchClosings,
  patchClosing,
  type CashClosing,
  type CashClosingStatus,
  type PatchClosingBody,
} from "./cashClosingApi";

// ---------- query keys ----------

const QK = {
  list: (params: object) => ["cash-closings", params],
  detail: (id: string) => ["cash-closings", id],
};

// ---------- helpers ----------

function fmtEur(n: number): string {
  return n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function fmtDate(ymd: string): string {
  return new Date(ymd + "T12:00:00Z").toLocaleDateString("pt-PT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Lisbon",
  });
}

const STATUS_STYLES: Record<CashClosingStatus, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-amber-100 text-amber-800 ring-amber-200" },
  approved: { label: "Aprovado", cls: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
  rejected: { label: "Rejeitado", cls: "bg-red-100 text-red-800 ring-red-200" },
};

function StatusBadge({ status }: { status: CashClosingStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

// ---------- Detail drawer ----------

function ClosingDetailDrawer({
  closing,
  onClose,
}: {
  closing: CashClosing;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [managerNotes, setManagerNotes] = useState(closing.managerNotes ?? "");
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState({
    tpa: String(closing.tpa),
    uber: String(closing.uber),
    glovo: String(closing.glovo),
    bolt: String(closing.bolt),
    eatz: String(closing.eatz),
    cashSales: String(closing.cashSales),
    cashIn: String(closing.cashIn),
    cashOut: String(closing.cashOut),
    cashDrawerOpen: String(closing.cashDrawerOpen),
    cashDrawerTotal: String(closing.cashDrawerTotal),
    notes: closing.notes ?? "",
  });

  const patchMut = useMutation({
    mutationFn: (body: PatchClosingBody) => patchClosing(closing.id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cash-closings"] });
    },
  });

  function handleStatus(status: CashClosingStatus) {
    patchMut.mutate({ status, managerNotes: managerNotes.trim() || null });
  }

  function handleSaveEdit() {
    const toNum = (s: string) => {
      const n = parseFloat(s);
      return isNaN(n) || n < 0 ? 0 : Math.round(n * 100) / 100;
    };
    patchMut.mutate({
      tpa: toNum(editFields.tpa),
      uber: toNum(editFields.uber),
      glovo: toNum(editFields.glovo),
      bolt: toNum(editFields.bolt),
      eatz: toNum(editFields.eatz),
      cashSales: toNum(editFields.cashSales),
      cashIn: toNum(editFields.cashIn),
      cashOut: toNum(editFields.cashOut),
      cashDrawerOpen: toNum(editFields.cashDrawerOpen),
      cashDrawerTotal: toNum(editFields.cashDrawerTotal),
      notes: editFields.notes.trim() || null,
    });
    setEditMode(false);
  }

  const diff =
    closing.vendusTotal != null
      ? Math.round((closing.totalCalculated - closing.vendusTotal) * 100) / 100
      : null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        className="flex-1 bg-black/40"
        onClick={onClose}
        aria-label="fechar"
      />
      <div className="flex w-full max-w-md flex-col bg-white shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="font-semibold text-slate-900">{closing.employeeName}</p>
            <p className="text-sm text-slate-500">{fmtDate(closing.closingDate)}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={closing.status} />
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 p-6">
          {/* Amounts */}
          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
            {editMode ? (
              <div className="p-4 space-y-3">
                {(
                  [
                    ["tpa", "TPA"],
                    ["uber", "Uber Eats"],
                    ["glovo", "Glovo"],
                    ["bolt", "Bolt Food"],
                    ["eatz", "Eatz"],
                    ["cashSales", "Vendas a dinheiro"],
                    ["cashIn", "Entradas"],
                    ["cashOut", "Saídas"],
                    ["cashDrawerOpen", "Gaveta (início)"],
                    ["cashDrawerTotal", "Gaveta (fim)"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-24 text-sm text-slate-500">{label}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editFields[key]}
                      onChange={(e) =>
                        setEditFields((f) => ({ ...f, [key]: e.target.value }))
                      }
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-right text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                ))}
                <div className="flex items-start gap-3">
                  <span className="w-24 text-sm text-slate-500 pt-1">Notas</span>
                  <textarea
                    value={editFields.notes}
                    onChange={(e) =>
                      setEditFields((f) => ({ ...f, notes: e.target.value }))
                    }
                    rows={2}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            ) : (
              <>
                {(
                  [
                    ["TPA", closing.tpa],
                    ["Uber Eats", closing.uber],
                    ["Glovo", closing.glovo],
                    ["Bolt Food", closing.bolt],
                    ["Eatz", closing.eatz],
                    ["Vendas a dinheiro", closing.cashSales],
                    ["Entradas", closing.cashIn],
                    ["Saídas", closing.cashOut],
                    ["Gaveta (início do dia)", closing.cashDrawerOpen],
                    ["Gaveta (fim do dia)", closing.cashDrawerTotal],
                  ] as [string, number][]
                ).map(([label, val]) => (
                  <div key={label} className="flex justify-between px-4 py-2.5">
                    <span className="text-sm text-slate-500">{label}</span>
                    <span className="text-sm tabular-nums text-slate-800">{fmtEur(val)}</span>
                  </div>
                ))}
                <div className="flex justify-between px-4 py-2.5 bg-slate-50">
                  <span className="text-sm font-semibold text-slate-700">Total Calculado</span>
                  <span className="text-sm font-bold tabular-nums text-slate-900">
                    {fmtEur(closing.totalCalculated)}
                  </span>
                </div>
                {closing.vendusTotal != null && (
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-sm text-slate-500">Total Vendus</span>
                    <span className="text-sm tabular-nums text-slate-800">
                      {fmtEur(closing.vendusTotal)}
                    </span>
                  </div>
                )}
                {diff != null && (
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-sm text-slate-500">Diferença</span>
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        diff === 0
                          ? "text-emerald-600"
                          : diff > 0
                            ? "text-blue-600"
                            : "text-red-600"
                      }`}
                    >
                      {(diff >= 0 ? "+" : "") + fmtEur(diff)}
                    </span>
                  </div>
                )}
                {closing.sangriaAmount > 0 && (
                  <div className="flex justify-between px-4 py-2.5 bg-amber-50">
                    <span className="text-sm text-amber-700">Sangria</span>
                    <span className="text-sm font-semibold tabular-nums text-amber-700">
                      {fmtEur(closing.sangriaAmount)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Notes */}
          {!editMode && closing.notes && (
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Observações</p>
              <p className="mt-1 text-sm text-slate-700">{closing.notes}</p>
            </div>
          )}

          {/* Manager notes */}
          <div>
            <label className="text-sm font-medium text-slate-700">Notas do Manager</label>
            <textarea
              value={managerNotes}
              onChange={(e) => setManagerNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Adicionar notas de revisão…"
            />
          </div>

          {/* Meta */}
          <p className="text-xs text-slate-400">
            Submetido em {fmtDateTime(closing.submittedAt)}
            {closing.reviewedAt && ` · Revisto em ${fmtDateTime(closing.reviewedAt)}`}
          </p>

          {patchMut.isError && (
            <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
              {(patchMut.error as Error).message}
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-slate-200 p-4 space-y-2">
          {editMode ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={patchMut.isPending}
                className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {patchMut.isPending ? "A guardar…" : "Guardar"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleStatus("approved")}
                  disabled={patchMut.isPending || closing.status === "approved"}
                  className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                >
                  Aprovar
                </button>
                <button
                  type="button"
                  onClick={() => handleStatus("rejected")}
                  disabled={patchMut.isPending || closing.status === "rejected"}
                  className="flex-1 rounded-lg border border-red-300 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  Rejeitar
                </button>
              </div>
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Editar valores
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Main page ----------

const PAGE_SIZE = 30;

export function CashClosingsHubPage() {
  const [statusFilter, setStatusFilter] = useState<CashClosingStatus | "">("");
  const [dateFilter, setDateFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<CashClosing | null>(null);

  const params = {
    status: statusFilter || undefined,
    date: dateFilter || undefined,
    limit: PAGE_SIZE,
    offset,
  };

  const { data, isPending } = useQuery({
    queryKey: QK.list(params),
    queryFn: () => fetchClosings(params),
  });

  const closings = data?.closings ?? [];
  const total = data?.total ?? 0;

  function resetPagination() {
    setOffset(0);
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-semibold text-slate-900">Fechos de Caixa</h2>
        <p className="mt-1 text-sm text-slate-500">
          Revisão e aprovação dos fechos de caixa submetidos pelos funcionários.
        </p>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* Status tabs */}
        <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white text-sm">
          {(
            [
              ["", "Todos"],
              ["pending", "Pendentes"],
              ["approved", "Aprovados"],
              ["rejected", "Rejeitados"],
            ] as [CashClosingStatus | "", string][]
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => { setStatusFilter(val); resetPagination(); }}
              className={`px-3 py-1.5 font-medium transition-colors ${
                statusFilter === val
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date filter */}
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => { setDateFilter(e.target.value); resetPagination(); }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {dateFilter && (
          <button
            type="button"
            onClick={() => { setDateFilter(""); resetPagination(); }}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Limpar data
          </button>
        )}

        {!isPending && (
          <span className="ml-auto text-xs text-slate-400">
            {closings.length} de {total} fecho{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isPending ? (
          <div className="animate-pulse space-y-2 p-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded bg-slate-100" />
            ))}
          </div>
        ) : closings.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            Sem fechos para os filtros selecionados.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Funcionário</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Vendus</th>
                <th className="px-4 py-3 text-right">Dif.</th>
                <th className="px-4 py-3 text-right">Sangria</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-left">Submetido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {closings.map((c) => {
                const diff =
                  c.vendusTotal != null
                    ? Math.round((c.totalCalculated - c.vendusTotal) * 100) / 100
                    : null;
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 text-slate-700">{fmtDate(c.closingDate)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{c.employeeName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {fmtEur(c.totalCalculated)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                      {c.vendusTotal != null ? fmtEur(c.vendusTotal) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {diff != null ? (
                        <span
                          className={
                            diff === 0
                              ? "text-emerald-600"
                              : diff > 0
                                ? "text-blue-600"
                                : "text-red-600"
                          }
                        >
                          {(diff >= 0 ? "+" : "") + fmtEur(diff)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-700">
                      {c.sangriaAmount > 0 ? fmtEur(c.sangriaAmount) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-400">{fmtDateTime(c.submittedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {!isPending && (closings.length < total || offset > 0) && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-xs text-slate-500">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
            </span>
            <button
              type="button"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Seguinte
            </button>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <ClosingDetailDrawer
          closing={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
