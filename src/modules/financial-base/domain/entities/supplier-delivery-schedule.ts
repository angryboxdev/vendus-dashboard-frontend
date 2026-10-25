/**
 * Calendário de entrega por fornecedor×loja (módulo Stock — Planeamento,
 * D10) — informativo, nunca um compromisso contratual. Usado pelo separador
 * «Abastecimento» do detalhe de fornecedor para computar as
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
  /** Por dia de entrega: até quando se encomenda e observação (opcional: backend anterior não envia). */
  dayRules?: DeliveryDayRule[];
}

/** Regra de um dia de entrega. */
export interface DeliveryDayRule {
  /** Dia de entrega (1 = segunda … 7 = domingo). */
  weekday: number;
  /** Dia em que se encomenda; `null` = dia anterior à entrega. */
  orderWeekday: number | null;
  /** HH:mm; `null` = hora limite geral do calendário. */
  orderTime: string | null;
  notes: string | null;
}

export interface UpsertSupplierDeliverySchedulePayload {
  locationId: string;
  weekdays: number[] | null;
  cutoffTime?: string | null;
  active?: boolean;
  dayRules?: DeliveryDayRule[];
}
