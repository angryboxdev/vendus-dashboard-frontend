import { useLocationsState } from "../../locations.module.tsx";

/**
 * Reads the organization's locations, loaded once per session by
 * `LocationsProvider`. `locations` includes inactive ones (needed to show the
 * name on historical records); write screens use `activeLocations` and
 * `hasMultipleLocations` (active only) to decide whether a picker is needed
 * at all (D4): with one active location, it is the implicit value and no
 * picker renders.
 */
export function useLocations() {
  const state = useLocationsState();
  const activeLocations = state.locations.filter((l) => l.isActive);
  return { ...state, activeLocations, hasMultipleLocations: activeLocations.length > 1 };
}
