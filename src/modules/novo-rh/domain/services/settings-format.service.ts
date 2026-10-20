import type { MessageKey } from "../../../../i18n/i18n.ts";
import type { Level, SettingData, SettingDefinition, SettingDomain } from "../entities/settings.ts";
import { optionLabel } from "./features.service.ts";

/** Chaves de texto (i18n) — o domínio não traduz, só escolhe a chave. */
export const LEVEL_KEY: Record<Level, MessageKey> = {
  personal: "settings.level.personal",
  group: "settings.level.group",
  department: "settings.level.department",
  location: "settings.level.location",
  global: "settings.level.global",
  system: "settings.level.system",
};

export const DOMAIN_KEY: Record<SettingDomain, MessageKey> = {
  security: "settings.domain.security",
  time_tracking: "settings.domain.time_tracking",
  notifications: "settings.domain.notifications",
  legal: "settings.domain.legal",
};

export const DOMAINS: SettingDomain[] = ["security", "time_tracking", "notifications", "legal"];

/** Valor legível ("15 min", "Sim", "—"). `yes`/`no` vêm traduzidos. */
export function formatSettingValue(def: Pick<SettingDefinition, "type" | "unit"> | undefined, value: SettingData | null, words: { yes: string; no: string }): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? words.yes : words.no;
  if (typeof value === "number") {
    const unit = def?.unit === "minutes" ? " min" : def?.unit === "days" ? " d" : def?.unit === "meters" ? " m" : "";
    return `${value}${unit}`;
  }
  if (Array.isArray(value)) return value.map((v) => optionLabel(String(v))).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return optionLabel(value);
}

/** Converte o texto de um campo no valor do tipo do parâmetro; `null` se inválido. */
export function parseSettingInput(def: Pick<SettingDefinition, "type">, raw: string): SettingData | null {
  const s = raw.trim();
  switch (def.type) {
    case "bool":
      return s === "true" ? true : s === "false" ? false : null;
    case "int":
    case "duration":
      return /^-?\d+$/.test(s) ? Number(s) : null;
    case "list":
      return s ? s.split(",").map((x) => x.trim()).filter(Boolean) : [];
    case "json":
      try {
        const v = JSON.parse(s) as unknown;
        return v && typeof v === "object" && !Array.isArray(v) ? (v as SettingData) : null;
      } catch {
        return null;
      }
    default:
      return s || null;
  }
}

/** Data local de hoje (AAAA-MM-DD) num fuso. */
export function todayIn(timeZone = "Europe/Lisbon", now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}
