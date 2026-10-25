import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useStockPurchaseReviewModule } from "../../stock-purchase-review.module.tsx";
import { LocationSelect } from "../../../../components/LocationSelect.tsx";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import { ApiError } from "../../../../lib/api.ts";
import {
  STOCK_PURCHASE_REVIEW_STATUS_LABELS,
  DECISION_SOURCE_LABELS,
  RESOLUTION_TYPE_LABELS,
  CATEGORY_DIVERGENCE_LABELS,
  type StockPurchaseReviewDTO,
  type StockReviewLineDTO,
  type StockItemOptionDTO,
  type StockCategoryOptionDTO,
  type StockReviewLineSuggestionDTO,
  type ResolveStockReviewLinePayload,
  type ReviewConferenceDTO,
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

interface LineRowProps {
  review: StockPurchaseReviewDTO;
  line: StockReviewLineDTO;
  stockItems: StockItemOptionDTO[];
  stockCategories: StockCategoryOptionDTO[];
  onResolved: (updated: StockPurchaseReviewDTO) => void;
  onVersionConflict: () => void;
  unresolvedGateOpen: boolean;
}

type SplitRow = { locationId: string | null; quantity: string };

function ReviewLineRow({ review, line, stockItems, stockCategories, onResolved, onVersionConflict, unresolvedGateOpen }: LineRowProps) {
  const { api } = useStockPurchaseReviewModule();
  const { activeLocations, hasMultipleLocations } = useLocations();
  const isResolved = line.resolutionType !== "unresolved";
  const isTerminal = TERMINAL_STATUSES.includes(review.status);
  const [editing, setEditing] = useState(!isResolved);

  const [mode, setMode] = useState<"existing_item" | "new_item" | "no_stock_effect">(
    line.resolutionType === "unresolved" ? "existing_item" : (line.resolutionType as "existing_item" | "new_item" | "no_stock_effect"),
  );
  const [stockItemId, setStockItemId] = useState(line.stockItemId ?? "");
  const [conversionFactor, setConversionFactor] = useState(line.conversionFactor != null ? String(line.conversionFactor) : "1");
  const [locationId, setLocationId] = useState<string | null>(line.locationId);
  const [splitMode, setSplitMode] = useState(!!line.locationSplits?.length);
  const [splits, setSplits] = useState<SplitRow[]>(
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

  const { data: suggestion } = useQuery<StockReviewLineSuggestionDTO | null>({
    queryKey: ["stock-review-line-suggestion", review.id, line.id],
    queryFn: () => api.getLineSuggestion(review.id, line.id),
    enabled: editing && !isResolved && !unresolvedGateOpen,
  });

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

  const locationName = (id: string | null) => activeLocations.find((l) => l.id === id)?.name ?? "—";
  const splitSum = splits.reduce((acc, sp) => acc + (Number.isFinite(parseQty(sp.quantity)) ? parseQty(sp.quantity) : 0), 0);

  function applySuggestion() {
    if (!suggestion) return;
    setSuggestionAccepted(true);
    if (suggestion.resolutionType === "no_stock_effect") {
      setMode("no_stock_effect");
      return;
    }
    setMode("existing_item");
    setStockItemId(suggestion.stockItemId ?? "");
    // Embalagem alterada: o fator antigo não serve — tem de ser conferido de novo.
    if (suggestion.conversionFactor != null && !suggestion.packagingChanged) setConversionFactor(String(suggestion.conversionFactor));
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
    const factor = parseQty(conversionFactor);
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

  const destinationFields = (
    <div className="col-span-2 space-y-2">
      {hasMultipleLocations && (
        <label className="flex items-center gap-2 text-xs text-stone-600">
          <input type="checkbox" checked={splitMode} onChange={(e) => setSplitMode(e.target.checked)} />
          Dividir por lojas (quantidades explícitas)
        </label>
      )}
      {splitMode && hasMultipleLocations ? (
        <div className="space-y-1.5 rounded-md border border-stone-200 bg-stone-50 p-2">
          {splits.map((sp, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <LocationSelect value={sp.locationId} onChange={(v) => setSplits(splits.map((x, j) => (j === i ? { ...x, locationId: v } : x)))} label={i === 0 ? "Loja" : undefined} />
              </div>
              <div className="w-28">
                {i === 0 && <label className={labelCls}>Qtd. ({line.purchaseUnit})</label>}
                <input type="text" inputMode="decimal" value={sp.quantity} onChange={(e) => setSplits(splits.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} className={inputCls} />
              </div>
              {splits.length > 2 && (
                <button type="button" onClick={() => setSplits(splits.filter((_, j) => j !== i))} className="pb-1.5 text-xs text-stone-400 hover:text-red-600" aria-label="Remover loja">
                  ✕
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={() => setSplits([...splits, { locationId: null, quantity: "" }])} className="font-medium text-stone-600 hover:text-stone-800">
              + Loja
            </button>
            <span className={Math.abs(splitSum - line.purchaseQuantity) > 0.000001 ? "font-medium text-amber-700" : "text-emerald-700"}>
              {qtyFmt(splitSum)} de {qtyFmt(line.purchaseQuantity)} {line.purchaseUnit}
            </span>
          </div>
        </div>
      ) : (
        <LocationSelect value={locationId} onChange={setLocationId} label="Destino (loja)" />
      )}
    </div>
  );

  const amounts = [
    `${qtyFmt(line.purchaseQuantity)} ${line.purchaseUnit} × ${fromCents(line.unitCostWithoutVat)}`,
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

      {line.flaggedSuspiciousConversion && (
        <p className="mt-1 text-xs text-amber-600">Aviso: conversão pouco habitual{line.flagReason ? ` — ${line.flagReason}` : ""}. Confirma antes de avançar.</p>
      )}

      {isResolved && !editing ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
          <p>
            {line.resolutionType === "existing_item" || line.resolutionType === "new_item"
              ? <>
                  {stockItems.find((i) => i.id === line.stockItemId)?.name ?? "Artigo"} · {qtyFmt(line.stockQuantity ?? 0)} un. base (fator {line.conversionFactor ?? "—"}) ·{" "}
                  {line.locationSplits?.length
                    ? line.locationSplits.map((sp) => `${locationName(sp.locationId)} ${qtyFmt(sp.purchaseQuantity)} ${line.purchaseUnit}`).join(" · ")
                    : `destino ${line.locationId ? locationName(line.locationId) : "loja da confirmação"}`}
                </>
              : "Fica no documento e na classificação financeira; não entra no inventário."}
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
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-stone-300 bg-stone-50 px-2.5 py-1.5 text-xs text-stone-600">
              <span>
                Sugestão (não confirmada): {suggestion.resolutionType === "no_stock_effect"
                  ? "não é item de stock"
                  : `artigo ${stockItems.find((i) => i.id === suggestion.stockItemId)?.name ?? suggestion.stockItemId}${suggestion.conversionFactor != null && !suggestion.packagingChanged ? ` (fator ${suggestion.conversionFactor})` : ""}`}
                {suggestion.isItemActive === false && " — artigo inativo"}
              </span>
              {suggestion.packagingChanged && (
                <span className="text-amber-700">
                  A embalagem mudou ({suggestion.purchaseUnit} → {line.purchaseUnit}): confere o fator.
                </span>
              )}
              <button type="button" onClick={applySuggestion} className="rounded border border-stone-300 px-2 py-0.5 font-medium text-stone-700 hover:bg-white">
                Aplicar
              </button>
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
              <div>
                <label className={labelCls}>Fator de conversão ({line.purchaseUnit} → un. base)</label>
                <input type="text" value={conversionFactor} onChange={(e) => setConversionFactor(e.target.value)} className={inputCls} />
              </div>
              {destinationFields}
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
              <div>
                <label className={labelCls}>Fator de conversão ({line.purchaseUnit} → {newItemBaseUnit})</label>
                <input type="text" value={conversionFactor} onChange={(e) => setConversionFactor(e.target.value)} className={inputCls} />
              </div>
              {destinationFields}
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

/** As três conferências da F3a: documento (bloqueia), Stock (informativo), categorias (pendência para o Financeiro). */
function ConferencePanel({ conference }: { conference: ReviewConferenceDTO }) {
  const { document: doc, stock, categories } = conference;
  const docTone = doc.status === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : doc.status === "mismatch" ? "border-red-200 bg-red-50 text-red-700" : "border-stone-200 bg-stone-50 text-stone-600";
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className={`rounded-xl border p-3 text-xs ${docTone}`}>
        <p className="font-semibold">1. Documento</p>
        {doc.status === "unavailable" ? (
          <p className="mt-1">Sem conferência (revisão anterior à atualização).</p>
        ) : (
          <>
            <p className="mt-1 tabular-nums">
              Linhas: base {fromCents(doc.linesNetCents ?? 0)} · IVA {fromCents(doc.linesVatCents ?? 0)}
            </p>
            <p className="tabular-nums">
              Fatura: base {fromCents(doc.invoiceNetCents ?? 0)} · IVA {fromCents(doc.invoiceVatCents ?? 0)}
            </p>
            <p className="mt-1 font-medium">
              {doc.status === "ok"
                ? "Todas as linhas batem com a fatura."
                : `Diferença: base ${fromCents(doc.netDifferenceCents ?? 0)} · IVA ${fromCents(doc.vatDifferenceCents ?? 0)} — corrigir no Financeiro antes de movimentar.`}
            </p>
          </>
        )}
      </div>
      <div className="rounded-xl border border-stone-200 bg-white p-3 text-xs text-stone-600">
        <p className="font-semibold text-stone-800">2. Stock</p>
        <p className="mt-1 tabular-nums">
          Inventariáveis: {stock.inventoriableLines}{stock.inventoriableNetCents != null ? ` · base ${fromCents(stock.inventoriableNetCents)}` : ""}
        </p>
        <p className="tabular-nums">
          Não são item de stock: {stock.nonStockLines}{stock.nonStockNetCents != null ? ` · ${fromCents(stock.nonStockNetCents)}` : ""}
        </p>
        {stock.unresolvedLines > 0 && <p className="font-medium text-amber-700">Por resolver: {stock.unresolvedLines}</p>}
        <p className="mt-1 text-stone-400">Só as linhas inventariáveis geram quantidade e custo.</p>
      </div>
      <div className={`rounded-xl border p-3 text-xs ${categories.divergences.length ? "border-amber-200 bg-amber-50 text-amber-800" : "border-stone-200 bg-white text-stone-600"}`}>
        <p className={`font-semibold ${categories.divergences.length ? "" : "text-stone-800"}`}>3. Categorias</p>
        {categories.divergences.length === 0 ? (
          <p className="mt-1">Sem divergências com a classificação financeira.</p>
        ) : (
          <>
            <DivergenceList divergences={categories.divergences} />
            <p className="mt-1">Não impede a entrada; fica como pendência para o Financeiro rever (nada é corrigido sozinho).</p>
          </>
        )}
      </div>
    </div>
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
  const isTerminal = TERMINAL_STATUSES.includes(review.status);
  const unresolvedLinesCount = review.lines.filter((l) => l.resolutionType === "unresolved").length;
  const documentMismatch = review.conference?.document.status === "mismatch";
  const allNonStock = review.lines.length > 0 && review.lines.every((l) => l.resolutionType === "no_stock_effect");

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

        {review.conference && !isTerminal && <ConferencePanel conference={review.conference} />}

        {isTerminal && review.categoryDivergences && review.categoryDivergences.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-semibold">Pendência para o Financeiro — categorias</p>
            <DivergenceList divergences={review.categoryDivergences} />
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
            ) : documentMismatch ? (
              <p className="text-xs font-medium text-red-700">Confirmação indisponível — as linhas não batem com a fatura (ver «Documento»).</p>
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
                    {confirmMutation.isPending ? "A confirmar…" : allNonStock ? "Confirmar — não afeta Stock" : "Confirmar e adicionar ao stock"}
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
