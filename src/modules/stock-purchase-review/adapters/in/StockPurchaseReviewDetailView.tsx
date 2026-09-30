import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStockPurchaseReviewModule } from "../../stock-purchase-review.module.tsx";
import { LocationSelect } from "../../../../components/LocationSelect.tsx";
import { ApiError } from "../../../../lib/api.ts";
import {
  STOCK_PURCHASE_REVIEW_STATUS_LABELS,
  DECISION_SOURCE_LABELS,
  RESOLUTION_TYPE_LABELS,
  type StockPurchaseReviewDTO,
  type StockReviewLineDTO,
  type StockItemOptionDTO,
  type StockCategoryOptionDTO,
  type StockReviewLineSuggestionDTO,
  type ResolveStockReviewLinePayload,
} from "../../domain/entities/stock-purchase-review.ts";

function fromCents(n: number): string {
  return (n / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function formatDate(s: string): string {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

const inputCls =
  "w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-[#ED5C32]";
const labelCls = "mb-1 block text-xs font-medium text-stone-500";

const STOCK_ITEM_TYPE_OPTIONS = [
  { value: "ingredient", label: "Ingrediente" },
  { value: "other", label: "Outro" },
];

const BASE_UNIT_OPTIONS = ["g", "kg", "ml", "cl", "l", "un"];

function isVersionConflict(e: unknown): e is ApiError {
  return e instanceof ApiError && e.status === 409;
}

function isLocationRequired(e: unknown): e is ApiError {
  return e instanceof ApiError && e.status === 400 && typeof (e.data as { error?: unknown })?.error === "string"
    && /loja|location/i.test(String((e.data as { error?: string }).error));
}

interface LineRowProps {
  review: StockPurchaseReviewDTO;
  line: StockReviewLineDTO;
  stockItems: StockItemOptionDTO[];
  stockCategories: StockCategoryOptionDTO[];
  onResolved: (updated: StockPurchaseReviewDTO) => void;
  onVersionConflict: () => void;
  unresolvedGateOpen: boolean;
}

function ReviewLineRow({ review, line, stockItems, stockCategories, onResolved, onVersionConflict, unresolvedGateOpen }: LineRowProps) {
  const { api } = useStockPurchaseReviewModule();
  const isResolved = line.resolutionType !== "unresolved";

  const [mode, setMode] = useState<"existing_item" | "new_item" | "no_stock_effect">(
    line.resolutionType === "unresolved" ? "existing_item" : (line.resolutionType as "existing_item" | "new_item" | "no_stock_effect"),
  );
  const [stockItemId, setStockItemId] = useState(line.stockItemId ?? "");
  const [conversionFactor, setConversionFactor] = useState(line.conversionFactor != null ? String(line.conversionFactor) : "1");
  const [locationId, setLocationId] = useState<string | null>(line.locationId);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategoryId, setNewItemCategoryId] = useState("");
  const [newItemType, setNewItemType] = useState("ingredient");
  const [newItemBaseUnit, setNewItemBaseUnit] = useState("un");
  const [suggestionAccepted, setSuggestionAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: suggestion } = useQuery<StockReviewLineSuggestionDTO | null>({
    queryKey: ["stock-review-line-suggestion", review.id, line.id],
    queryFn: () => api.getLineSuggestion(review.id, line.id),
    enabled: !isResolved && !unresolvedGateOpen,
  });

  const resolveMutation = useMutation({
    mutationFn: (payload: ResolveStockReviewLinePayload) => api.resolveLine(review.id, line.id, payload),
    onSuccess: (updated) => onResolved(updated),
    onError: (e: unknown) => {
      if (isVersionConflict(e)) {
        onVersionConflict();
        return;
      }
      setError(e instanceof Error ? e.message : "Erro ao guardar");
    },
  });

  function applySuggestion() {
    if (!suggestion) return;
    setSuggestionAccepted(true);
    if (suggestion.resolutionType === "no_stock_effect") {
      setMode("no_stock_effect");
      return;
    }
    setMode("existing_item");
    setStockItemId(suggestion.stockItemId ?? "");
    if (suggestion.conversionFactor != null) setConversionFactor(String(suggestion.conversionFactor));
  }

  function handleResolve() {
    setError(null);
    if (mode === "no_stock_effect") {
      resolveMutation.mutate({ expectedVersion: review.version, resolution: "no_stock_effect" });
      return;
    }
    const factor = parseFloat(conversionFactor.replace(",", "."));
    if (!Number.isFinite(factor) || factor <= 0) {
      setError("Fator de conversão inválido.");
      return;
    }
    if (mode === "existing_item") {
      if (!stockItemId) {
        setError("Escolhe um item de stock.");
        return;
      }
      resolveMutation.mutate({
        expectedVersion: review.version,
        resolution: "existing_item",
        stockItemId,
        conversionFactor: factor,
        locationId,
      });
      return;
    }
    if (!newItemName.trim() || !newItemCategoryId) {
      setError("Preenche o nome e a categoria do item novo.");
      return;
    }
    resolveMutation.mutate({
      expectedVersion: review.version,
      resolution: "new_item",
      newItem: { name: newItemName.trim(), categoryId: newItemCategoryId, type: newItemType, baseUnit: newItemBaseUnit },
      conversionFactor: factor,
      locationId,
    });
  }

  return (
    <div className="border-b border-stone-100 p-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-stone-800">{line.description}</p>
          <p className="text-xs text-stone-500">
            {line.purchaseQuantity} {line.purchaseUnit} · {fromCents(line.unitCostWithoutVat)}/{line.purchaseUnit} s/ IVA · total {fromCents(line.totalWithVat)}
          </p>
        </div>
        <p className="text-xs font-medium text-stone-500">{RESOLUTION_TYPE_LABELS[line.resolutionType]}</p>
      </div>

      {line.flaggedSuspiciousConversion && (
        <p className="mt-1 text-xs text-amber-600">Aviso: conversão pouco habitual{line.flagReason ? ` — ${line.flagReason}` : ""}. Confirma antes de avançar.</p>
      )}

      {isResolved ? (
        <p className="mt-2 text-xs text-stone-400">
          {line.resolutionType === "existing_item" || line.resolutionType === "new_item"
            ? `Quantidade em stock: ${line.stockQuantity ?? "—"} (fator ${line.conversionFactor ?? "—"})`
            : "Não afeta stock."}
        </p>
      ) : unresolvedGateOpen ? (
        <p className="mt-2 text-xs text-stone-400">Responde primeiro se esta fatura afeta o stock.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {suggestion && !suggestionAccepted && (
            <div className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs text-stone-600">
              <span>
                Sugestão: {suggestion.resolutionType === "no_stock_effect"
                  ? "não afeta stock"
                  : `item ${stockItems.find((i) => i.id === suggestion.stockItemId)?.name ?? suggestion.stockItemId}${suggestion.conversionFactor != null ? ` (fator ${suggestion.conversionFactor})` : ""}`}
                {suggestion.isItemActive === false && " — item inativo"}
              </span>
              <button type="button" onClick={applySuggestion} className="rounded border border-stone-300 px-2 py-0.5 font-medium text-stone-700 hover:bg-white">
                Aplicar
              </button>
            </div>
          )}

          <div className="flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 text-xs">
            {(
              [
                { key: "existing_item" as const, label: "Item existente" },
                { key: "new_item" as const, label: "Novo item" },
                { key: "no_stock_effect" as const, label: "Não afeta stock" },
              ]
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`flex-1 rounded-md px-2 py-1.5 font-medium transition-colors ${mode === key ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "existing_item" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Item de stock</label>
                <select value={stockItemId} onChange={(e) => setStockItemId(e.target.value)} className={inputCls}>
                  <option value="">— selecionar —</option>
                  {stockItems.map((i) => (
                    <option key={i.id} value={i.id} disabled={!i.isActive}>
                      {i.name}{!i.isActive ? " (inativo)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Fator de conversão ({line.purchaseUnit} → un. base)</label>
                <input type="text" value={conversionFactor} onChange={(e) => setConversionFactor(e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <LocationSelect value={locationId} onChange={setLocationId} label="Loja" />
              </div>
            </div>
          )}

          {mode === "new_item" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className={labelCls}>Nome do item novo</label>
                <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Categoria</label>
                <select value={newItemCategoryId} onChange={(e) => setNewItemCategoryId(e.target.value)} className={inputCls}>
                  <option value="">— selecionar —</option>
                  {stockCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Tipo</label>
                <select value={newItemType} onChange={(e) => setNewItemType(e.target.value)} className={inputCls}>
                  {STOCK_ITEM_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Unidade base</label>
                <select value={newItemBaseUnit} onChange={(e) => setNewItemBaseUnit(e.target.value)} className={inputCls}>
                  {BASE_UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Fator de conversão ({line.purchaseUnit} → {newItemBaseUnit})</label>
                <input type="text" value={conversionFactor} onChange={(e) => setConversionFactor(e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <LocationSelect value={locationId} onChange={setLocationId} label="Loja" />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="button"
            onClick={handleResolve}
            disabled={resolveMutation.isPending}
            className="rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {resolveMutation.isPending ? "A guardar…" : mode === "no_stock_effect" ? "Marcar como não afeta stock" : "Guardar resolução"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Detalhe de uma "Compra por rever" — Fase 1: formulário simples por linha,
 * sem wizard multi-passo. O botão de confirmação só fica ativo com
 * `status === "ready"` (todas as linhas resolvidas).
 */
export function StockPurchaseReviewDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { api } = useStockPurchaseReviewModule();

  const [reloadNotice, setReloadNotice] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [confirmLocationId, setConfirmLocationId] = useState<string | null>(null);
  const [needsConfirmLocation, setNeedsConfirmLocation] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState("");

  const { data: review, isLoading, isError } = useQuery({
    queryKey: ["stock-purchase-review", id],
    queryFn: () => api.getReview(id!),
    enabled: !!id,
  });

  const { data: stockItems = [] } = useQuery({
    queryKey: ["stock-purchase-review-stock-items"],
    queryFn: () => api.listStockItemOptions(),
  });
  const { data: stockCategories = [] } = useQuery({
    queryKey: ["stock-purchase-review-stock-categories"],
    queryFn: () => api.listStockCategoryOptions(),
  });

  function handleUpdated(updated: StockPurchaseReviewDTO) {
    qc.setQueryData(["stock-purchase-review", id], updated);
    void qc.invalidateQueries({ queryKey: ["stock-purchase-reviews"] });
  }

  function handleVersionConflict() {
    setReloadNotice("Esta revisão foi alterada por outra pessoa — a recarregar…");
    void qc.invalidateQueries({ queryKey: ["stock-purchase-review", id] }).then(() => {
      setTimeout(() => setReloadNotice(null), 3000);
    });
  }

  const decideMutation = useMutation({
    mutationFn: (outcome: "create" | "skip") => api.decideUnresolved(id!, { expectedVersion: review!.version, outcome }),
    onSuccess: handleUpdated,
    onError: (e: unknown) => {
      if (isVersionConflict(e)) handleVersionConflict();
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (locationId: string | null) =>
      api.confirmReview(id!, {
        expectedVersion: review!.version,
        effectiveDate: effectiveDate || undefined,
        locationId: locationId ?? undefined,
      }),
    onSuccess: (updated) => {
      handleUpdated(updated);
      setNeedsConfirmLocation(false);
    },
    onError: (e: unknown) => {
      if (isVersionConflict(e)) {
        handleVersionConflict();
        return;
      }
      if (isLocationRequired(e)) {
        setNeedsConfirmLocation(true);
        return;
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.cancelReview(id!, { expectedVersion: review!.version, reason: cancelReason.trim() }),
    onSuccess: (updated) => {
      handleUpdated(updated);
      setShowCancel(false);
      setCancelReason("");
    },
    onError: (e: unknown) => {
      if (isVersionConflict(e)) handleVersionConflict();
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-stone-400">A carregar…</div>;
  if (isError || !review) return <div className="p-6 text-sm text-stone-400">Não foi possível carregar esta revisão.</div>;

  const unresolvedGateOpen = review.decisionSource === "unresolved";
  const isTerminal = review.status === "applied" || review.status === "cancelled";
  const unresolvedLinesCount = review.lines.filter((l) => l.resolutionType === "unresolved").length;

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
        <div>
          <button type="button" onClick={() => navigate("/stock/compras-por-rever")} className="mb-1 text-xs text-stone-400 hover:text-stone-600">
            ← Voltar à lista
          </button>
          <h1 className="text-xl font-bold text-stone-900">{review.supplierName} · {review.invoiceNumber}</h1>
          <p className="mt-0.5 text-sm text-stone-500">
            {formatDate(review.invoiceDate)} · {STOCK_PURCHASE_REVIEW_STATUS_LABELS[review.status]} · Origem da decisão: {DECISION_SOURCE_LABELS[review.decisionSource]}
          </p>
        </div>
        {!isTerminal && (
          <button
            type="button"
            onClick={() => setShowCancel(true)}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
          >
            Cancelar revisão
          </button>
        )}
      </div>

      {reloadNotice && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs font-medium text-amber-700">{reloadNotice}</div>
      )}

      <div className="space-y-4 p-6">
        {unresolvedGateOpen && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-stone-800">Este documento não tem uma decisão automática — afeta o stock?</p>
            <p className="mt-1 text-xs text-stone-500">Nenhuma categoria ou fornecedor associado indica se esta fatura deve gerar movimento de stock. Escolhe antes de resolver as linhas.</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => decideMutation.mutate("create")}
                disabled={decideMutation.isPending}
                className="rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Sim, afeta o stock
              </button>
              <button
                type="button"
                onClick={() => decideMutation.mutate("skip")}
                disabled={decideMutation.isPending}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
              >
                Não afeta
              </button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          {review.lines.map((line) => (
            <ReviewLineRow
              key={line.id}
              review={review}
              line={line}
              stockItems={stockItems}
              stockCategories={stockCategories}
              onResolved={handleUpdated}
              onVersionConflict={handleVersionConflict}
              unresolvedGateOpen={unresolvedGateOpen}
            />
          ))}
        </div>

        {!isTerminal && (
          <div className="rounded-xl border border-stone-200 bg-white p-4">
            {review.status !== "ready" ? (
              <p className="text-xs text-stone-500">
                Confirmação indisponível — {unresolvedLinesCount > 0 ? `faltam ${unresolvedLinesCount} linha(s) por resolver.` : "estado atual não permite confirmar."}
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className={labelCls}>Data efetiva (opcional)</label>
                    <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className={inputCls} />
                  </div>
                  {needsConfirmLocation && (
                    <LocationSelect value={confirmLocationId} onChange={setConfirmLocationId} label="Loja (obrigatório)" />
                  )}
                  <button
                    type="button"
                    onClick={() => confirmMutation.mutate(confirmLocationId)}
                    disabled={confirmMutation.isPending}
                    className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {confirmMutation.isPending ? "A confirmar…" : "Confirmar e adicionar ao stock"}
                  </button>
                </div>
                {confirmMutation.isError && !isVersionConflict(confirmMutation.error) && !isLocationRequired(confirmMutation.error) && (
                  <p className="text-xs text-red-600">
                    {confirmMutation.error instanceof Error ? confirmMutation.error.message : "Erro ao confirmar."}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {review.cancellationReason && (
          <p className="text-xs text-stone-400">Motivo do cancelamento: {review.cancellationReason}</p>
        )}
      </div>

      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-stone-900">Cancelar revisão</h3>
            <p className="mt-1 text-xs text-stone-500">Indica o motivo do cancelamento.</p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className={`${inputCls} mt-2`}
              placeholder="Motivo"
            />
            {cancelMutation.isError && !isVersionConflict(cancelMutation.error) && (
              <p className="mt-1 text-xs text-red-600">
                {cancelMutation.error instanceof Error ? cancelMutation.error.message : "Erro ao cancelar."}
              </p>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCancel(false)} className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
                Fechar
              </button>
              <button
                type="button"
                onClick={() => cancelMutation.mutate()}
                disabled={!cancelReason.trim() || cancelMutation.isPending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {cancelMutation.isPending ? "A cancelar…" : "Confirmar cancelamento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
