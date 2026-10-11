import { esES } from "./messages/es-ES.ts";
import { ptPT, type MessageKey } from "./messages/pt-PT.ts";

/**
 * Base de internacionalização (task RH Fase 0, D13: pt-PT agora, es-ES
 * depois). Sem dependências: catálogos tipados + `Intl`. Ecrãs novos usam
 * `t()`; os existentes não são migrados em bloco.
 */
export type Locale = "pt-PT" | "es-ES";
export type { MessageKey };

export const LOCALES: Locale[] = ["pt-PT", "es-ES"];
export const DEFAULT_LOCALE: Locale = "pt-PT";

const CATALOGS: Record<Locale, Partial<Record<MessageKey, string>>> = { "pt-PT": ptPT, "es-ES": esES };

export type Params = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: Params) => string;

export function createTranslator(locale: Locale): Translate {
  const catalog = CATALOGS[locale];
  return (key, params) => {
    const text = catalog[key] ?? ptPT[key];
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
  };
}

/** Chaves ainda sem tradução num idioma (para o relatório de fim de fase). */
export function missingKeys(locale: Locale): MessageKey[] {
  const catalog = CATALOGS[locale];
  return (Object.keys(ptPT) as MessageKey[]).filter((k) => catalog[k] === undefined);
}

/** Formatadores `Intl` por idioma e fuso (o fuso do centro, não o do browser). */
export function formatters(locale: Locale, timeZone: string) {
  return {
    date: (d: Date) => new Intl.DateTimeFormat(locale, { timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).format(d),
    time: (d: Date) => new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d),
    number: (n: number, digits = 0) => new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n),
  };
}
