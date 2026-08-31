import { useLocationsState } from "../../locations.module.tsx";

/**
 * Reads the organization's locations, loaded once per session by
 * `LocationsProvider`. Write screens use `hasMultipleLocations` to decide
 * whether a picker is needed at all (D4): with one location, `locations[0].id`
 * is the implicit value and no picker renders.
 */
export function useLocations() {
  const state = useLocationsState();
  return { ...state, hasMultipleLocations: state.locations.length > 1 };
}
