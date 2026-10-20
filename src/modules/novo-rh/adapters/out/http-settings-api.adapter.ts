import { apiGet, apiGetBlob, apiGetVersioned, apiWrite } from "../../../../lib/api.ts";
import type {
  EffectiveSetting,
  HistoryEntry,
  ImpactPreview,
  ProfileDetail,
  ProfileKind,
  SettingData,
  SettingDefinition,
  SettingDomain,
  SettingProfile,
  SettingTarget,
  SettingValue,
  TargetType,
  VersionedProfile,
} from "../../domain/entities/settings.ts";
import type { DataMode } from "../../domain/entities/roadmap.ts";
import type { Option, SettingsApiPort } from "../../domain/ports/out/settings-api.port.ts";

const BASE = "/api/novo-rh/settings";

export class HttpSettingsApiAdapter implements SettingsApiPort {
  private readonly mode: () => DataMode;
  constructor(mode: () => DataMode = () => "real") {
    this.mode = mode;
  }

  features() {
    return apiGet<Record<string, boolean>>("/api/me/features");
  }
  listDefinitions() {
    return apiGet<SettingDefinition[]>(`${BASE}/definitions`);
  }
  listProfiles() {
    return apiGet<SettingProfile[]>(`${BASE}/profiles`);
  }
  async getProfile(id: string): Promise<VersionedProfile> {
    const { data, etag } = await apiGetVersioned<ProfileDetail>(`${BASE}/profiles/${encodeURIComponent(id)}`);
    return { detail: data, etag };
  }
  async createProfile(input: { domain: SettingDomain; name: string; kind: ProfileKind }) {
    return (await apiWrite<SettingProfile>(`${BASE}/profiles`, { body: input })).data;
  }
  async addTarget(profileId: string, etag: string | null, input: { targetType: TargetType; targetId: string; validFrom: string; validTo: string | null }) {
    return (await apiWrite<SettingTarget>(`${BASE}/profiles/${encodeURIComponent(profileId)}/targets`, { body: input, ifMatch: etag })).data;
  }
  async setValue(profileId: string, etag: string | null, input: { key: string; value: SettingData | null; validFrom: string; reason: string }) {
    return (await apiWrite<{ value: SettingValue; impact: ImpactPreview | null }>(`${BASE}/profiles/${encodeURIComponent(profileId)}/values`, { body: input, ifMatch: etag })).data;
  }
  async impactPreview(profileId: string, validFrom: string) {
    return (await apiWrite<ImpactPreview>(`${BASE}/profiles/${encodeURIComponent(profileId)}/impact-preview`, { body: { validFrom } })).data;
  }
  effective(employeeId: string, date: string) {
    return apiGet<EffectiveSetting[]>(`${BASE}/effective?employeeId=${encodeURIComponent(employeeId)}&date=${date}`);
  }
  history(filter: { key?: string; profileId?: string }) {
    const q = new URLSearchParams();
    if (filter.key) q.set("key", filter.key);
    if (filter.profileId) q.set("profileId", filter.profileId);
    return apiGet<HistoryEntry[]>(`${BASE}/history?${q.toString()}`);
  }
  downloadHistoryCsv() {
    return apiGetBlob(`${BASE}/history.csv`);
  }
  // Sempre do Novo RH (Real ou Demonstração) — já não depende da API do RH antigo.
  async listEmployees(): Promise<Option[]> {
    const rows = await apiGet<{ id: string; fullName: string; photoUrl?: string | null }[]>("/api/novo-rh/people?status=active");
    return rows.map((e) => ({ id: e.id, label: e.fullName, photoUrl: e.photoUrl ?? null }));
  }
  async listLocations(): Promise<Option[]> {
    const rows = await apiGet<{ id: string; name: string }[]>(this.mode() === "demo" ? "/api/novo-rh/catalog/locations" : "/api/locations");
    return rows.map((l) => ({ id: l.id, label: l.name }));
  }
}
