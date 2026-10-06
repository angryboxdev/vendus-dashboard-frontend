import { useState } from "react";
import { DEFAULT_GEOFENCE, GEOFENCE_POLICY_LABELS, LocationValidationError, type GeofencePolicy, type LocationDTO } from "../../domain/entities/location.ts";
import { useLocationsModule } from "../../locations.module.tsx";
import { useManageLocations } from "./use-manage-locations.ts";

const POLICIES: GeofencePolicy[] = ["off", "warn", "block"];

/**
 * Zona de picagem do Local (Portal do Colaborador): coordenadas, raio e
 * política. A geofence pertence ao Local — nunca ao colaborador. Para as
 * coordenadas, o mais simples é estar na loja e tocar em "Usar a minha
 * localização atual".
 */
export function GeofenceSection({ location }: { location: LocationDTO }) {
  const { readCurrentPosition } = useLocationsModule();
  const { geofenceMutation } = useManageLocations();
  const initial = location.geofence ?? DEFAULT_GEOFENCE;
  const [latitude, setLatitude] = useState(initial.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(initial.longitude?.toString() ?? "");
  const [radius, setRadius] = useState(String(initial.radiusM));
  const [policy, setPolicy] = useState<GeofencePolicy>(initial.policy);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function fillFromCurrentPosition() {
    setLocating(true);
    setNotice(null);
    try {
      const pos = await readCurrentPosition.execute();
      setLatitude(String(pos.latitude));
      setLongitude(String(pos.longitude));
      setNotice(`Localização obtida (precisão ±${pos.accuracyM} m).${pos.accuracyM > 50 ? " Precisão fraca — tente de novo no exterior da loja." : ""}`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível obter a localização.");
    } finally {
      setLocating(false);
    }
  }

  function save() {
    setNotice(null);
    const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
    geofenceMutation.mutate(
      { id: location.id, geofence: { latitude: num(latitude), longitude: num(longitude), radiusM: Number(radius), policy } },
      { onSuccess: () => setNotice("Zona de picagem guardada.") },
    );
  }

  const fieldErrors = geofenceMutation.error instanceof LocationValidationError ? geofenceMutation.error.fieldErrors : [];
  const noEnter = (e: React.KeyboardEvent) => e.key === "Enter" && e.preventDefault();
  const hasCoords = latitude.trim() !== "" && longitude.trim() !== "";

  return (
    <section className="space-y-3 rounded-xl border border-[#F5C992]/50 p-4" aria-label="Zona de picagem">
      <div>
        <h3 className="text-sm font-semibold text-stone-800">Zona de picagem (Portal do Colaborador)</h3>
        <p className="text-xs text-stone-500">Usada só no momento em que o colaborador regista entrada/saída pelo telemóvel.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="geo-lat" className="mb-1 block text-xs font-medium text-stone-600">Latitude</label>
          <input id="geo-lat" inputMode="decimal" value={latitude} onKeyDown={noEnter} onChange={(e) => setLatitude(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="geo-lng" className="mb-1 block text-xs font-medium text-stone-600">Longitude</label>
          <input id="geo-lng" inputMode="decimal" value={longitude} onKeyDown={noEnter} onChange={(e) => setLongitude(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="geo-radius" className="mb-1 block text-xs font-medium text-stone-600">Raio (metros)</label>
          <input id="geo-radius" type="number" min={10} max={5000} value={radius} onKeyDown={noEnter} onChange={(e) => setRadius(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
        </div>
        <div className="flex items-end">
          <button type="button" onClick={() => void fillFromCurrentPosition()} disabled={locating} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50">
            {locating ? "A obter…" : "Usar a minha localização atual"}
          </button>
        </div>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-xs font-medium text-stone-600">Política</legend>
        {POLICIES.map((p) => (
          <label key={p} className={`flex items-start gap-2 text-sm ${p !== "off" && !hasCoords ? "opacity-50" : ""}`}>
            <input type="radio" name="geofence-policy" checked={policy === p} disabled={p !== "off" && !hasCoords} onChange={() => setPolicy(p)} className="mt-1" />
            <span>
              <span className="font-medium text-stone-800">{GEOFENCE_POLICY_LABELS[p].label}</span>
              <span className="block text-xs text-stone-500">{GEOFENCE_POLICY_LABELS[p].hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {fieldErrors.length > 0 && <p className="text-xs text-[#A3211A]">{fieldErrors.map((f) => `${f.field}: ${f.message}`).join(" · ")}</p>}
      {geofenceMutation.error && fieldErrors.length === 0 && <p className="text-xs text-[#A3211A]">Não foi possível guardar.</p>}
      {notice && <p className="text-xs text-stone-600">{notice}</p>}

      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={geofenceMutation.isPending} className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {geofenceMutation.isPending ? "A guardar…" : "Guardar zona"}
        </button>
      </div>
    </section>
  );
}
