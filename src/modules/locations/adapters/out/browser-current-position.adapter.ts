import type { ReadCurrentPositionPort } from "../../domain/ports/in/manage-locations.port.ts";

/** "Usar a minha localização atual" — uma leitura de alta precisão do dispositivo do gestor (exige HTTPS). */
export class BrowserCurrentPositionAdapter implements ReadCurrentPositionPort {
  execute(): Promise<{ latitude: number; longitude: number; accuracyM: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation || !window.isSecureContext) {
        reject(new Error("Este dispositivo/browser não permite obter a localização (é preciso HTTPS)."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: Number(pos.coords.latitude.toFixed(6)), longitude: Number(pos.coords.longitude.toFixed(6)), accuracyM: Math.round(pos.coords.accuracy) }),
        (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? "Permissão de localização negada." : "Não foi possível obter a localização.")),
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
      );
    });
  }
}
