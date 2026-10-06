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
import {
  CreateLocationUseCase,
  ListLocationHistoryUseCase,
  SetLocationActiveUseCase,
  SetLocationGeofenceUseCase,
  UpdateLocationUseCase,
} from "./application/use-cases/manage-locations.use-cases.ts";
import { BrowserCurrentPositionAdapter } from "./adapters/out/browser-current-position.adapter.ts";
import type { LocationDTO } from "./domain/entities/location.ts";
import type { ListLocationsPort } from "./domain/ports/in/list-locations.port.ts";
import type {
  CreateLocationPort,
  ListLocationHistoryPort,
  ReadCurrentPositionPort,
  SetLocationActivePort,
  SetLocationGeofencePort,
  UpdateLocationPort,
} from "./domain/ports/in/manage-locations.port.ts";

export interface LocationsModule {
  listLocations: ListLocationsPort;
  /** Gestão (Empresa & Estrutura → Locais, só admin) — Base Organizacional, ticket 02. */
  createLocation: CreateLocationPort;
  updateLocation: UpdateLocationPort;
  setLocationActive: SetLocationActivePort;
  listLocationHistory: ListLocationHistoryPort;
  /** Portal do Colaborador — zona de picagem do Local. */
  setLocationGeofence: SetLocationGeofencePort;
  readCurrentPosition: ReadCurrentPositionPort;
}

/**
 * Composition root: wires the concrete adapter into the use cases.
 * To swap providers (e.g. a fake for tests), replace HttpLocationsApiAdapter —
 * that is the ONLY change needed.
 */
function buildModule(): LocationsModule {
  const api = new HttpLocationsApiAdapter();
  return {
    listLocations: new ListLocationsUseCase(api),
    createLocation: new CreateLocationUseCase(api),
    updateLocation: new UpdateLocationUseCase(api),
    setLocationActive: new SetLocationActiveUseCase(api),
    listLocationHistory: new ListLocationHistoryUseCase(api),
    setLocationGeofence: new SetLocationGeofenceUseCase(api),
    readCurrentPosition: new BrowserCurrentPositionAdapter(),
  };
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
    // O papel `employee` (Portal do Colaborador) não tem acesso a /api/locations.
    if (authLoading || !user || user.role === "employee") return;
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
