import type {
  Birthday,
  DashboardLayout,
  GoogleLocationReviews,
  GooglePlaceCandidate,
  GoogleReviewsOverview,
  OperationalSnapshot,
  TeamCategory,
  TeamPage,
  WidgetPref,
} from "../../entities/dashboard.ts";

/** Dashboard executivo (`/api/novo-rh/dashboard`) e avaliações Google (`/api/novo-rh/google-reviews`). */
export interface DashboardApiPort {
  snapshot(locationId: string | null, signal?: AbortSignal): Promise<OperationalSnapshot>;
  team(category: TeamCategory, filter: { locationId: string | null; q: string; page: number }, signal?: AbortSignal): Promise<TeamPage>;
  birthdays(): Promise<Birthday[]>;
  layout(): Promise<DashboardLayout>;
  saveLayout(widgets: WidgetPref[]): Promise<DashboardLayout>;
  resetLayout(): Promise<DashboardLayout>;
  googleReviews(): Promise<GoogleReviewsOverview>;
  googleSearch(q: string): Promise<GooglePlaceCandidate[]>;
  googleLink(locationId: string, place: { placeId: string; placeName: string }): Promise<GoogleReviewsOverview>;
  googleUnlink(locationId: string): Promise<GoogleReviewsOverview>;
  googleLocationReviews(locationId: string): Promise<GoogleLocationReviews>;
}
