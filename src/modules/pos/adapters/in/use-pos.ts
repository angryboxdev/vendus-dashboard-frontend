import { useCallback, useEffect, useState } from "react";
import type { DaySummary, PosEmployee, PosProduct, PosSale, PosSettings } from "../../domain/entities/pos.ts";
import type { SeriesOption } from "../../domain/ports/out/pos-api.port.ts";
import { usePosModule } from "../../pos.module.tsx";

export const errorText = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado");

/** Carrega um recurso com estado de carregamento/erro e permite recarregar. */
function useResource<T>(load: () => Promise<T>, initial: T) {
  const [state, setState] = useState<{ data: T; loading: boolean; error: string | null }>({ data: initial, loading: true, error: null });
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      setState({ data: await load(), loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: errorText(e) }));
    }
  }, [load]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { ...state, reload };
}

export function usePosProducts(activeOnly: boolean) {
  const { pos } = usePosModule();
  const load = useCallback(() => pos.products(activeOnly), [pos, activeOnly]);
  return useResource<PosProduct[]>(load, []);
}

export function usePosDocuments() {
  const { pos } = usePosModule();
  const load = useCallback(() => pos.documents(), [pos]);
  return useResource<PosSale[]>(load, []);
}

export function usePosSummary() {
  const { pos } = usePosModule();
  const load = useCallback(() => pos.summary(), [pos]);
  return useResource<DaySummary | null>(load, null);
}

export function usePosSettings() {
  const { pos } = usePosModule();
  const load = useCallback(async () => {
    const [settings, employees, series] = await Promise.all([pos.settings(), pos.employees(), pos.series()]);
    return { settings, employees, series };
  }, [pos]);
  return useResource<{ settings: PosSettings; employees: PosEmployee[]; series: SeriesOption[] } | null>(load, null);
}
