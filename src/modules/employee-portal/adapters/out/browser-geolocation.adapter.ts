import type { ClientLocation } from "../../domain/entities/portal.ts";
import type { GeolocationPort } from "../../domain/ports/out/geolocation.port.ts";

const TIMEOUT_MS = 12_000;

/**
 * `navigator.geolocation` — uma única leitura de alta precisão, sem cache
 * antiga (`maximumAge: 0`) e sem `watchPosition` (nunca há rastreamento).
 * Exige contexto seguro (HTTPS).
 */
export class BrowserGeolocationAdapter implements GeolocationPort {
  readOnce(): Promise<ClientLocation> {
    return new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation || !window.isSecureContext) {
        resolve({ error: "unavailable" });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyM: Math.round(pos.coords.accuracy * 10) / 10,
          }),
        (err) =>
          resolve({
            error: err.code === err.PERMISSION_DENIED ? "permission_denied" : err.code === err.TIMEOUT ? "timeout" : "unavailable",
          }),
        { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: 0 },
      );
    });
  }
}
