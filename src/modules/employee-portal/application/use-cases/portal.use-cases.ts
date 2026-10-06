import { PortalOfflineError, type PortalHome, type PunchResult } from "../../domain/entities/portal.ts";
import type { GetPortalHomePort, RegisterPunchInput, RegisterPunchPort } from "../../domain/ports/in/portal.ports.ts";
import type { GeolocationPort } from "../../domain/ports/out/geolocation.port.ts";
import type { PortalApiPort } from "../../domain/ports/out/portal-api.port.ts";

export class GetPortalHomeUseCase implements GetPortalHomePort {
  private readonly api: PortalApiPort;

  constructor(api: PortalApiPort) {
    this.api = api;
  }

  execute(): Promise<PortalHome> {
    return this.api.getHome();
  }
}

/**
 * Entrada/Saída: lê a localização **só se a política do local a pedir**,
 * uma vez, e envia-a crua ao servidor (que decide dentro/fora). Se a rede
 * falhar, tenta mais uma vez com a MESMA chave — se o primeiro pedido até
 * tinha sido gravado, o servidor devolve-o em vez de criar outro. A hora
 * oficial é sempre a do servidor.
 */
export class RegisterPunchUseCase implements RegisterPunchPort {
  private readonly api: PortalApiPort;
  private readonly geolocation: GeolocationPort;

  constructor(api: PortalApiPort, geolocation: GeolocationPort) {
    this.api = api;
    this.geolocation = geolocation;
  }

  async execute(input: RegisterPunchInput): Promise<PunchResult> {
    const location = input.geofencePolicy === "off" ? null : await this.geolocation.readOnce();
    try {
      return await this.api.registerPunch(input.kind, input.idempotencyKey, location);
    } catch (e) {
      if (!(e instanceof PortalOfflineError)) throw e;
      return this.api.registerPunch(input.kind, input.idempotencyKey, location);
    }
  }
}
