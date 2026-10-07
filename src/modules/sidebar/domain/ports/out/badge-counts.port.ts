/** Contadores mostrados na barra lateral (ex.: pedidos do Portal por decidir). */
export interface BadgeCountsPort {
  pendingHrRequests(): Promise<number>;
}
