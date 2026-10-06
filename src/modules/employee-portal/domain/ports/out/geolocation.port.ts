import type { ClientLocation } from "../../entities/portal.ts";

/**
 * Localização do telemóvel **só no momento da picagem** (uma leitura, sem
 * rastreamento). Nunca lança: falhas (negada, indisponível, timeout)
 * voltam como `{ error }` para o servidor decidir conforme a política.
 */
export interface GeolocationPort {
  readOnce(): Promise<ClientLocation>;
}
