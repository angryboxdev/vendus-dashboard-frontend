/**
 * Calendário de entrega por fornecedor×loja (módulo Stock — Planeamento,
 * D10) — informativo, nunca um compromisso contratual. Usado pela tab
 * "Planeamento de stock" do detalhe de fornecedor para computar as
 * próximas oportunidades de fornecimento e alimentar a data de próxima
 * entrega nas recomendações de compra.
 */
export interface SupplierDeliveryScheduleDTO {
  id: string;
  supplierId: string;
  locationId: string;
  /** ISO weekday: 1 = segunda … 7 = domingo; `null`/`[]` = sem calendário configurado (nunca um compromisso, só informativo). */
  weekdays: number[] | null;
  cutoffTime: string | null;
  active: boolean;
}

export interface UpsertSupplierDeliverySchedulePayload {
  locationId: string;
  weekdays: number[] | null;
  cutoffTime?: string | null;
  active?: boolean;
}
