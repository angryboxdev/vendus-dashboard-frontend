/** Contrato com `/api/novo-rh/settings` (backend, módulo settings). */

export type SettingType = "bool" | "int" | "duration" | "enum" | "time" | "list" | "json";
export type SettingData = boolean | number | string | string[] | { [k: string]: unknown };
export type SettingDomain = "security" | "time_tracking" | "notifications" | "legal";

export interface SettingDefinition {
  key: string;
  domain: SettingDomain;
  type: SettingType;
  label: string;
  description: string;
  unit?: "minutes" | "days" | "meters";
  /** null = parâmetro sem valor (legais — ADR-0026 do backend). */
  defaultValue: SettingData | null;
  min?: number;
  max?: number;
  allowed?: string[];
  requires?: { key: string; equals: SettingData }[];
  sensitive: boolean;
  legal: boolean;
  toValidate: boolean;
  activeFromPhase?: number;
}

export type ProfileKind = "global" | "segment" | "personal";
export type TargetType = "employee" | "group" | "department" | "location";

export interface SettingProfile {
  id: string;
  domain: SettingDomain;
  name: string;
  kind: ProfileKind;
  archived: boolean;
}

export interface SettingTarget {
  id: string;
  profileId: string;
  targetType: TargetType;
  targetId: string;
  validFrom: string;
  validTo: string | null;
}

export interface SettingValue {
  id: string;
  profileId: string;
  key: string;
  value: SettingData | null;
  validFrom: string;
  createdAt: string;
  createdBy: string;
  reason: string;
}

export interface ProfileDetail {
  profile: SettingProfile;
  targets: SettingTarget[];
  values: SettingValue[];
  version: string;
}

export type Level = "personal" | "group" | "department" | "location" | "global" | "system";

export interface ValueOrigin {
  level: Level;
  profileId: string | null;
  profileName: string | null;
  valueId: string | null;
  validFrom: string | null;
}

export interface EffectiveSetting {
  key: string;
  value: SettingData | null;
  origin: ValueOrigin;
  inherited: { value: SettingData | null; origin: ValueOrigin } | null;
}

export interface ImpactPreview {
  employees: number;
  pastDays: number;
  validFrom: string;
}

export interface HistoryEntry {
  valueId: string;
  profileId: string;
  profileName: string;
  key: string;
  label: string;
  before: SettingData | null;
  after: SettingData | null;
  validFrom: string;
  createdAt: string;
  createdBy: string;
  reason: string;
}

/** Perfil com a versão lida (ETag) — vai no If-Match da escrita seguinte. */
export interface VersionedProfile {
  detail: ProfileDetail;
  etag: string | null;
}
