import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStockCountModule } from "../../stock-count.module.tsx";
import { useAuth } from "../../../../contexts/AuthContext.tsx";
import { ApiError } from "../../../../lib/api.ts";
import {
  STOCK_COUNT_SESSION_TYPE_LABELS,
  type StockCountSessionDTO,
  type StockCountLineDTO,
  type StockItemOptionDTO,
} from "../../domain/entities/stock-count.ts";

const inputCls =
  "w-28 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-[#ED5C32]";

function isVersionConflict(e: unknown): e is ApiError {
  return e instanceof ApiError && e.status === 409;
}

function isOverlapError(e: unknown): e is ApiError {
  return e instanceof ApiError && e.status === 400 && /overlap/i.test(e.message);
}

/**
 * Rascunho ainda não iniciado (ex.: criado mas o `start` falhou por
 * sobreposição) — dá uma forma de retomar sem ter de recriar a sessão.
 */
function DraftStartGate({ session, onStarted }: { session: StockCountSessionDTO; onStarted: () => void }) {
  const { api } = useStockCountModule();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [overlapMessage, setOverlapMessage] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  const startMutation = useMutation({
    mutationFn: (overrideOverlap: boolean) =>
      api.startSession(session.id, {
        expectedVersion: session.version,
        overrideOverlap,
        overrideReason: overrideOverlap ? overrideReason.trim() || undefined : undefined,
      }),
    onSuccess: onStarted,
    onError: (e: unknown) => {
      if (isOverlapError(e)) {
        setOverlapMessage(e.message);
        return;
      }
      setOverlapMessage(null);
    },
  });

  return (
    <div className="p-6">
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <p className="text-sm font-medium text-stone-800">Sessão criada mas ainda não iniciada.</p>
        <p className="mt-1 text-xs text-stone-500">
          A materialização do escopo (stock teórico) só acontece ao iniciar a contagem.
        </p>
        <button
          type="button"
          onClick={() => startMutation.mutate(false)}
          disabled={startMutation.isPending}
          className="mt-3 rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {startMutation.isPending ? "A iniciar…" : "Iniciar contagem"}
        </button>

        {overlapMessage && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-stone-800">Não foi possível iniciar: {overlapMessage}</p>
            {isAdmin ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
                  placeholder="Motivo para forçar o início mesmo assim (opcional)"
                />
                <button
                  type="button"
                  onClick={() => startMutation.mutate(true)}
                  disabled={startMutation.isPending}
                  className="rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  Forçar início mesmo assim
                </button>
              </div>
            ) : (
              <p className="mt-1 text-xs text-stone-500">Pede a um admin para forçar o início.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface CountLineRowProps {
  line: StockCountLineDTO;
  item: StockItemOptionDTO | undefined;
  onSubmitted: () => void;
  onVersionConflict: () => void;
}

function CountLineRow({ line, item, onSubmitted, onVersionConflict }: CountLineRowProps) {
  const { api } = useStockCountModule();
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const countStartedAtRef = useRef<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: () => {
      const qty = parseFloat(quantity.replace(",", "."));
      if (!Number.isFinite(qty) || qty < 0) throw new Error("Quantidade inválida.");
      const countStartedAt = countStartedAtRef.current ?? new Date().toISOString();
      return api.submitCountAttempt(line.id, {
        expectedVersion: line.version,
        components: [{ quantity: qty, unit: item?.baseUnit ?? "un" }],
        countStartedAt,
      });
    },
    onSuccess: () => {
      setQuantity("");
      countStartedAtRef.current = null;
      onSubmitted();
    },
    onError: (e: unknown) => {
      if (isVersionConflict(e)) {
        onVersionConflict();
        return;
      }
      setError(e instanceof Error ? e.message : "Erro ao registar contagem.");
    },
  });

  function handleFocus() {
    if (countStartedAtRef.current == null) {
      countStartedAtRef.current = new Date().toISOString();
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 p-4 last:border-b-0">
      <div>
        <p className="font-medium text-stone-800">{item?.name ?? line.itemId}</p>
        {line.status === "recount_required" && (
          <p className="text-xs text-amber-600">Recontagem necessária.</p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onFocus={handleFocus}
          placeholder="0"
          className={inputCls}
        />
        <span className="text-xs text-stone-500">{item?.baseUnit ?? ""}</span>
        <button
          type="button"
          onClick={() => submitMutation.mutate()}
          disabled={submitMutation.isPending || quantity.trim() === ""}
          className="rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitMutation.isPending ? "A guardar…" : "Registar"}
        </button>
      </div>
    </div>
  );
}

/**
 * Execução da contagem — lista simples e sequencial (não swipe/carrossel,
 * Fase 1). Nunca mostra stock teórico/variância aqui (nem em `blindCount`
 * nem fora dele) — só item/unidade/input/progresso; a conferência
 * (teórico vs. contado) só aparece na vista de Conferência.
 */
export function StockCountExecutionView({ session }: { session: StockCountSessionDTO }) {
  const { api } = useStockCountModule();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [reloadNotice, setReloadNotice] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);

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

  function handleVersionConflict() {
    setReloadNotice("Esta linha foi alterada por outra pessoa — a recarregar…");
    refetchSession();
    setTimeout(() => setReloadNotice(null), 3000);
  }

  const finishMutation = useMutation({
    mutationFn: () => api.finishExecution(session.id, { expectedVersion: session.version }),
    onSuccess: () => {
      refetchSession();
    },
    onError: (e: unknown) => {
      if (isVersionConflict(e)) {
        handleVersionConflict();
        return;
      }
      setFinishError(e instanceof Error ? e.message : "Erro ao terminar a execução.");
    },
  });

  if (session.status === "draft") {
    return <DraftStartGate session={session} onStarted={refetchSession} />;
  }

  const pendingLines = session.lines.filter((l) => l.status === "not_counted" || l.status === "recount_required");
  const doneLines = session.lines.filter((l) => l.status === "counted" || l.status === "resolved");
  const total = session.lines.length;
  const notCountedCount = session.lines.filter((l) => l.status === "not_counted").length;

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <div className="border-b border-stone-200 bg-white px-6 py-4">
        <button type="button" onClick={() => navigate("/stock/contagens")} className="mb-1 text-xs text-stone-400 hover:text-stone-600">
          ← Voltar à lista
        </button>
        <h1 className="text-xl font-bold text-stone-900">
          Contagem #{session.sessionNumber} · {STOCK_COUNT_SESSION_TYPE_LABELS[session.type]}
        </h1>
        <p className="mt-0.5 text-sm text-stone-500">
          {doneLines.length} de {total} contados
        </p>
      </div>

      {reloadNotice && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs font-medium text-amber-700">{reloadNotice}</div>
      )}

      <div className="space-y-4 p-6">
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          {total === 0 ? (
            <p className="p-4 text-sm text-stone-400">Sem itens no escopo desta sessão.</p>
          ) : pendingLines.length === 0 ? (
            <p className="p-4 text-sm text-stone-400">Todos os itens foram contados.</p>
          ) : (
            pendingLines.map((line) => (
              <CountLineRow
                key={line.id}
                line={line}
                item={itemsById.get(line.itemId)}
                onSubmitted={refetchSession}
                onVersionConflict={handleVersionConflict}
              />
            ))
          )}
        </div>

        {doneLines.length > 0 && (
          <details className="rounded-xl border border-stone-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-medium text-stone-600">Já contados ({doneLines.length})</summary>
            <div className="mt-2 divide-y divide-stone-100">
              {doneLines.map((line) => (
                <div key={line.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-stone-700">{itemsById.get(line.itemId)?.name ?? line.itemId}</span>
                  <span className="text-stone-500">
                    {line.finalCountedQuantity ?? "—"} {itemsById.get(line.itemId)?.baseUnit ?? ""}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        <div className="rounded-xl border border-stone-200 bg-white p-4">
          {notCountedCount > 0 && (
            <p className="mb-2 text-xs text-stone-500">Faltam {notCountedCount} item(ns) por contar antes de terminar a execução.</p>
          )}
          <button
            type="button"
            onClick={() => finishMutation.mutate()}
            disabled={notCountedCount > 0 || finishMutation.isPending}
            className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {finishMutation.isPending ? "A terminar…" : "Terminar execução"}
          </button>
          {finishError && <p className="mt-2 text-xs text-red-600">{finishError}</p>}
        </div>
      </div>
    </div>
  );
}
