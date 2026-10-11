import type {
  EffectiveSetting,
  HistoryEntry,
  ImpactPreview,
  ProfileKind,
  SettingData,
  SettingDefinition,
  SettingDomain,
  SettingProfile,
  SettingTarget,
  SettingValue,
  TargetType,
  VersionedProfile,
} from "../../entities/settings.ts";

export interface Option {
  id: string;
  label: string;
}

/** Motor de configurações do Novo RH (+ listas de apoio para escolher alvos). */
export interface SettingsApiPort {
  listDefinitions(): Promise<SettingDefinition[]>;
  listProfiles(): Promise<SettingProfile[]>;
  getProfile(id: string): Promise<VersionedProfile>;
  createProfile(input: { domain: SettingDomain; name: string; kind: ProfileKind }): Promise<SettingProfile>;
  addTarget(profileId: string, etag: string | null, input: { targetType: TargetType; targetId: string; validFrom: string; validTo: string | null }): Promise<SettingTarget>;
  setValue(
    profileId: string,
    etag: string | null,
    input: { key: string; value: SettingData | null; validFrom: string; reason: string },
  ): Promise<{ value: SettingValue; impact: ImpactPreview | null }>;
  impactPreview(profileId: string, validFrom: string): Promise<ImpactPreview>;
  effective(employeeId: string, date: string): Promise<EffectiveSetting[]>;
  history(filter: { key?: string; profileId?: string }): Promise<HistoryEntry[]>;
  downloadHistoryCsv(): Promise<Blob>;
  listEmployees(): Promise<Option[]>;
  listLocations(): Promise<Option[]>;
}
