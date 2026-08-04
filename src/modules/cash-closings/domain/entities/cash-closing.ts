export type CashClosingStatus = "pending" | "approved" | "rejected";

export interface CashClosing {
  id: string;
  closingDate: string;
  employeeId: string;
  employeeName: string;
  tpa: number;
  uber: number;
  glovo: number;
  bolt: number;
  eatz: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  cashDrawerOpen: number;
  cashDrawerTotal: number;
  totalCalculated: number;
  vendusTotal: number | null;
  sangriaAmount: number;
  notes: string | null;
  status: CashClosingStatus;
  managerNotes: string | null;
  reviewedAt: string | null;
  submittedAt: string;
  /** Totais AirMenu por plataforma — null se AirMenu indisponível ou não configurado. */
  airMenuUber: number | null;
  airMenuGlovo: number | null;
  airMenuBolt: number | null;
  /** Sub-total dos canais Vendus declarados (TPA + Eatz + Dinheiro). */
  vendusCalculated: number;
  /** Sub-total dos canais AirMenu declarados (Uber + Glovo + Bolt). */
  airMenuCalculated: number;
  /** Soma dos totais AirMenu por plataforma (referência API). null se AirMenu indisponível. */
  airMenuTotal: number | null;
}
