import type { Birthday, DashboardLayout, OperationalSnapshot, TeamCategory, TeamPage, WidgetPref } from "../../entities/dashboard.ts";

/** Dashboard executivo (`/api/novo-rh/dashboard`). */
export interface DashboardApiPort {
  snapshot(locationId: string | null, signal?: AbortSignal): Promise<OperationalSnapshot>;
  team(category: TeamCategory, filter: { locationId: string | null; q: string; page: number }, signal?: AbortSignal): Promise<TeamPage>;
  birthdays(): Promise<Birthday[]>;
  layout(): Promise<DashboardLayout>;
  saveLayout(widgets: WidgetPref[]): Promise<DashboardLayout>;
  resetLayout(): Promise<DashboardLayout>;
}
