import { apiDeleteJson, apiGet, apiPut } from "../../../../lib/api.ts";
import type { Birthday, DashboardLayout, OperationalSnapshot, TeamCategory, TeamPage, WidgetPref } from "../../domain/entities/dashboard.ts";
import type { DashboardApiPort } from "../../domain/ports/out/dashboard-api.port.ts";

const B = "/api/novo-rh/dashboard";
const qs = (o: Record<string, string | number | null | undefined>) =>
  new URLSearchParams(Object.entries(o).filter((e): e is [string, string | number] => e[1] !== null && e[1] !== undefined && e[1] !== "").map(([k, v]) => [k, String(v)])).toString();

export class HttpDashboardApiAdapter implements DashboardApiPort {
  snapshot(locationId: string | null, signal?: AbortSignal) {
    return apiGet<OperationalSnapshot>(`${B}/snapshot?${qs({ locationId })}`, signal);
  }
  team(category: TeamCategory, f: { locationId: string | null; q: string; page: number }, signal?: AbortSignal) {
    return apiGet<TeamPage>(`${B}/team?${qs({ category, locationId: f.locationId, q: f.q, page: f.page })}`, signal);
  }
  birthdays() {
    return apiGet<Birthday[]>(`${B}/birthdays`);
  }
  layout() {
    return apiGet<DashboardLayout>(`${B}/layout`);
  }
  saveLayout(widgets: WidgetPref[]) {
    return apiPut<DashboardLayout>(`${B}/layout`, { widgets });
  }
  resetLayout() {
    return apiDeleteJson<DashboardLayout>(`${B}/layout`);
  }
}
