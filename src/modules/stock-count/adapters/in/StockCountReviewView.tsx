import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStockCountModule } from "../../stock-count.module.tsx";
import { useAuth } from "../../../../contexts/AuthContext.tsx";
import { ApiError } from "../../../../lib/api.ts";
import {
  STOCK_COUNT_SESSION_STATUS_LABELS,
  STOCK_COUNT_SESSION_TYPE_LABELS,
  type StockCountSessionDTO,
  type StockCountLineDTO,
  type StockItemOptionDTO,
} from "../../domain/entities/stock-count.ts";

const inputCls =
  "w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-[#ED5C32]";

function isVersionConflict(e: unknown): e is ApiError {
  return e instanceof ApiError && e.status === 409;
}

function fmt(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("pt-PT", { maximumFractionDigits: 3 });
}

function fmtPercent(n: number | null): string {
  if (n == null) return "—";
  return `${(n * 100).toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`;
}

function fmtEUR(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function fmtTolerance(t: StockCountLineDTO["toleranceSnapshot"]): string {
  if (!t) return "—";
  const parts: string[] = [];
  if (t.absoluteQty != null) parts.push(`±${t.absoluteQty}`);
  if (t.percent != null) parts.push(`±${(t.percent * 100).toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`);
  if (t.financialImpact != null) parts.push(`±${fmtEUR(t.financialImpact)}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

type ToleranceVerdict = "pending" | "no-tolerance" | "within" | "breached";

/** Só para exibição — o backend já decidiu `recount_required` do lado do servidor; isto é uma leitura visual da mesma fórmula (variance.service.ts). */
function toleranceVerdict(line: StockCountLineDTO): ToleranceVerdict {
  if (line.finalVariance == null) return "pending";
  const t = line.toleranceSnapshot;
  if (!t) return "no-tolerance";
  const breached =
    (t.absoluteQty != null && Math.abs(line.finalVariance) > t.absoluteQty) ||
    (t.percent != null && line.variancePercent != null && line.variancePercent > t.percent) ||
    (t.financialImpact != null && line.varianceValue != null && Math.abs(line.varianceValue) > t.financialImpact);
  return breached ? "breached" : "within";
}

const VERDICT_LABELS: Record<ToleranceVerdict, string> = {
  pending: "—",
  "no-tolerance": "Sem tolerância definida",
  within: "Dentro da tolerância",
  breached: "Fora da tolerância",
};

const VERDICT_CLASSES: Record<ToleranceVerdict, string> = {
  pending: "text-stone-400",
  "no-tolerance": "text-stone-500",
  within: "text-green-700",
  breached: "text-red-600",
};

type Filter = "all" | "divergent" | "out_of_tolerance" | "recount_required";

interface LineRowProps {
  session: StockCountSessionDTO;
  line: StockCountLineDTO;
  item: StockItemOptionDTO | undefined;
  isAdmin: boolean;
  onUpdated: (updated: StockCountLineDTO) => void;
  onVersionConflict: () => void;
}

function ReviewLineRow({ session, line, item, isAdmin, onUpdated, onVersionConflict }: LineRowProps) {
  const { api } = useStockCountModule();
  const [action, setAction] = useState<"none" | "recount" | "resolve">("none");
  const [recountReason, setRecountReason] = useState("");
  const [selectedAttemptId, setSelectedAttemptId] = useState(line.attempts[line.attempts.length - 1]?.id ?? "");
  const [manualValue, setManualValue] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [useManual, setUseManual] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recountMutation = useMutation({
    mutationFn: () => api.requestRecount(line.id, { expectedVersion: line.version, reason: recountReason.trim() || undefined }),
    onSuccess: (updated) => {
      setAction("none");
      setRecountReason("");
      onUpdated(updated);
    },
    onError: (e: unknown) => {
      if (isVersionConflict(e)) return onVersionConflict();
      setError(e instanceof Error ? e.message : "Erro ao pedir recontagem.");
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () => {
      if (useManual) {
        const value = parseFloat(manualValue.replace(",", "."));
        if (!Number.isFinite(value) || value < 0) throw new Error("Valor manual inválido.");
        if (!manualReason.trim()) throw new Error("Motivo obrigatório para valor manual.");
        return api.resolveCountLine(line.id, {
          expectedVersion: line.version,
          resolution: "manual_value",
          manualValue: value,
          manualReason: manualReason.trim(),
        });
      }
      if (!selectedAttemptId) throw new Error("Escolhe uma tentativa.");
      return api.resolveCountLine(line.id, {
        expectedVersion: line.version,
        resolution: "select_attempt",
        selectedAttemptId,
      });
    },
    onSuccess: (updated) => {
      setAction("none");
      onUpdated(updated);
    },
    onError: (e: unknown) => {
      if (isVersionConflict(e)) return onVersionConflict();
      setError(e instanceof Error ? e.message : "Erro ao resolver linha.");
    },
  });

  const verdict = toleranceVerdict(line);
  const isTerminalSession = session.status === "completed" || session.status === "cancelled";

  return (
    <tr className="border-b border-stone-100 align-top last:border-b-0">
      <td className="px-4 py-2.5 font-medium text-stone-800">{item?.name ?? line.itemId}</td>
      <td className="px-4 py-2.5 text-right text-stone-600">{fmt(line.finalSystemQuantity)} {item?.baseUnit ?? ""}</td>
      <td className="px-4 py-2.5 text-right text-stone-600">{fmt(line.finalCountedQuantity)} {item?.baseUnit ?? ""}</td>
      <td className="px-4 py-2.5 text-right text-stone-600">{fmt(line.finalVariance)}</td>
      <td className="px-4 py-2.5 text-right text-stone-600">{fmtPercent(line.variancePercent)}</td>
      <td className="px-4 py-2.5 text-right text-stone-600">{fmtEUR(line.varianceValue)}</td>
      <td className="px-4 py-2.5 text-stone-500">{fmtTolerance(line.toleranceSnapshot)}</td>
      <td className={`px-4 py-2.5 text-xs font-medium ${VERDICT_CLASSES[verdict]}`}>{VERDICT_LABELS[verdict]}</td>
      <td className="px-4 py-2.5 text-xs font-medium text-stone-600">{line.status === "resolved" ? "Resolvido" : line.status === "recount_required" ? "Recontagem" : "Contado"}</td>
      <td className="px-4 py-2.5">
        {isTerminalSession ? null : action === "none" ? (
          <div className="flex flex-col gap-1">
            {line.status === "counted" && (
              <button type="button" onClick={() => setAction("recount")} className="text-left text-xs font-medium text-stone-600 hover:underline">
                Pedir recontagem
              </button>
            )}
            {line.status === "recount_required" && (
              <button type="button" onClick={() => setAction("resolve")} className="text-left text-xs font-medium text-stone-600 hover:underline">
                Resolver
              </button>
            )}
          </div>
        ) : action === "recount" ? (
          <div className="w-56 space-y-1.5">
            <textarea
              value={recountReason}
              onChange={(e) => setRecountReason(e.target.value)}
              rows={2}
              placeholder="Motivo (opcional)"
              className={inputCls}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => recountMutation.mutate()} disabled={recountMutation.isPending} className="rounded-md bg-stone-800 px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
                Confirmar
              </button>
              <button type="button" onClick={() => setAction("none")} className="rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="w-64 space-y-1.5">
            {!useManual ? (
              <>
                <select value={selectedAttemptId} onChange={(e) => setSelectedAttemptId(e.target.value)} className={inputCls}>
                  {line.attempts.map((a) => (
                    <option key={a.id} value={a.id}>
                      Tentativa #{a.attemptNumber} — {a.countedQuantity} {item?.baseUnit ?? ""}
                    </option>
                  ))}
                </select>
                {isAdmin && (
                  <button type="button" onClick={() => setUseManual(true)} className="text-xs font-medium text-stone-500 hover:underline">
                    Definir valor manual
                  </button>
                )}
              </>
            ) : (
              <>
                <input type="text" inputMode="decimal" value={manualValue} onChange={(e) => setManualValue(e.target.value)} placeholder="Valor final" className={inputCls} />
                <textarea value={manualReason} onChange={(e) => setManualReason(e.target.value)} rows={2} placeholder="Motivo (obrigatório)" className={inputCls} />
                <button type="button" onClick={() => setUseManual(false)} className="text-xs font-medium text-stone-500 hover:underline">
                  Usar uma tentativa existente
                </button>
              </>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => resolveMutation.mutate()} disabled={resolveMutation.isPending} className="rounded-md bg-stone-800 px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
                Guardar
              </button>
              <button type="button" onClick={() => setAction("none")} className="rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

export function StockCountReviewView({ session }: { session: StockCountSessionDTO }) {
  const { api } = useStockCountModule();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<Filter>("all");
  const [reloadNotice, setReloadNotice] = useState<string | null>(null);
  const [showConfirmSummary, setShowConfirmSummary] = useState(false);
  const [markReadyError, setMarkReadyError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const { data: stockItems = [] } = useQuery({
    queryKey: ["stock-count-item-options"],
    queryFn: () => api.listStockItemOptions(),
  });
  const itemsById = useMemo(() => {
    const map = new Map<string, StockItemOptionDTO>();
    for (const i of stockItems as StockItemOptionDTO[]) map.set(i.id, i);
    return map;
  }, [stockItems]);

  function refetchSession() {
    void qc.invalidateQueries({ queryKey: ["stock-count-session", session.id] });
  }

  function handleUpdated() {
    refetchSession();
  }

  function handleVersionConflict() {
    setReloadNotice("Esta linha foi alterada por outra pessoa — a recarregar…");
    refetchSession();
    setTimeout(() => setReloadNotice(null), 3000);
  }

  const markReadyMutation = useMutation({
    mutationFn: () => api.markSessionReady(session.id, { expectedVersion: session.version }),
    onSuccess: refetchSession,
    onError: (e: unknown) => {
      if (isVersionConflict(e)) return handleVersionConflict();
      setMarkReadyError(e instanceof Error ? e.message : "Erro ao marcar como pronta.");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => api.confirmSession(session.id, { expectedVersion: session.version }),
    onSuccess: () => {
      setShowConfirmSummary(false);
      refetchSession();
    },
    onError: (e: unknown) => {
      if (isVersionConflict(e)) return handleVersionConflict();
      setConfirmError(e instanceof Error ? e.message : "Erro ao confirmar.");
    },
  });

  const filteredLines = session.lines.filter((line) => {
    if (filter === "divergent") return line.finalVariance != null && line.finalVariance !== 0;
    if (filter === "out_of_tolerance") return toleranceVerdict(line) === "breached";
    if (filter === "recount_required") return line.status === "recount_required";
    return true;
  });

  const pendingCount = session.lines.filter((l) => l.status === "not_counted" || l.status === "recount_required").length;
  const summary = useMemo(() => {
    const counted = session.lines.filter((l) => l.status === "counted" || l.status === "resolved").length;
    const divergent = session.lines.filter((l) => l.finalVariance != null && l.finalVariance !== 0).length;
    const outOfTolerance = session.lines.filter((l) => toleranceVerdict(l) === "breached").length;
    const financialImpact = session.lines.reduce((sum, l) => (l.varianceValue != null ? sum + l.varianceValue : sum), 0);
    const hasFinancialImpact = session.lines.some((l) => l.varianceValue != null);
    return { counted, divergent, outOfTolerance, financialImpact, hasFinancialImpact };
  }, [session.lines]);

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <div className="border-b border-stone-200 bg-white px-6 py-4">
        <button type="button" onClick={() => navigate("/stock/contagens")} className="mb-1 text-xs text-stone-400 hover:text-stone-600">
          ← Voltar à lista
        </button>
        <h1 className="text-xl font-bold text-stone-900">
          Contagem #{session.sessionNumber} · {STOCK_COUNT_SESSION_TYPE_LABELS[session.type]}
        </h1>
        <p className="mt-0.5 text-sm text-stone-500">{STOCK_COUNT_SESSION_STATUS_LABELS[session.status]}</p>
      </div>

      {reloadNotice && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs font-medium text-amber-700">{reloadNotice}</div>
      )}

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { key: "all" as const, label: "Todos" },
              { key: "divergent" as const, label: "Com divergência" },
              { key: "out_of_tolerance" as const, label: "Fora da tolerância" },
              { key: "recount_required" as const, label: "Recontagem necessária" },
            ]
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium ${filter === key ? "border-[#ED5C32] bg-[#ED5C32]/10 text-[#ED5C32]" : "border-stone-300 text-stone-600 hover:bg-stone-50"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-4 py-2.5">Item</th>
                <th className="px-4 py-2.5 text-right">Teórico</th>
                <th className="px-4 py-2.5 text-right">Contado</th>
                <th className="px-4 py-2.5 text-right">Diferença</th>
                <th className="px-4 py-2.5 text-right">Diferença %</th>
                <th className="px-4 py-2.5 text-right">Impacto</th>
                <th className="px-4 py-2.5">Tolerância</th>
                <th className="px-4 py-2.5">Situação</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filteredLines.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-stone-400">Sem linhas para este filtro.</td>
                </tr>
              ) : (
                filteredLines.map((line) => (
                  <ReviewLineRow
                    key={line.id}
                    session={session}
                    line={line}
                    item={itemsById.get(line.itemId)}
                    isAdmin={isAdmin}
                    onUpdated={handleUpdated}
                    onVersionConflict={handleVersionConflict}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {session.status === "reviewing" && (
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            {pendingCount > 0 && (
              <p className="mb-2 text-xs text-stone-500">Faltam {pendingCount} linha(s) por resolver ou em recontagem antes de marcar como pronta.</p>
            )}
            <button
              type="button"
              onClick={() => markReadyMutation.mutate()}
              disabled={pendingCount > 0 || markReadyMutation.isPending}
              className="rounded-md bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {markReadyMutation.isPending ? "A marcar…" : "Marcar como pronta"}
            </button>
            {markReadyError && <p className="mt-2 text-xs text-red-600">{markReadyError}</p>}
          </div>
        )}

        {session.status === "ready" && isAdmin && (
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            {!showConfirmSummary ? (
              <button
                type="button"
                onClick={() => setShowConfirmSummary(true)}
                className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Confirmar contagem e ajustar stock
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-800">Confirmar esta contagem?</p>
                <ul className="text-xs text-stone-600">
                  <li>{summary.counted} item(ns) contado(s)</li>
                  <li>{summary.divergent} com divergência</li>
                  <li>{summary.outOfTolerance} fora da tolerância</li>
                  <li>Impacto financeiro estimado: {summary.hasFinancialImpact ? fmtEUR(summary.financialImpact) : "—"}</li>
                </ul>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => confirmMutation.mutate()}
                    disabled={confirmMutation.isPending}
                    className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {confirmMutation.isPending ? "A confirmar…" : "Sim, confirmar e ajustar stock"}
                  </button>
                  <button type="button" onClick={() => setShowConfirmSummary(false)} className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
                    Cancelar
                  </button>
                </div>
                {confirmError && <p className="text-xs text-red-600">{confirmError}</p>}
              </div>
            )}
          </div>
        )}

        {session.status === "ready" && !isAdmin && (
          <p className="text-xs text-stone-400">Só um admin pode confirmar a contagem e ajustar o stock.</p>
        )}

        {session.cancellationReason && (
          <p className="text-xs text-stone-400">Motivo do cancelamento: {session.cancellationReason}</p>
        )}
      </div>
    </div>
  );
}
