import { useEffect } from "react";
import { useLocations } from "../modules/locations/adapters/in/use-locations.ts";

export interface LocationSelectProps {
  value: string | null;
  onChange: (locationId: string | null) => void;
  /**
   * Offer an explicit "no location" option. Used by invoice lines, where a
   * cost belonging to the whole organization and to no store is a real
   * state (D4) — never default it to the first store instead. Every other
   * write path leaves this false: a value is required.
   */
  allowUnset?: boolean;
  label?: string;
  className?: string;
  disabled?: boolean;
}

const DEFAULT_SELECT_CLASSES =
  "w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs focus:outline-none focus:border-[#ED5C32]";

/**
 * Picker for the caller's organization's location (D4/D15). Renders nothing
 * — and self-fills `value` with the sole location — when the organization
 * has one location or none yet loaded, so a single-location org (Angrybox's
 * case today) sees no picker and pays zero extra clicks. Renders a `<select>`
 * only once a second location exists.
 */
export function LocationSelect({
  value,
  onChange,
  allowUnset = false,
  label,
  className,
  disabled,
}: LocationSelectProps) {
  const { locations, hasMultipleLocations } = useLocations();

  useEffect(() => {
    if (!hasMultipleLocations && locations.length === 1 && value !== locations[0]!.id) {
      onChange(locations[0]!.id);
    }
  }, [hasMultipleLocations, locations, value, onChange]);

  if (!hasMultipleLocations) return null;

  return (
    <div>
      {label && (
        <label className="mb-1 block text-xs font-medium text-stone-500">
          {label}
        </label>
      )}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={disabled}
        className={className ?? DEFAULT_SELECT_CLASSES}
      >
        {allowUnset ? (
          <option value="">— (organização, sem loja)</option>
        ) : (
          <option value="" disabled>
            Selecione uma loja
          </option>
        )}
        {locations
          .filter((l) => l.isActive)
          .map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
      </select>
    </div>
  );
}
