export type VendusOrderItem = {
  id: string | number;
  qty: string | number;
  title: string;
  /** Comentário/observação por linha */
  text?: string;
  type_id?: string;
  reference?: string;
  amounts:
    | { gross_unit?: string; gross_total?: string; net_unit?: string; net_total?: string }
    | Array<{ gross_unit?: string; gross_total?: string; net_unit?: string; net_total?: string }>;
};

export type OrderChannel = "restaurant" | "delivery" | "take_away" | "unknown";

export type VendusOrderDetail = {
  id: string | number;
  type: string;
  number: string;
  date: string;
  system_time: string;
  local_time?: string;
  /** Observações gerais do documento */
  observations?: string;
  items: VendusOrderItem[];
  client?: { id?: string; name?: string; fiscal_id?: string };
  /** Canal detetado pelo backend: "restaurant" | "delivery" | "unknown" */
  channel?: OrderChannel;
  /** True se o pedido contém pelo menos uma bebida */
  has_drinks?: boolean;
};

export type VendusOrderSummary = {
  id: string | number;
  number: string;
  date: string;
  system_time: string;
  local_time?: string;
  type: string;
  amount_gross: string;
  status?: { id?: string; date?: string };
  /** Presente apenas se o backend o incluir na listagem */
  channel?: OrderChannel;
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  FT: "Fatura",
  FS: "Fatura Simplificada",
  FR: "Fatura Recibo",
  NC: "Nota de Crédito",
  DC: "Consulta de Mesa",
  PF: "Fatura Pró-Forma",
  OT: "Orçamento",
  EC: "Encomenda",
  GA: "Guia de Ativos Próprios",
  GT: "Guia de Transporte",
  GR: "Guia de Remessa",
  GD: "Guia de Devolução",
  RG: "Recibo",
};
