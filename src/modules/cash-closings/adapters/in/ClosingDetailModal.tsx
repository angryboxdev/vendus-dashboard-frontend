import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CashClosing, CashClosingStatus } from "../../domain/entities/cash-closing.ts";
import { useCashClosingsModule } from "../../cash-closings.module.tsx";
import type { ReviewClosingCommand } from "../../domain/ports/in/review-closing.port.ts";

// ---------- helpers ----------

function fmtEur(n: number): string {
  return n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function fmtDate(ymd: string): string {
  return new Date(ymd + "T12:00:00Z").toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
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

// ---------- Status badge ----------

const STATUS_CONFIG: Record<CashClosingStatus, { label: string; cls: string }> = {
  pending: {
    label: "Pendente",
    cls: "bg-[#F1A93F]/20 text-[#7A1A00] ring-1 ring-[#F1A93F]/50",
  },
  approved: {
    label: "Aprovado",
    cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  },
  rejected: {
    label: "Rejeitado",
    cls: "bg-[#A3211A]/10 text-[#A3211A] ring-1 ring-[#A3211A]/25",
  },
};

export function StatusBadge({ status }: { status: CashClosingStatus }) {
  const { label, cls } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// ---------- ClosingDetailModal ----------

interface Props {
  closing: CashClosing;
  onClose: () => void;
}

type EditFields = {
  tpa: string; uber: string; glovo: string; bolt: string; eatz: string;
  cashSales: string; cashIn: string; cashOut: string;
  cashDrawerOpen: string; cashDrawerTotal: string; notes: string;
};

export function ClosingDetailModal({ closing, onClose }: Props) {
  const { reviewClosing } = useCashClosingsModule();
  const qc = useQueryClient();
  const [managerNotes, setManagerNotes] = useState(closing.managerNotes ?? "");
  const [editMode, setEditMode] = useState(false);
  const [editFields, setEditFields] = useState<EditFields>({
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
    mutationFn: (cmd: ReviewClosingCommand) => reviewClosing.execute(cmd),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cash-closings"] });
    },
  });

  function toNum(s: string): number {
    const n = parseFloat(s);
    return isNaN(n) || n < 0 ? 0 : Math.round(n * 100) / 100;
  }

  function handleStatus(status: CashClosingStatus) {
    patchMut.mutate({ id: closing.id, status, managerNotes: managerNotes.trim() || null });
  }

  function handleSaveEdit() {
    patchMut.mutate({
      id: closing.id,
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

  const numericFields = [
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
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <button
        type="button"
        className="flex-1 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-label="fechar"
      />

      {/* Panel */}
      <div className="flex w-full max-w-md flex-col bg-[#FAF6F3] shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#F5C992]/60 bg-white px-6 py-5">
          <div>
            <p className="text-base font-semibold text-stone-900">{closing.employeeName}</p>
            <p className="mt-0.5 text-sm capitalize text-stone-500">{fmtDate(closing.closingDate)}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={closing.status} />
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.28 3.22a.75.75 0 0 0-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 1 0 1.06 1.06L8 9.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L9.06 8l3.72-3.72a.75.75 0 0 0-1.06-1.06L8 6.94 4.28 3.22Z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 p-6">
          {/* Amounts section */}
          <div className="overflow-hidden rounded-xl border border-[#F5C992]/60 bg-white">
            {editMode ? (
              <div className="divide-y divide-stone-100 p-4">
                <div className="space-y-3 pb-3">
                  {numericFields.map(([key, label]) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-xs text-stone-500">{label}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editFields[key]}
                        onChange={(e) =>
                          setEditFields((f) => ({ ...f, [key]: e.target.value }))
                        }
                        className="flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-right text-sm focus:border-[#ED5C32] focus:outline-none focus:ring-1 focus:ring-[#ED5C32]/30"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-start gap-3 pt-3">
                  <span className="w-28 shrink-0 pt-1 text-xs text-stone-500">Observações</span>
                  <textarea
                    value={editFields.notes}
                    onChange={(e) => setEditFields((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-sm focus:border-[#ED5C32] focus:outline-none focus:ring-1 focus:ring-[#ED5C32]/30"
                  />
                </div>
              </div>
            ) : (
              <div className="divide-y divide-stone-50">
                {/* Bloco 1: Canal Próprio (Vendus) */}
                <div className="px-4 py-2 bg-stone-50">
                  <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                    Canal Próprio
                  </span>
                </div>
                {(
                  [
                    ["TPA", closing.tpa],
                    ["Eatz", closing.eatz],
                    ["Vendas a dinheiro", closing.cashSales],
                  ] as [string, number][]
                ).map(([label, val]) => (
                  <div key={label} className="flex justify-between px-4 py-2.5">
                    <span className="text-sm text-stone-500">{label}</span>
                    <span className="text-sm tabular-nums text-stone-800">{fmtEur(val)}</span>
                  </div>
                ))}
                {closing.vendusTotal != null && (() => {
                  const ownSubtotal = Math.round((closing.tpa + closing.eatz + closing.cashSales) * 100) / 100;
                  const ownDiff = Math.round((ownSubtotal - closing.vendusTotal) * 100) / 100;
                  return (
                    <>
                      <div className="flex justify-between bg-stone-50 px-4 py-2.5">
                        <span className="text-sm font-medium text-stone-600">Subtotal declarado</span>
                        <span className="text-sm tabular-nums font-medium text-stone-800">{fmtEur(ownSubtotal)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-2.5">
                        <span className="text-sm text-stone-500">Total Vendus</span>
                        <span className="text-sm tabular-nums text-stone-700">{fmtEur(closing.vendusTotal)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-2.5">
                        <span className="text-sm text-stone-500">Diferença</span>
                        <span className={`text-sm font-semibold tabular-nums ${
                          ownDiff === 0 ? "text-emerald-600" : ownDiff > 0 ? "text-[#ED5C32]" : "text-[#A3211A]"
                        }`}>
                          {(ownDiff >= 0 ? "+" : "") + fmtEur(ownDiff)}
                        </span>
                      </div>
                    </>
                  );
                })()}

                {/* Bloco 2: Canais Externos (AirMenu) */}
                <div className="px-4 py-2 bg-stone-50">
                  <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                    Canais Externos
                  </span>
                </div>
                {(
                  [
                    ["Uber Eats", closing.uber, closing.airMenuUber],
                    ["Glovo", closing.glovo, closing.airMenuGlovo],
                    ["Bolt Food", closing.bolt, closing.airMenuBolt],
                  ] as [string, number, number | null][]
                ).map(([label, declared, airMenu]) => {
                  const deliveryDiff = airMenu != null ? Math.round((declared - airMenu) * 100) / 100 : null;
                  return (
                    <div key={label} className="px-4 py-2.5">
                      <div className="flex justify-between">
                        <span className="text-sm text-stone-500">{label}</span>
                        <span className="text-sm tabular-nums text-stone-800">{fmtEur(declared)}</span>
                      </div>
                      {airMenu != null && (
                        <div className="flex justify-between mt-0.5">
                          <span className="text-xs text-stone-400 pl-2">↳ AirMenu</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs tabular-nums text-stone-500">{fmtEur(airMenu)}</span>
                            {deliveryDiff !== null && (
                              <span className={`text-xs font-medium tabular-nums ${
                                deliveryDiff === 0 ? "text-emerald-600" : deliveryDiff > 0 ? "text-[#ED5C32]" : "text-[#A3211A]"
                              }`}>
                                {deliveryDiff === 0 ? "✓" : (deliveryDiff > 0 ? "+" : "") + fmtEur(deliveryDiff)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {(() => {
                  const declaredTotal = Math.round((closing.uber + closing.glovo + closing.bolt) * 100) / 100;
                  const hasAirMenu = closing.airMenuUber != null || closing.airMenuGlovo != null || closing.airMenuBolt != null;
                  const airMenuTotal = hasAirMenu
                    ? Math.round(((closing.airMenuUber ?? 0) + (closing.airMenuGlovo ?? 0) + (closing.airMenuBolt ?? 0)) * 100) / 100
                    : null;
                  const deliveryTotalDiff = airMenuTotal != null ? Math.round((declaredTotal - airMenuTotal) * 100) / 100 : null;
                  return (
                    <>
                      <div className="flex justify-between bg-stone-50 px-4 py-2.5">
                        <span className="text-sm font-medium text-stone-600">Subtotal declarado</span>
                        <span className="text-sm tabular-nums font-medium text-stone-800">{fmtEur(declaredTotal)}</span>
                      </div>
                      {airMenuTotal != null && (
                        <div className="flex justify-between px-4 py-2.5">
                          <span className="text-sm text-stone-500">Total AirMenu</span>
                          <span className="text-sm tabular-nums text-stone-700">{fmtEur(airMenuTotal)}</span>
                        </div>
                      )}
                      {deliveryTotalDiff != null && (
                        <div className="flex justify-between px-4 py-2.5">
                          <span className="text-sm text-stone-500">Diferença</span>
                          <span className={`text-sm font-semibold tabular-nums ${
                            deliveryTotalDiff === 0 ? "text-emerald-600" : deliveryTotalDiff > 0 ? "text-[#ED5C32]" : "text-[#A3211A]"
                          }`}>
                            {(deliveryTotalDiff >= 0 ? "+" : "") + fmtEur(deliveryTotalDiff)}
                          </span>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Gaveta */}
                <div className="px-4 py-2 bg-stone-50">
                  <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                    Movimentos de Caixa
                  </span>
                </div>
                {(
                  [
                    ["Entradas", closing.cashIn],
                    ["Saídas", closing.cashOut],
                    ["Gaveta (início)", closing.cashDrawerOpen],
                    ["Gaveta (fim)", closing.cashDrawerTotal],
                  ] as [string, number][]
                ).map(([label, val]) => (
                  <div key={label} className="flex justify-between px-4 py-2.5">
                    <span className="text-sm text-stone-500">{label}</span>
                    <span className="text-sm tabular-nums text-stone-800">{fmtEur(val)}</span>
                  </div>
                ))}
                {(() => {
                  const expectedDrawer = Math.round(
                    (closing.cashDrawerOpen + closing.cashSales + closing.cashIn - closing.cashOut) * 100,
                  ) / 100;
                  const drawerDiff = Math.round((closing.cashDrawerTotal - expectedDrawer) * 100) / 100;
                  return (
                    <>
                      <div className="flex justify-between px-4 py-2.5">
                        <span className="text-sm text-stone-500">Gaveta esperada</span>
                        <span className="text-sm tabular-nums text-stone-500">{fmtEur(expectedDrawer)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-2.5">
                        <span className="text-sm text-stone-500">Diferença gaveta</span>
                        <span className={`text-sm font-semibold tabular-nums ${
                          drawerDiff === 0 ? "text-emerald-600" : drawerDiff > 0 ? "text-[#ED5C32]" : "text-[#A3211A]"
                        }`}>
                          {drawerDiff === 0 ? "✓ 0,00 €" : (drawerDiff > 0 ? "+" : "") + fmtEur(drawerDiff)}
                        </span>
                      </div>
                    </>
                  );
                })()}

                {/* Total Calculado */}
                <div className="flex justify-between bg-stone-50 px-4 py-3">
                  <span className="text-sm font-semibold text-stone-700">Total Calculado</span>
                  <span className="text-sm font-bold tabular-nums text-stone-900">
                    {fmtEur(closing.totalCalculated)}
                  </span>
                </div>

                {closing.sangriaAmount > 0 && (
                  <div className="flex justify-between bg-[#F1A93F]/10 px-4 py-2.5">
                    <span className="text-sm text-[#7A1A00]">Sangria</span>
                    <span className="text-sm font-semibold tabular-nums text-[#7A1A00]">
                      {fmtEur(closing.sangriaAmount)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Observações do funcionário */}
          {!editMode && closing.notes && (
            <div className="rounded-xl border border-[#F5C992]/60 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Observações
              </p>
              <p className="mt-1 text-sm text-stone-700">{closing.notes}</p>
            </div>
          )}

          {/* Notas do manager */}
          <div>
            <label className="text-sm font-medium text-stone-700">Notas do Manager</label>
            <textarea
              value={managerNotes}
              onChange={(e) => setManagerNotes(e.target.value)}
              rows={2}
              className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:border-[#ED5C32] focus:outline-none focus:ring-1 focus:ring-[#ED5C32]/30"
              placeholder="Adicionar notas de revisão…"
            />
          </div>

          {/* Meta */}
          <p className="text-xs text-stone-400">
            Submetido {fmtDateTime(closing.submittedAt)}
            {closing.reviewedAt && ` · Revisto ${fmtDateTime(closing.reviewedAt)}`}
          </p>

          {patchMut.isError && (
            <p className="rounded-lg bg-[#A3211A]/10 px-4 py-2 text-sm text-[#A3211A]">
              {(patchMut.error as Error).message}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#F5C992]/60 bg-white p-4 space-y-2">
          {editMode ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="flex-1 rounded-xl border border-stone-300 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={patchMut.isPending}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#ED5C32] to-[#EF8935] py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity disabled:opacity-50"
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
                  className="flex-1 rounded-xl bg-gradient-to-r from-[#ED5C32] to-[#EF8935] py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity disabled:opacity-40"
                >
                  Aprovar
                </button>
                <button
                  type="button"
                  onClick={() => handleStatus("rejected")}
                  disabled={patchMut.isPending || closing.status === "rejected"}
                  className="flex-1 rounded-xl border border-[#A3211A]/40 py-2.5 text-sm font-medium text-[#A3211A] transition-colors hover:bg-[#A3211A]/5 disabled:opacity-40"
                >
                  Rejeitar
                </button>
              </div>
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="w-full rounded-xl border border-stone-300 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
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
