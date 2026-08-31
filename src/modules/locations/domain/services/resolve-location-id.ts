import type { LocationDTO } from "../entities/location.ts";

/**
 * Resolves the location a write should carry, the same way `LocationSelect`
 * decides whether to show a picker at all (D4): an explicitly chosen id wins;
 * otherwise, with exactly one location, that location is implicit. With zero
 * or several locations and nothing chosen, there is no location to imply —
 * the caller must ask the user to pick one before submitting a write that
 * requires it.
 */
export function resolveLocationId(
  chosen: string | null,
  locations: LocationDTO[],
): string | null {
  if (chosen) return chosen;
  if (locations.length === 1) return locations[0]!.id;
  return null;
}
