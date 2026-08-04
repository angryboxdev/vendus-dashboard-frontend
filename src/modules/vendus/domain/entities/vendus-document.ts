// ─── Channel ─────────────────────────────────────────────────────────────────

/**
 * Canal de venda de um documento Vendus.
 * - 'salao'     — consumo no restaurante
 * - 'eatz'      — delivery próprio (pagamento via método Eatz)
 * - 'take_away' — take-away (salão + item "embalagem")
 *
 * Na UI, 'take_away' é agrupado com 'salao'.
 */
export type VendusChannel = "salao" | "eatz" | "take_away";

// ─── Sub-types ────────────────────────────────────────────────────────────────

export interface VendusDocumentItem {
  id: number;
  qty: number;
  title: string;
  reference: string;
  amounts: {
    gross_unit?: string;
    gross_total?: string;
    net_unit?: string;
    net_total?: string;
  };
  tax: { rate?: number };
}

export interface VendusDocumentPayment {
  id: number;
  title: string;
  amount: string;
}

export interface VendusDocumentTax {
  total: string;
  base: string;
  amount: string;
  rate: number;
}

// ─── Detailed document (as returned by /vendus/summary) ──────────────────────

/**
 * Documento Vendus enriquecido com `channel`.
 * É o que o endpoint /vendus/summary devolve — todos os campos de detalhe
 * (items, payments, taxes) já incluídos.
 */
export interface VendusDetailedDocument {
  id: number;
  type: string; // 'FS' | 'FT' | 'NC'
  number: string;
  date: string;
  system_time: string;
  amount_gross: string;
  amount_net: string;
  taxes: VendusDocumentTax[];
  discounts: { total: string };
  payments: VendusDocumentPayment[];
  client: { name: string; fiscal_id: string };
  items: VendusDocumentItem[];
  related_docs: Array<{
    id: number;
    type: string;
    number: string;
    amount?: string;
    status?: string;
  }> | null;
  store_id: number;
  register_id: number;
  channel: VendusChannel;
}
