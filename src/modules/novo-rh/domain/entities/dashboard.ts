/** Contrato com `/api/novo-rh/dashboard` (backend, módulo dashboard). Só leitura + layout pessoal. */

export type TeamCategory = "working" | "remote" | "break" | "finished" | "not_started" | "vacation" | "absent";
export const TEAM_CATEGORIES: TeamCategory[] = ["working", "remote", "break", "finished", "not_started", "vacation", "absent"];

export interface TeamCounts {
  total: number;
  working: number;
  remote: number;
  break: number;
  finished: number;
  not_started: number;
  vacation: number;
  absent: number;
  late: number;
  missing: number;
}

export type Severity = "critical" | "urgent" | "attention";

export interface AttentionItem {
  key: "missing" | "late" | "uncovered" | "requests" | "absences_review";
  severity: Severity;
  count: number;
  label: string;
}

export interface UnitRow {
  locationId: string;
  name: string;
  people: number;
  present: number;
  late: number;
  absent: number;
  missing: number;
  uncovered: number;
  pending: number;
  state: "critical" | "attention" | "normal";
}

export interface OperationalSnapshot {
  generatedAt: string;
  context: { type: "organization" | "location"; locationId: string | null; name: string | null };
  localDate: string;
  tomorrow: string;
  units: { operational: number; requiringAttention: number };
  team: TeamCounts;
  coverage: { uncoveredToday: number; uncoveredTomorrow: number; uncoveredTotal: number };
  requests: { pending: number; decidable: number };
  attention: AttentionItem[];
  locations: UnitRow[];
  holidays: { date: string; name: string }[];
  /** Fontes que falharam ou demoraram (os widgets delas avisam; o resto funciona). */
  partial?: ("requests" | "coverage")[];
}

export interface TeamMember {
  employeeId: string;
  name: string;
  locationId: string | null;
  locationName: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  firstInAt: string | null;
  lateMinutes: number;
  absenceType: string | null;
}

export interface TeamPage {
  total: number;
  page: number;
  pageSize: number;
  items: TeamMember[];
}

export interface Birthday {
  employeeId: string;
  name: string;
  locationName: string | null;
  day: number;
  month: number;
  date: string;
}

export interface WidgetPref {
  widgetId: string;
  order: number;
  span: number;
  hidden: boolean;
  /** Só «Estado da equipa»: formato do gráfico (omisso = rosca). */
  chart?: TeamChart;
}

export type TeamChart = "donut" | "bar" | "pie";

export interface DashboardLayout {
  layoutVersion: number;
  widgets: WidgetPref[];
  custom: boolean;
}

/** Contrato com `/api/novo-rh/google-reviews` (backend, módulo google-reviews). */
export interface GoogleLocationRating {
  locationId: string;
  locationName: string;
  placeId: string;
  placeName: string;
  rating: number | null;
  userRatingCount: number | null;
  googleMapsUri: string | null;
  /** O Google não respondeu agora para este local. */
  unavailable: boolean;
}

export interface GoogleReviewsOverview {
  configured: boolean;
  average: { rating: number | null; count: number };
  locations: GoogleLocationRating[];
  unlinked: { locationId: string; locationName: string }[];
}

export interface GooglePlaceCandidate {
  placeId: string;
  name: string;
  address: string | null;
  rating: number | null;
  userRatingCount: number | null;
}

export interface GoogleReview {
  author: string;
  authorUri: string | null;
  rating: number | null;
  text: string | null;
  relativeTime: string | null;
  publishTime: string | null;
}

export interface GoogleLocationReviews {
  placeName: string;
  googleMapsUri: string | null;
  reviews: GoogleReview[];
}
