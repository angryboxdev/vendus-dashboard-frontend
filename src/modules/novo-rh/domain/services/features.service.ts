import type { SettingDefinition, SettingDomain } from "../entities/settings.ts";

/**
 * Funcionalidades opcionais da empresa (Configurações → Geral →
 * Funcionalidades): cada uma tem um interruptor (o parâmetro principal) e as
 * suas definições só aparecem quando está ligada. O que uma empresa pode
 * dispensar vive aqui; as regras base ficam nos outros temas.
 */
export interface Feature {
  /** Parâmetro principal (sim/não). */
  key: string;
  domain: SettingDomain;
  /** Definições que só fazem sentido com a funcionalidade ligada. */
  sub: (key: string) => boolean;
  /** Onde se gere o resto (ex.: mínimos de cobertura nas Escalas). */
  link?: { to: string; label: string };
}

const none = () => false;

export const FEATURES: Feature[] = [
  { key: "time_tracking.bank.enabled", domain: "time_tracking", sub: (k) => k.startsWith("time_tracking.bank.") && k !== "time_tracking.bank.enabled" },
  { key: "time_tracking.roster.coverage_enabled", domain: "time_tracking", sub: none, link: { to: "/hr/novo/escalas", label: "Definir mínimos nas Escalas" } },
  { key: "time_tracking.kiosk.enabled", domain: "time_tracking", sub: (k) => k === "time_tracking.kiosk.methods" },
  { key: "time_tracking.geofence.require_coordinates", domain: "time_tracking", sub: none },
  // Interruptor próprio, ligado por omissão (2026-10-24): bloqueia a entrada fora do raio sem guardar a localização.
  { key: "time_tracking.geofence.block_outside", domain: "time_tracking", sub: none },
  { key: "time_tracking.auto_close.enabled", domain: "time_tracking", sub: none },
  { key: "time_tracking.correction.employee_can_refuse", domain: "time_tracking", sub: (k) => k === "time_tracking.correction.refusal_hours" },
  { key: "security.mfa.required", domain: "security", sub: none },
];

/** O parâmetro pertence a uma funcionalidade (interruptor ou definição dela)? */
export const isFeatureKey = (key: string) => FEATURES.some((f) => f.key === key || f.sub(key));

/** Definições de uma funcionalidade, pela ordem do catálogo. */
export const featureSubDefinitions = (f: Feature, defs: SettingDefinition[]) => defs.filter((d) => d.domain === f.domain && f.sub(d.key));

/** Funcionalidade desligada na empresa? (Sem resposta do servidor: tudo visível, como antes.) */
export const featureOff = (features: Record<string, boolean> | undefined, key: string) => features?.[key] === false;

/** Nomes legíveis das opções (em vez de `closed_month`, `night_schedule_only`…). */
export const OPTION_LABELS: Record<string, string> = {
  off: "Desligado",
  own_location: "Só o próprio centro",
  organization: "Toda a empresa",
  schedule: "Pelo horário",
  contract: "Pelas horas do contrato",
  night_schedule_only: "Só com horário noturno",
  continuity_margin: "Também por margem de continuidade",
  pin: "PIN",
  qr: "QR",
  nfc: "NFC",
  warning: "Aviso (pede confirmação)",
  block: "Bloqueio (impede publicar)",
  closed_month: "A mês vencido",
  until_yesterday: "Até ontem",
  leave_days: "Compensa em dias de férias",
  hours: "Compensa em horas no banco",
};
export const optionLabel = (v: string) => OPTION_LABELS[v] ?? v;
