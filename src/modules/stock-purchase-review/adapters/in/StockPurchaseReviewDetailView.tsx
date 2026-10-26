import { Fragment, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStockPurchaseReviewModule } from "../../stock-purchase-review.module.tsx";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import { ApiError } from "../../../../lib/api.ts";
import { PackagingPanel } from "./PackagingPanel.tsx";
import { invoiceQuantityUnit, unitFactor } from "../../domain/services/presentation.ts";
import {
  COMPACT_STATE_LABELS,
  compactKpis,
  reviewProgress,
  compactRows,
  rowBreakdown,
  matchesFilter,
  sortRows,
  type CompactFilter,
  type CompactRow,
  type CompactState,
} from "../../domain/services/compact-review.ts";
import { EntryRulesModal } from "./EntryRulesModal.tsx";
import { ReviewProgressCard } from "./ReviewProgressCard.tsx";
import {
  STOCK_PURCHASE_REVIEW_STATUS_LABELS,
  RESOLUTION_TYPE_LABELS,
  CATEGORY_DIVERGENCE_LABELS,
  SUGGESTION_SOURCE_LABELS,
  type StockPurchaseReviewDTO,
  type StockReviewLineDTO,
  type StockItemOptionDTO,
  type StockCategoryOptionDTO,
  type ResolveStockReviewLinePayload,
  type CategoryDivergenceDTO,
} from "../../domain/entities/stock-purchase-review.ts";

function fromCents(n: number): string {
  return (n / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function formatDate(s: string): string {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

const qtyFmt = (n: number) => n.toLocaleString("pt-PT", { maximumFractionDigits: 6 });
const parseQty = (s: string) => parseFloat(s.replace(",", "."));

const inputCls =
  "w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-[#ED5C32]";
const labelCls = "mb-1 block text-xs font-medium text-stone-500";

const STOCK_ITEM_TYPE_OPTIONS = [
  { value: "ingredient", label: "Ingrediente" },
  { value: "other", label: "Outro" },
];

const BASE_UNIT_OPTIONS = ["g", "kg", "ml", "cl", "l", "un"];

const TERMINAL_STATUSES = ["applied", "cancelled", "excluded"];

function isVersionConflict(e: unknown): e is ApiError {
  return e instanceof ApiError && e.status === 409;
}

function isLocationRequired(e: unknown): e is ApiError {
  return e instanceof ApiError && e.status === 400 && typeof (e.data as { error?: unknown })?.error === "string"
    && /loja|location/i.test(String((e.data as { error?: string }).error));
}

/**
 * Pedido de resolução a partir da conciliação proposta, quando está completa (artigo + fator,
 * ou «não é item de stock»). null = precisa de ajuste (sem fator, ou embalagem mudou sem fator).
 */
function suggestionPayload(review: StockPurchaseReviewDTO, line: StockReviewLineDTO): ResolveStockReviewLinePayload | null {
  const sg = line.suggestion;
  if (!sg || sg.source === "none" || !sg.resolution) return null;
  if (sg.resolution === "no_stock_effect") return { expectedVersion: review.version, resolution: "no_stock_effect" };
  if (!sg.stockItemId || sg.conversionFactor == null || sg.conversionFactor <= 0) return null;
  return { expectedVersion: review.version, resolution: "existing_item", stockItemId: sg.stockItemId, conversionFactor: sg.conversionFactor, locationId: line.locationId };
}

interface LineRowProps {
  review: StockPurchaseReviewDTO;
  line: StockReviewLineDTO;
  stockItems: StockItemOptionDTO[];
  stockCategories: StockCategoryOptionDTO[];
  onResolved: (updated: StockPurchaseReviewDTO) => void;
  onVersionConflict: () => void;
  unresolvedGateOpen: boolean;
  /** Embalagem de compra gravada: recarregar a revisão (pré-visualização e propostas). */
  onPackagingSaved: () => void;
}

type SplitRow = { locationId: string | null; quantity: string };

function ReviewLineRow({ review, line, stockItems, stockCategories, onResolved, onVersionConflict, unresolvedGateOpen, onPackagingSaved }: LineRowProps) {
  const { api } = useStockPurchaseReviewModule();
  const { hasMultipleLocations } = useLocations();
  const isResolved = line.resolutionType !== "unresolved";
  const isTerminal = TERMINAL_STATUSES.includes(review.status);
  const [editing, setEditing] = useState(!isResolved);

  const [mode, setMode] = useState<"existing_item" | "new_item" | "no_stock_effect">(
    line.resolutionType === "unresolved" ? "existing_item" : (line.resolutionType as "existing_item" | "new_item" | "no_stock_effect"),
  );
  const [stockItemId, setStockItemId] = useState(line.stockItemId ?? "");
  const [conversionFactor, setConversionFactor] = useState(line.conversionFactor != null ? String(line.conversionFactor) : "1");
  // V5 §2.4: sem destino na fatura — guarda o que a linha já tiver; a loja vem da localização principal.
  const [locationId] = useState<string | null>(line.locationId);
  const [splitMode] = useState(!!line.locationSplits?.length);
  const [splits] = useState<SplitRow[]>(
    line.locationSplits?.length
      ? line.locationSplits.map((sp) => ({ locationId: sp.locationId, quantity: String(sp.purchaseQuantity) }))
      : [{ locationId: null, quantity: "" }, { locationId: null, quantity: "" }],
  );
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategoryId, setNewItemCategoryId] = useState("");
  const [newItemType, setNewItemType] = useState("ingredient");
  const [newItemBaseUnit, setNewItemBaseUnit] = useState("un");
  const [suggestionAccepted, setSuggestionAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestion = line.suggestion && line.suggestion.source !== "none" && line.suggestion.resolution ? line.suggestion : null;
  const acceptable = suggestion ? suggestionPayload(review, line) : null;

  const resolveMutation = useMutation({
    mutationFn: (payload: ResolveStockReviewLinePayload) => api.resolveLine(review.id, line.id, payload),
    onSuccess: (updated) => {
      setEditing(false);
      onResolved(updated);
    },
    onError: (e: unknown) => {
      if (isVersionConflict(e)) {
        onVersionConflict();
        return;
      }
      setError(e instanceof Error ? e.message : "Erro ao guardar");
    },
  });

  // A fatura conta em kg/l e a conversão da linha dá menos de 1 kg/l no artigo (ex.: 1 kg = 1 g) — o
  // servidor recusa confirmar; aqui oferece-se a correção num clique.
  const resolvedItem = line.stockItemId ? stockItems.find((i) => i.id === line.stockItemId) : undefined;
  const lineInvoiceUnit = invoiceQuantityUnit(line.purchaseUnit, line.description);
  const expectedFactor = resolvedItem && lineInvoiceUnit ? unitFactor(lineInvoiceUnit, resolvedItem.baseUnit) : null;
  const suspicious =
    (line.resolutionType === "existing_item" || line.resolutionType === "new_item") &&
    expectedFactor !== null && line.conversionFactor != null && line.conversionFactor < expectedFactor;

  /** Volta a gravar a linha com outro fator, mantendo o artigo e o destino. */
  function reResolveWithFactor(factor: number) {
    if (!line.stockItemId) return;
    setError(null);
    resolveMutation.mutate({
      expectedVersion: review.version,
      resolution: "existing_item",
      stockItemId: line.stockItemId,
      conversionFactor: factor,
      ...(line.locationSplits?.length ? { locationSplits: line.locationSplits, locationId: null } : { locationId: line.locationId }),
    });
  }

  const splitSum = splits.reduce((acc, sp) => acc + (Number.isFinite(parseQty(sp.quantity)) ? parseQty(sp.quantity) : 0), 0);

  // Fatura em kg/l e artigo em g/ml: a conversão é exata e automática; o campo só aparece se for preciso.
  const [manualFactor, setManualFactor] = useState(false);
  const selectedBaseUnit = mode === "new_item" ? newItemBaseUnit : stockItems.find((i) => i.id === stockItemId)?.baseUnit;
  const autoFactor = lineInvoiceUnit && selectedBaseUnit ? unitFactor(lineInvoiceUnit, selectedBaseUnit) : null;
  const conversionField = (
    <div>
      {lineInvoiceUnit && !selectedBaseUnit && !manualFactor ? (
        <p className="pt-5 text-xs text-stone-500">A fatura conta em {lineInvoiceUnit}: a conversão é automática ao escolher o artigo.</p>
      ) : autoFactor && !manualFactor ? (
        <p className="pt-5 text-xs text-stone-600">
          Conversão automática: <span className="font-medium tabular-nums">1 {lineInvoiceUnit} = {qtyFmt(autoFactor)} {selectedBaseUnit}</span>{" "}
          <button
            type="button"
            onClick={() => {
              setConversionFactor(String(autoFactor));
              setManualFactor(true);
            }}
            className="text-stone-400 underline hover:text-stone-600"
          >
            alterar
          </button>
        </p>
      ) : (
        <>
          <label className={labelCls}>
            Quanto tem 1 {lineInvoiceUnit ?? line.purchaseUnit}? (em {selectedBaseUnit ?? "unidade do artigo"})
          </label>
          <input type="text" inputMode="decimal" aria-label="Conversão" value={conversionFactor} onChange={(e) => setConversionFactor(e.target.value)} className={inputCls} />
        </>
      )}
    </div>
  );

  function applySuggestion() {
    if (!suggestion) return;
    setSuggestionAccepted(true);
    if (suggestion.resolution === "no_stock_effect") {
      setMode("no_stock_effect");
      return;
    }
    setMode("existing_item");
    setStockItemId(suggestion.stockItemId ?? "");
    if (suggestion.conversionFactor != null) setConversionFactor(String(suggestion.conversionFactor));
  }

  /** null = sem divisão; undefined = divisão inválida (erro já mostrado). */
  function readSplits(): ResolveStockReviewLinePayload["locationSplits"] | undefined {
    if (!splitMode || !hasMultipleLocations) return null;
    const rows = splits.map((sp) => ({ locationId: sp.locationId, purchaseQuantity: parseQty(sp.quantity) }));
    if (rows.some((r) => !r.locationId || !Number.isFinite(r.purchaseQuantity) || r.purchaseQuantity <= 0)) {
      setError("Indica a loja e a quantidade de cada parte da divisão.");
      return undefined;
    }
    if (new Set(rows.map((r) => r.locationId)).size !== rows.length) {
      setError("A mesma loja aparece duas vezes na divisão.");
      return undefined;
    }
    if (Math.abs(splitSum - line.purchaseQuantity) > 0.000001) {
      setError(`A divisão soma ${qtyFmt(splitSum)} ${line.purchaseUnit}; tem de somar ${qtyFmt(line.purchaseQuantity)} ${line.purchaseUnit}.`);
      return undefined;
    }
    return rows.map((r) => ({ locationId: r.locationId!, purchaseQuantity: r.purchaseQuantity }));
  }

  function handleResolve() {
    setError(null);
    if (mode === "no_stock_effect") {
      resolveMutation.mutate({ expectedVersion: review.version, resolution: "no_stock_effect" });
      return;
    }
    // Conversão automática (kg → g) sem campo; senão o valor escrito.
    const factor = autoFactor && !manualFactor ? autoFactor : parseQty(conversionFactor);
    if (!Number.isFinite(factor) || factor <= 0) {
      setError("Fator de conversão inválido.");
      return;
    }
    const locationSplits = readSplits();
    if (locationSplits === undefined) return;
    const destination = locationSplits ? { locationSplits, locationId: null } : { locationId };
    if (mode === "existing_item") {
      if (!stockItemId) {
        setError("Escolhe um artigo de stock.");
        return;
      }
      resolveMutation.mutate({ expectedVersion: review.version, resolution: "existing_item", stockItemId, conversionFactor: factor, ...destination });
      return;
    }
    if (!newItemName.trim() || !newItemCategoryId) {
      setError("Preenche o nome e a categoria do artigo novo.");
      return;
    }
    resolveMutation.mutate({
      expectedVersion: review.version,
      resolution: "new_item",
      newItem: { name: newItemName.trim(), categoryId: newItemCategoryId, type: newItemType, baseUnit: newItemBaseUnit },
      conversionFactor: factor,
      ...destination,
    });
  }

  const amounts = [
    `${qtyFmt(line.purchaseQuantity)} ${lineInvoiceUnit ?? line.purchaseUnit} × ${fromCents(line.unitCostWithoutVat)}`,
    line.discountAmount ? `desconto ${fromCents(line.discountAmount)}` : null,
    line.netAmount != null ? `base ${fromCents(line.netAmount)}` : null,
    line.vatAmount != null ? `IVA ${fromCents(line.vatAmount)}` : null,
    `total ${fromCents(line.totalWithVat)}`,
  ].filter(Boolean);

  return (
    <div className="border-b border-stone-100 p-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-stone-800">
            {line.description}
            {line.supplierItemCode && <span className="ml-2 text-xs font-normal text-stone-400">ref. {line.supplierItemCode}</span>}
          </p>
          <p className="text-xs tabular-nums text-stone-500">{amounts.join(" · ")}</p>
        </div>
        <p className={`text-xs font-medium ${line.resolutionType === "unresolved" ? "text-amber-700" : line.resolutionType === "no_stock_effect" ? "text-stone-500" : "text-emerald-700"}`}>
          {RESOLUTION_TYPE_LABELS[line.resolutionType]}
        </p>
      </div>

      {!lineInvoiceUnit && (
      <PackagingPanel
        review={review}
        line={line}
        stockItemId={editing && mode === "existing_item" && stockItemId ? stockItemId : line.stockItemId}
        stockItems={stockItems}
        readOnly={isTerminal || unresolvedGateOpen}
        onSaved={(factor) => {
          // O fator vem da embalagem confirmada (nunca um número opaco escrito à mão).
          if (factor && editing) setConversionFactor(String(factor));
          // Linha já associada: a embalagem nova passa logo para a linha (antes ficava o fator antigo).
          else if (factor && !editing && !isTerminal && line.stockItemId && factor !== line.conversionFactor) reResolveWithFactor(factor);
          onPackagingSaved();
        }}
      />
      )}

      {suspicious && !isTerminal && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-800">
          <span>
            A fatura conta em <span className="font-semibold">{lineInvoiceUnit}</span>, mas a conversão está 1 {lineInvoiceUnit} = {qtyFmt(line.conversionFactor ?? 0)} {resolvedItem!.baseUnit}.
          </span>
          <button
            type="button"
            disabled={resolveMutation.isPending}
            onClick={() => reResolveWithFactor(expectedFactor!)}
            className="rounded bg-red-700 px-2 py-0.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Corrigir: 1 {lineInvoiceUnit} = {qtyFmt(expectedFactor!)} {resolvedItem!.baseUnit}
          </button>
        </div>
      )}

      {line.flaggedSuspiciousConversion && (
        <p className="mt-1 text-xs text-amber-600">Aviso: conversão pouco habitual{line.flagReason ? ` — ${line.flagReason}` : ""}. Confirma antes de avançar.</p>
      )}

      {isResolved && !editing ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
          <p>
            {line.resolutionType === "existing_item" || line.resolutionType === "new_item"
              ? <>
                  {stockItems.find((i) => i.id === line.stockItemId)?.name ?? "Artigo"} · {qtyFmt(line.purchaseQuantity)} {lineInvoiceUnit ?? line.purchaseUnit} →{" "}
                  {qtyFmt(line.stockQuantity ?? 0)} {resolvedItem?.baseUnit ?? ""}
                </>
              : "Fica no documento e na classificação financeira; não entra no inventário."}
            {line.autoResolved && (
              <span className="ml-2 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700" title="Decisão já confirmada antes para esta linha deste fornecedor — aplicada sem perguntar. Pode alterar.">
                Associado automaticamente
              </span>
            )}
          </p>
          {!isTerminal && (
            <button type="button" onClick={() => setEditing(true)} className="rounded border border-stone-300 px-2 py-0.5 font-medium text-stone-600 hover:bg-stone-50">
              Alterar
            </button>
          )}
        </div>
      ) : unresolvedGateOpen ? (
        <p className="mt-2 text-xs text-stone-400">Responde primeiro se esta fatura afeta o stock.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {suggestion && !suggestionAccepted && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-sky-300 bg-sky-50 px-2.5 py-1.5 text-xs text-sky-900">
              <span>
                <span className="font-semibold">Conciliação proposta</span> (não confirmada):{" "}
                {suggestion.resolution === "no_stock_effect"
                  ? "não é item de stock"
                  : `${stockItems.find((i) => i.id === suggestion.stockItemId)?.name ?? "artigo"}${suggestion.conversionFactor != null ? ` · fator ${qtyFmt(suggestion.conversionFactor)}` : " · fator por preencher"}`}
                <span className="text-sky-700">
                  {" "}— {SUGGESTION_SOURCE_LABELS[suggestion.source as keyof typeof SUGGESTION_SOURCE_LABELS]}
                  {suggestion.source !== "learned" && suggestion.confidence != null ? ` ${Math.round(suggestion.confidence * 100)}%` : ""}
                </span>
              </span>
              {suggestion.packagingChanged && <span className="text-amber-700">A embalagem mudou desde a última compra: confere o fator.</span>}
              <span className="ml-auto flex gap-1.5">
                {acceptable && (
                  <button
                    type="button"
                    disabled={resolveMutation.isPending}
                    onClick={() => resolveMutation.mutate(acceptable)}
                    className="rounded bg-sky-700 px-2 py-0.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Aceitar
                  </button>
                )}
                <button type="button" onClick={applySuggestion} className="rounded border border-sky-300 bg-white px-2 py-0.5 font-medium text-sky-800 hover:bg-sky-100">
                  Ajustar
                </button>
              </span>
            </div>
          )}

          <div className="flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 text-xs">
            {(
              [
                { key: "existing_item" as const, label: "Associar artigo" },
                { key: "new_item" as const, label: "Criar artigo" },
                { key: "no_stock_effect" as const, label: "Não é item de stock" },
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
                <label className={labelCls}>Artigo de stock</label>
                <select value={stockItemId} onChange={(e) => setStockItemId(e.target.value)} className={inputCls}>
                  <option value="">— selecionar —</option>
                  {stockItems.map((i) => (
                    <option key={i.id} value={i.id} disabled={!i.isActive}>
                      {i.name}{!i.isActive ? " (inativo)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              {conversionField}
            </div>
          )}

          {mode === "new_item" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className={labelCls}>Nome do artigo novo</label>
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
              {conversionField}
            </div>
          )}

          {mode === "no_stock_effect" && (
            <p className="text-xs text-stone-500">A linha fica no documento e na classificação financeira, mas não aumenta o inventário.</p>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleResolve}
              disabled={resolveMutation.isPending}
              className="rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {resolveMutation.isPending ? "A guardar…" : mode === "no_stock_effect" ? "Marcar como não é item de stock" : "Guardar"}
            </button>
            {isResolved && (
              <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const STATE_TONE: Record<CompactState, string> = {
  resolved: "bg-emerald-50 text-emerald-700",
  confirm: "bg-sky-50 text-sky-700",
  review: "bg-amber-50 text-amber-800",
  out: "bg-stone-100 text-stone-600",
};

const FILTERS: { key: CompactFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "pending", label: "Por rever" },
  { key: "stock", label: "Artigos para Stock" },
  { key: "out", label: "Fora do Stock" },
];

/**
 * Lista compacta da conciliação (task V5 §2.1): uma linha por artigo (linhas equivalentes juntas só
 * no ecrã — no servidor cada linha da fatura continua individual), estado, e um único painel aberto
 * de cada vez para ver ou rever. Ordem V4: Artigos para Stock → Por rever → Fora do Stock.
 */
function CompactReviewList({
  review,
  stockItems,
  renderLine,
  filter,
  onFilter: setFilter,
}: {
  review: StockPurchaseReviewDTO;
  stockItems: StockItemOptionDTO[];
  renderLine: (line: StockReviewLineDTO) => React.ReactNode;
  filter: CompactFilter;
  onFilter: (f: CompactFilter) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const rows = sortRows(compactRows(review, (itemId) => stockItems.find((i) => i.id === itemId)));
  const visible = rows.filter((r) => matchesFilter(r, filter));
  const count = (k: CompactFilter) => rows.filter((r) => matchesFilter(r, k)).length;
  const action = (r: CompactRow) => (r.state === "confirm" || r.state === "review" ? "Rever" : "Ver");
  return (
    <section aria-label="Linhas da fatura" className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div role="tablist" aria-label="Filtrar linhas" className="flex flex-wrap gap-1 border-b border-stone-100 px-3 py-2">
        {FILTERS.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={filter === x.key}
            onClick={() => setFilter(x.key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${filter === x.key ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-100"}`}
          >
            {x.label} <span className="tabular-nums opacity-70">{count(x.key)}</span>
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-stone-400">
              <th className="px-4 py-2 font-medium">Artigo</th>
              <th className="px-3 py-2 font-medium">Na fatura</th>
              <th className="px-3 py-2 text-right font-medium">Faturado</th>
              <th className="px-3 py-2 text-right font-medium">Entrada prevista</th>
              <th className="px-3 py-2 text-right font-medium">Custo líquido</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2"><span className="sr-only">Ação</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {visible.map((r) => (
              <Fragment key={r.key}>
                <tr className={open === r.key ? "bg-stone-50" : "hover:bg-stone-50/60"}>
                  <td className="px-4 py-2">
                    <p className="font-medium text-stone-800">{r.label}</p>
                    {r.lines[0]!.resolvedBy?.includes("depósito de embalagem") && (
                      <p className="text-[11px] text-stone-400">Depósito de embalagem (devolvível) — fora do Stock automaticamente</p>
                    )}
                    {(r.reference || r.lines.length > 1) && (
                      <p className="text-[11px] text-stone-400">
                        {r.reference ? `ref. ${r.reference}` : ""}
                        {r.lines.length > 1 ? `${r.reference ? " · " : ""}${r.lines.length} linhas da fatura` : ""}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums text-stone-500">
                    <p className="whitespace-nowrap">{rowBreakdown(r)}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-stone-700">{r.invoiced}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-stone-700">{r.expected ? `${qtyFmt(r.expected.quantity)} ${r.expected.unit}` : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-stone-700">{fromCents(r.netCents)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ${STATE_TONE[r.state]}`}>{COMPACT_STATE_LABELS[r.state]}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      aria-expanded={open === r.key}
                      onClick={() => setOpen(open === r.key ? null : r.key)}
                      className={`rounded px-2 py-0.5 text-xs font-medium ${action(r) === "Rever" ? "bg-amber-100 text-amber-900 hover:bg-amber-200" : "text-stone-500 hover:bg-stone-100"}`}
                    >
                      {open === r.key ? "Fechar" : action(r)}
                    </button>
                  </td>
                </tr>
                {open === r.key && (
                  <tr>
                    <td colSpan={7} className="bg-stone-50/60 p-0">
                      {r.lines.map((l) => renderLine(l))}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-xs text-stone-400">Sem linhas neste filtro.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DivergenceList({ divergences }: { divergences: CategoryDivergenceDTO[] }) {
  return (
    <ul className="mt-1 space-y-0.5">
      {divergences.map((d) => (
        <li key={d.lineId}>
          <span className="font-medium">{d.description}</span> — {CATEGORY_DIVERGENCE_LABELS[d.kind]}.
        </li>
      ))}
    </ul>
  );
}

/**
 * Detalhe de uma "Compra por rever": cada linha real da fatura fica como
 * «Associar artigo» / «Criar artigo» / «Não é item de stock», com as três
 * conferências da F3a. O botão de confirmação só fica ativo com
 * `status === "ready"` (todas as linhas resolvidas) e o documento a bater.
 */
export function StockPurchaseReviewDetailView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { api } = useStockPurchaseReviewModule();

  const [reloadNotice, setReloadNotice] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [lineFilter, setLineFilter] = useState<CompactFilter>("all");
  const [cancelReason, setCancelReason] = useState("");
  const [needsDefaultLocation, setNeedsDefaultLocation] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
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

  // Conciliação (F3b): ao abrir, procura propostas para as linhas por resolver que ainda não as têm.
  const suggestMutation = useMutation({
    mutationFn: (refresh: boolean) => api.suggestMappings(id!, { refresh }),
    onSuccess: handleUpdated,
  });
  const suggestedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!review || suggestedFor.current === review.id) return;
    if (TERMINAL_STATUSES.includes(review.status) || review.decisionSource === "unresolved") return;
    if (review.lines.some((l) => l.resolutionType === "unresolved" && !l.suggestion)) {
      suggestedFor.current = review.id;
      suggestMutation.mutate(false);
    }
  }, [review, suggestMutation]);

  const [acceptingAll, setAcceptingAll] = useState(false);
  async function acceptAllSuggestions() {
    if (!review) return;
    let current = review;
    setAcceptingAll(true);
    try {
      for (const line of review.lines) {
        if (line.resolutionType !== "unresolved") continue;
        const payload = suggestionPayload(current, line);
        if (!payload) continue;
        current = await api.resolveLine(current.id, line.id, { ...payload, expectedVersion: current.version });
        handleUpdated(current);
      }
    } catch (e) {
      if (isVersionConflict(e)) handleVersionConflict();
      else setReloadNotice(e instanceof Error ? e.message : "Erro ao aceitar as propostas.");
    } finally {
      setAcceptingAll(false);
    }
  }

  const restoreMutation = useMutation({
    mutationFn: () => api.restoreReview(id!, { expectedVersion: review!.version }),
    onSuccess: handleUpdated,
    onError: (e: unknown) => {
      if (isVersionConflict(e)) handleVersionConflict();
    },
  });

  const decideMutation = useMutation({
    mutationFn: (outcome: "create" | "skip") => api.decideUnresolved(id!, { expectedVersion: review!.version, outcome }),
    onSuccess: handleUpdated,
    onError: (e: unknown) => {
      if (isVersionConflict(e)) handleVersionConflict();
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      api.confirmReview(id!, {
        expectedVersion: review!.version,
        effectiveDate: effectiveDate || undefined,
      }),
    onSuccess: (updated) => {
      handleUpdated(updated);
      setNeedsDefaultLocation(false);
    },
    onError: (e: unknown) => {
      if (isVersionConflict(e)) {
        handleVersionConflict();
        return;
      }
      if (isLocationRequired(e)) {
        setNeedsDefaultLocation(true);
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
  const isTerminal = TERMINAL_STATUSES.includes(review.status);
  const unresolvedLinesCount = review.lines.filter((l) => l.resolutionType === "unresolved").length;
  const documentMismatch = review.conference?.document.status === "mismatch";
  const allNonStock = review.lines.length > 0 && review.lines.every((l) => l.resolutionType === "no_stock_effect");
  const acceptableCount = review.lines.filter((l) => l.resolutionType === "unresolved" && suggestionPayload(review, l)).length;
  const kpis = compactKpis(review);
  const progress = reviewProgress(review);
  const divergences = review.conference?.categories.divergences ?? [];

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
        <div>
          <button type="button" onClick={() => navigate("/stock/compras-por-rever")} className="mb-1 text-xs text-stone-400 hover:text-stone-600">
            ← Voltar à lista
          </button>
          <h1 className="text-xl font-bold text-stone-900">{review.supplierName}</h1>
          <p className="mt-0.5 text-sm text-stone-500">
            {review.invoiceNumber} · {formatDate(review.invoiceDate)} · {STOCK_PURCHASE_REVIEW_STATUS_LABELS[review.status]}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {review.attachmentUrl ? (
          <a
            href={review.attachmentUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            Ver fatura
          </a>
        ) : (
          <span className="rounded-md border border-dashed border-stone-300 px-3 py-1.5 text-xs text-stone-400" title="Esta fatura não tem o PDF anexado">
            Sem PDF da fatura
          </span>
        )}
        {!isTerminal && (
          <button
            type="button"
            onClick={() => setShowCancel(true)}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
          >
            Retirar de Compras por rever
          </button>
        )}
        {review.status === "cancelled" && (
          <button
            type="button"
            onClick={() => restoreMutation.mutate()}
            disabled={restoreMutation.isPending}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            {restoreMutation.isPending ? "A repor…" : "Repor em Compras por rever"}
          </button>
        )}
        </div>
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

        {review.financePending && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs text-sky-900">
            <p className="font-semibold">Importada no Stock — aguarda lançamento no Financeiro.</p>
            <p className="mt-0.5">
              Pode conciliar já. Para dar entrada antes do Financeiro, a fatura tem de ter fornecedor e número e as linhas têm de bater com a base e o IVA. Não é aprovação contabilística nem cria conta a pagar.
            </p>
          </div>
        )}

        <ReviewProgressCard progress={progress} filter={lineFilter} onFilter={setLineFilter} />

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {[
            { label: "Artigos distintos para Stock", value: String(kpis.stockItems) },
            { label: "Base sem IVA", value: kpis.netCents != null ? fromCents(kpis.netCents) : "—" },
            { label: "Total da fatura", value: kpis.totalCents != null ? fromCents(kpis.totalCents) : "—", detail: kpis.vatCents != null ? `IVA ${fromCents(kpis.vatCents)}` : null },
          ].map((k) => (
            <div key={k.label} className="rounded-lg border border-stone-200 bg-white px-3 py-2">
              <p className="text-[11px] text-stone-500">{k.label}</p>
              <p className="text-base font-semibold tabular-nums text-stone-900">{k.value}</p>
              {"detail" in k && k.detail && <p className="text-[11px] tabular-nums text-stone-400">{k.detail}</p>}
            </div>
          ))}
        </div>

        {!isTerminal && documentMismatch && review.conference && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            As linhas não batem com a fatura (base {fromCents(review.conference.document.netDifferenceCents ?? 0)} · IVA {fromCents(review.conference.document.vatDifferenceCents ?? 0)}) — corrigir no Financeiro antes de dar entrada.
          </p>
        )}
        {!isTerminal && divergences.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <p className="font-medium">Pendência para o Financeiro — categorias (não impede a entrada)</p>
            <DivergenceList divergences={divergences} />
          </div>
        )}

        {isTerminal && review.categoryDivergences && review.categoryDivergences.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-semibold">Pendência para o Financeiro — categorias</p>
            <DivergenceList divergences={review.categoryDivergences} />
          </div>
        )}

        {!isTerminal && !unresolvedGateOpen && unresolvedLinesCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-xs text-stone-600">
            <p>
              {suggestMutation.isPending
                ? "A procurar conciliações (histórico do fornecedor, nomes do catálogo e IA)…"
                : acceptableCount > 0
                  ? `${acceptableCount} linha(s) com conciliação proposta pronta a aceitar — confirma antes de aceitar.`
                  : "Sem propostas completas para as linhas por resolver."}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => suggestMutation.mutate(true)}
                disabled={suggestMutation.isPending || acceptingAll}
                className="rounded-md border border-stone-300 px-3 py-1.5 font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                Procurar de novo
              </button>
              {acceptableCount > 0 && (
                <button
                  type="button"
                  onClick={() => void acceptAllSuggestions()}
                  disabled={acceptingAll || suggestMutation.isPending}
                  className="rounded-md bg-sky-700 px-3 py-1.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {acceptingAll ? "A aceitar…" : acceptableCount === 1 ? "Aceitar a proposta" : `Aceitar as ${acceptableCount} propostas`}
                </button>
              )}
            </div>
          </div>
        )}

        <CompactReviewList
          review={review}
          stockItems={stockItems}
          filter={lineFilter}
          onFilter={setLineFilter}
          renderLine={(line) => (
            <ReviewLineRow
              key={line.id}
              review={review}
              line={line}
              stockItems={stockItems}
              stockCategories={stockCategories}
              onResolved={handleUpdated}
              onVersionConflict={handleVersionConflict}
              unresolvedGateOpen={unresolvedGateOpen}
              onPackagingSaved={() => void qc.invalidateQueries({ queryKey: ["stock-purchase-review", id] })}
            />
          )}
        />

        {!isTerminal && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
            <p className={`text-xs ${kpis.pending > 0 || documentMismatch ? "font-medium text-amber-800" : "text-stone-500"}`}>
              {kpis.pending > 0
                ? `${kpis.pending} linha(s) por rever.`
                : documentMismatch
                  ? "As linhas não batem com a fatura."
                  : review.status === "ready"
                    ? "Tudo resolvido — pronto a dar entrada."
                    : "Estado atual não permite confirmar."}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[11px] text-stone-500">
                Data efetiva
                <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className={`${inputCls} mt-0.5 py-1 text-xs`} />
              </label>
              <button
                type="button"
                onClick={() => navigate("/stock/compras-por-rever")}
                className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50"
              >
                Guardar para rever depois
              </button>
              <button
                type="button"
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending || review.status !== "ready" || documentMismatch}
                className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {confirmMutation.isPending ? "A confirmar…" : allNonStock ? "Confirmar — não afeta Stock" : "Confirmar entrada no Stock"}
              </button>
            </div>
            {needsDefaultLocation && (
              <p className="w-full rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Há várias lojas ativas e ainda não há localização principal do Stock.{" "}
                <button type="button" onClick={() => setRulesOpen(true)} className="font-semibold underline">
                  Definir localização principal
                </button>{" "}
                (uma vez) e voltar a confirmar.
              </p>
            )}
            {confirmMutation.isError && !isVersionConflict(confirmMutation.error) && !isLocationRequired(confirmMutation.error) && (
              <p className="w-full text-xs text-red-600">{confirmMutation.error instanceof Error ? confirmMutation.error.message : "Erro ao confirmar."}</p>
            )}
          </div>
        )}
        {review.status === "applied" && <p className="text-xs font-medium text-emerald-700">Entrada no Stock confirmada.</p>}
        {rulesOpen && <EntryRulesModal onClose={() => setRulesOpen(false)} />}

        {review.cancellationReason && (
          <p className="text-xs text-stone-400">Motivo da retirada: {review.cancellationReason}</p>
        )}
      </div>

      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-stone-900">Retirar de Compras por rever</h3>
            <p className="mt-1 text-xs text-stone-500">
              Retira só esta compra da fila do Stock. A fatura, a conta a pagar, os pagamentos e a conciliação bancária não são alterados. Fica no Histórico e pode ser reposta. Indica o motivo.
            </p>
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
                {cancelMutation.isPending ? "A retirar…" : "Retirar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
