/**
 * Análise de Vendas — contrato com o backend (GET /api/sales-analysis, /forecast,
 * POST /air-menu/fetch). Manter em sincronia com
 * vendus-dashboard-backend/src/modules/sales-analysis/domain/entities/sales-analysis.ts.
 */

export type SourceSelection = "vendus" | "airmenu" | "both";
export type SalesChannel = "salao" | "take_away" | "eatz" | "apps" | "uber_eats" | "glovo" | "bolt_food";
export type IsoDate = string;

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

/** [data, hora (−1 = total do dia), índice do canal em `channels`, bruto, líquido, n.º de vendas] — cêntimos. */
export type CompactBucket = [IsoDate, number, number, number, number, number];

export type AirMenuMonthState = "stored" | "partial" | "missing" | "fetching" | "error";

export interface AirMenuMonthStatus {
  month: string;
  state: AirMenuMonthState;
  error?: string;
}

export interface FillProgress {
  running: boolean;
  doneDays: number;
  totalDays: number;
  lastError?: string;
}

export interface SalesAnalysisData {
  today: IsoDate;
  source: SourceSelection;
  range: DateRange;
  prevYearRange: DateRange;
  prevMonthRange: DateRange;
  channels: SalesChannel[];
  current: CompactBucket[];
  prevYear: CompactBucket[];
  prevMonth: CompactBucket[];
  vendus: { missingDays: number; fill: FillProgress | null; todayLive: boolean | null } | null;
  airMenu: { months: AirMenuMonthStatus[]; comparisonMissingMonths: string[] } | null;
}

export interface ForecastDay {
  date: IsoDate;
  expectedCents: number;
  lowCents: number;
  highCents: number;
  expectedCount: number;
}

export interface SalesForecast {
  month: string;
  generatedAt: string;
  method: "ai" | "baseline";
  actualCents: number;
  days: ForecastDay[];
  expectedTotalCents: number;
  lowTotalCents: number;
  highTotalCents: number;
  note?: string;
}

export type ForecastResult = { status: "ready"; forecast: SalesForecast } | { status: "pending"; missingDays: number };

export const CHANNEL_LABEL: Record<SalesChannel, string> = {
  salao: "Salão",
  take_away: "Take Away",
  eatz: "Eatz",
  apps: "Apps (delivery próprio)",
  uber_eats: "Uber Eats",
  glovo: "Glovo",
  bolt_food: "Bolt Food",
};

export const CHANNEL_SHORT: Record<SalesChannel, string> = {
  salao: "Salão",
  take_away: "TA",
  eatz: "Eatz",
  apps: "Apps",
  uber_eats: "Uber",
  glovo: "Glovo",
  bolt_food: "Bolt",
};

/** Horário de funcionamento (fixo nesta versão): abre às 12h; fecha 22h30 (seg–qui, dom) ou 23h30 (sex, sáb). */
export const OPENING_HOUR = 12;
export function closingHour(weekday: number): number {
  return weekday === 5 || weekday === 6 ? 23.5 : 22.5;
}
