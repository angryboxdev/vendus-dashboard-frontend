import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../../contexts/AuthContext.tsx";
import { HttpLocationsApiAdapter } from "./adapters/out/http-locations-api.adapter.ts";
import { ListLocationsUseCase } from "./application/use-cases/list-locations.use-case.ts";
import type { LocationDTO } from "./domain/entities/location.ts";
import type { ListLocationsPort } from "./domain/ports/in/list-locations.port.ts";

export interface LocationsModule {
  listLocations: ListLocationsPort;
}

/**
 * Composition root: wires the concrete adapter into the use case.
 * To swap providers (e.g. a fake for tests), replace HttpLocationsApiAdapter —
 * that is the ONLY change needed.
 */
function buildModule(): LocationsModule {
  const api = new HttpLocationsApiAdapter();
  return { listLocations: new ListLocationsUseCase(api) };
}

const LocationsContext = createContext<LocationsModule | null>(null);

interface LocationsState {
  locations: LocationDTO[];
  loading: boolean;
  error: string | null;
}

interface LocationsStateValue extends LocationsState {
  reload: () => Promise<void>;
}

const LocationsStateContext = createContext<LocationsStateValue | null>(null);

/**
 * Fetches the organization's locations once per session — alongside the
 * organization AuthContext already carries (D15) — and holds them in context
 * so every consumer (`useLocations`) reads the same array instead of firing
 * its own request.
 */
export function LocationsProvider({
  children,
  module: mod,
}: {
  children: ReactNode;
  module?: LocationsModule;
}) {
  // Memoized: buildModule() creates new adapter/use-case instances, so
  // recomputing on every render would give `load` a new identity each time
  // and re-trigger the effect below in an infinite loop.
  const value = useMemo(() => mod ?? buildModule(), [mod]);
  const { user, loading: authLoading } = useAuth();

  const [state, setState] = useState<LocationsState>({
    locations: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const locations = await value.listLocations.execute();
      setState({ locations, loading: false, error: null });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  }, [value.listLocations]);

  useEffect(() => {
    // Nothing to fetch yet: GET /api/locations requires an authenticated caller.
    if (authLoading || !user) return;
    void load();
  }, [authLoading, user, load]);

  return (
    <LocationsContext.Provider value={value}>
      <LocationsStateContext.Provider value={{ ...state, reload: load }}>
        {children}
      </LocationsStateContext.Provider>
    </LocationsContext.Provider>
  );
}

export function useLocationsModule(): LocationsModule {
  const ctx = useContext(LocationsContext);
  if (!ctx) throw new Error("useLocationsModule must be used inside LocationsProvider");
  return ctx;
}

export function useLocationsState(): LocationsStateValue {
  const ctx = useContext(LocationsStateContext);
  if (!ctx) throw new Error("useLocationsState must be used inside LocationsProvider");
  return ctx;
}
