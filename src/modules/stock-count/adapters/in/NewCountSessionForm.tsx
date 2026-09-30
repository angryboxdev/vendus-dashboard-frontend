import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useStockCountModule } from "../../stock-count.module.tsx";
import { useAuth } from "../../../../contexts/AuthContext.tsx";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import { resolveLocationId } from "../../../locations/domain/services/resolve-location-id.ts";
import { LocationSelect } from "../../../../components/LocationSelect.tsx";
import { ApiError } from "../../../../lib/api.ts";
import type {
  StockCountSessionType,
  StockItemOptionDTO,
  StockCategoryOptionDTO,
} from "../../domain/entities/stock-count.ts";
import { STOCK_COUNT_SESSION_TYPE_LABELS } from "../../domain/entities/stock-count.ts";

const inputCls =
  "w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-[#ED5C32]";
const labelCls = "mb-1 block text-xs font-medium text-stone-500";

function isOverlapError(e: unknown): e is ApiError {
  return e instanceof ApiError && e.status === 400 && /overlap/i.test(e.message);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function NewCountSessionForm({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { api } = useStockCountModule();
  const { user } = useAuth();
  const { locations } = useLocations();
  const isAdmin = user?.role === "admin";

  const [type, setType] = useState<StockCountSessionType>("general");
  const [locationId, setLocationId] = useState<string | null>(null);
  const [businessDate, setBusinessDate] = useState(today());
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [overlapMessage, setOverlapMessage] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [createdVersion, setCreatedVersion] = useState<number | null>(null);

  const { data: stockItems = [] } = useQuery({
    queryKey: ["stock-count-item-options"],
    queryFn: () => api.listStockItemOptions(),
    enabled: type !== "general",
  });
  const { data: stockCategories = [] } = useQuery({
    queryKey: ["stock-count-category-options"],
    queryFn: () => api.listStockCategoryOptions(),
    enabled: type !== "general",
  });

  const activeItems = (stockItems as StockItemOptionDTO[]).filter((i) => i.isActive);
  const activeCategories = stockCategories as StockCategoryOptionDTO[];

  const [isSubmitting, setIsSubmitting] = useState(false);

  const forceStart = useMutation({
    mutationFn: async () => {
      if (!createdSessionId || createdVersion == null) throw new Error("Sessão não encontrada.");
      await api.startSession(createdSessionId, {
        expectedVersion: createdVersion,
        overrideOverlap: true,
        overrideReason: overrideReason.trim() || undefined,
      });
      return createdSessionId;
    },
    onSuccess: (sessionId) => {
      onClose();
      navigate(`/stock/contagens/${sessionId}`);
    },
  });

  // Guarda o id/version da sessão criada assim que soubermos deles, para o
  // "forçar início" não ter de recriar a sessão.
  async function handleSubmit() {
    setValidationError(null);
    setOverlapMessage(null);
    const resolvedLocationId = resolveLocationId(locationId, locations);
    if (!resolvedLocationId) {
      setValidationError("Selecione uma loja.");
      return;
    }
    const scopeDefinition =
      type === "general"
        ? {}
        : {
            ...(categoryIds.length > 0 && { categoryIds }),
            ...(itemIds.length > 0 && { itemIds }),
          };
    setIsSubmitting(true);
    try {
      const session = await api.createSession({
        locationId: resolvedLocationId,
        type,
        scopeDefinition,
        businessDate,
      });
      setCreatedSessionId(session.id);
      setCreatedVersion(session.version);
      try {
        await api.startSession(session.id, { expectedVersion: session.version });
        onClose();
        navigate(`/stock/contagens/${session.id}`);
      } catch (startError) {
        if (isOverlapError(startError)) {
          setOverlapMessage(startError.message);
        } else {
          setValidationError(startError instanceof Error ? startError.message : "Erro ao iniciar a sessão.");
        }
      }
    } catch (createError) {
      setValidationError(createError instanceof Error ? createError.message : "Erro ao criar a sessão.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleCategory(id: string) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function toggleItem(id: string) {
    setItemIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-stone-900">Nova contagem de stock</h3>

        <div className="mt-3 space-y-3">
          <div>
            <label className={labelCls}>Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value as StockCountSessionType)} className={inputCls}>
              {(Object.entries(STOCK_COUNT_SESSION_TYPE_LABELS) as [StockCountSessionType, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <LocationSelect value={locationId} onChange={setLocationId} label="Loja" className={inputCls} />

          <div>
            <label className={labelCls}>Data operacional</label>
            <input type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} className={inputCls} />
          </div>

          {type !== "general" && (
            <>
              <div>
                <label className={labelCls}>Categorias (opcional — deixa vazio para não filtrar por categoria)</label>
                <div className="max-h-32 overflow-y-auto rounded-md border border-stone-200 p-2">
                  {activeCategories.length === 0 ? (
                    <p className="text-xs text-stone-400">Sem categorias.</p>
                  ) : (
                    activeCategories.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 py-0.5 text-sm text-stone-700">
                        <input type="checkbox" checked={categoryIds.includes(c.id)} onChange={() => toggleCategory(c.id)} />
                        {c.name}
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div>
                <label className={labelCls}>Itens específicos (opcional)</label>
                <div className="max-h-40 overflow-y-auto rounded-md border border-stone-200 p-2">
                  {activeItems.length === 0 ? (
                    <p className="text-xs text-stone-400">Sem itens ativos.</p>
                  ) : (
                    activeItems.map((i) => (
                      <label key={i.id} className="flex items-center gap-2 py-0.5 text-sm text-stone-700">
                        <input type="checkbox" checked={itemIds.includes(i.id)} onChange={() => toggleItem(i.id)} />
                        {i.name} <span className="text-xs text-stone-400">({i.baseUnit})</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              {categoryIds.length === 0 && itemIds.length === 0 && (
                <p className="text-xs text-amber-600">
                  Sem categorias/itens escolhidos, esta contagem {type === "cyclical" ? "cíclica" : "pontual"} vai abranger todos os itens elegíveis (igual a uma geral).
                </p>
              )}
            </>
          )}

          {validationError && <p className="text-xs text-red-600">{validationError}</p>}

          {overlapMessage && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-stone-800">Não foi possível iniciar: {overlapMessage}</p>
              {isAdmin ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    rows={2}
                    className={inputCls}
                    placeholder="Motivo para forçar o início mesmo assim (opcional)"
                  />
                  <button
                    type="button"
                    onClick={() => forceStart.mutate()}
                    disabled={forceStart.isPending}
                    className="rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {forceStart.isPending ? "A forçar…" : "Forçar início mesmo assim"}
                  </button>
                  {forceStart.isError && (
                    <p className="text-xs text-red-600">
                      {forceStart.error instanceof Error ? forceStart.error.message : "Erro ao forçar início."}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-xs text-stone-500">
                  A sessão foi criada como rascunho — pede a um admin para forçar o início, ou tenta mais tarde a partir da lista.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
            Fechar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? "A criar…" : "Criar e iniciar contagem"}
          </button>
        </div>
      </div>
    </div>
  );
}
