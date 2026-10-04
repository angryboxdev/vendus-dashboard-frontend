import type { LocationDTO } from "../entities/location.ts";

/**
 * Resolves the location a write should carry, the same way `LocationSelect`
 * decides whether to show a picker at all (D4): an explicitly chosen id wins;
 * otherwise, with exactly one **active** location, that location is implicit.
 * Inactive locations (Base Organizacional, ticket 02) never count — an
 * organization with one active store and one closed one still gets the
 * implicit value. With zero or several active locations and nothing chosen,
 * there is no location to imply — the caller must ask the user to pick one
 * before submitting a write that requires it.
 */
export function resolveLocationId(
  chosen: string | null,
  locations: LocationDTO[],
): string | null {
  if (chosen) return chosen;
  const active = locations.filter((l) => l.isActive);
  if (active.length === 1) return active[0]!.id;
  return null;
}
