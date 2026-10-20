import type { SettingDefinition, SettingDomain } from "../entities/settings.ts";
import { isFeatureKey } from "./features.service.ts";

/**
 * Configurações por tema (FE-090 e seguintes): cada tema é uma página com as
 * regras de um domínio do motor de configurações, editadas no perfil geral.
 * As exceções por centro, grupo ou pessoa ficam em "Perfis e exceções".
 */
export type TopicKey = "features" | "attendance" | "theoretical" | "rosters" | "legal" | "notifications" | "security";


export interface Topic {
  key: TopicKey;
  domain: SettingDomain;
  match: (key: string) => boolean;
}

const RULES: Topic[] = [
  { key: "attendance", domain: "time_tracking", match: (k) => /^time_tracking\.(tolerance|rounding|block_before_start|auto_close|open_record|incidents|correction|ip_allowlist|geofence|kiosk)/.test(k) },
  { key: "theoretical", domain: "time_tracking", match: (k) => /^time_tracking\.(theoretical|night_shift)\./.test(k) },
  { key: "rosters", domain: "time_tracking", match: (k) => k.startsWith("time_tracking.roster.") },
  { key: "legal", domain: "legal", match: (k) => k.startsWith("legal.") },
  { key: "notifications", domain: "notifications", match: (k) => k.startsWith("notifications.") },
  { key: "security", domain: "security", match: (k) => k.startsWith("security.") },
];

/**
 * «Funcionalidades» vem primeiro e junta o que é opcional (de vários domínios);
 * os outros temas mostram só as regras base (sem o que é de uma funcionalidade).
 */
export const TOPICS: Topic[] = [
  { key: "features", domain: "time_tracking", match: (k) => isFeatureKey(k) },
  ...RULES.map((t) => ({ ...t, match: (k: string) => t.match(k) && !isFeatureKey(k) })),
];

export const topicDefinitions = (topic: Topic, defs: SettingDefinition[]) =>
  topic.key === "features" ? defs.filter((d) => isFeatureKey(d.key)) : defs.filter((d) => d.domain === topic.domain && topic.match(d.key));

/** Parâmetros que nenhum tema mostra (para não ficarem esquecidos — vão para "Perfis e exceções"). */
export const uncovered = (defs: SettingDefinition[]) => defs.filter((d) => !isFeatureKey(d.key) && !TOPICS.some((t) => t.domain === d.domain && t.match(d.key)));
