import type { SettingDefinition, SettingDomain } from "../entities/settings.ts";

/**
 * Configurações por tema (FE-090 e seguintes): cada tema é uma página com as
 * regras de um domínio do motor de configurações, editadas no perfil geral.
 * As exceções por centro, grupo ou pessoa ficam em "Perfis e exceções".
 */
export type TopicKey = "features" | "attendance" | "theoretical" | "bank" | "rosters" | "legal" | "notifications" | "security";

/** Funcionalidades opcionais da empresa (ligar/desligar). */
const FEATURES = new Set(["time_tracking.roster.coverage_enabled"]);

export interface Topic {
  key: TopicKey;
  domain: SettingDomain;
  match: (key: string) => boolean;
}

export const TOPICS: Topic[] = [
  { key: "attendance", domain: "time_tracking", match: (k) => /^time_tracking\.(tolerance|rounding|block_before_start|auto_close|open_record|incidents|correction|ip_allowlist|geofence|kiosk)/.test(k) },
  { key: "theoretical", domain: "time_tracking", match: (k) => /^time_tracking\.(theoretical|night_shift)\./.test(k) },
  { key: "bank", domain: "time_tracking", match: (k) => k.startsWith("time_tracking.bank.") },
  { key: "rosters", domain: "time_tracking", match: (k) => k.startsWith("time_tracking.roster.") && !FEATURES.has(k) },
  { key: "features", domain: "time_tracking", match: (k) => FEATURES.has(k) },
  { key: "legal", domain: "legal", match: (k) => k.startsWith("legal.") },
  { key: "notifications", domain: "notifications", match: (k) => k.startsWith("notifications.") },
  { key: "security", domain: "security", match: (k) => k.startsWith("security.") },
];

export const topicDefinitions = (topic: Topic, defs: SettingDefinition[]) => defs.filter((d) => d.domain === topic.domain && topic.match(d.key));

/** Parâmetros que nenhum tema mostra (para não ficarem esquecidos — vão para "Perfis e exceções"). */
export const uncovered = (defs: SettingDefinition[]) => defs.filter((d) => !TOPICS.some((t) => t.domain === d.domain && t.match(d.key)));
