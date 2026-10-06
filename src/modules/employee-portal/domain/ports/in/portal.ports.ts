import type { GeofencePolicy, PortalHome, PunchKind, PunchResult } from "../../entities/portal.ts";

export interface GetPortalHomePort {
  execute(): Promise<PortalHome>;
}

export interface RegisterPunchInput {
  kind: PunchKind;
  /** Política do local — com `off` a localização nem é pedida. */
  geofencePolicy: GeofencePolicy;
  /** Uma chave por intenção (toque): repetir o pedido com a mesma chave nunca cria uma segunda picagem. */
  idempotencyKey: string;
}

export interface RegisterPunchPort {
  execute(input: RegisterPunchInput): Promise<PunchResult>;
}
