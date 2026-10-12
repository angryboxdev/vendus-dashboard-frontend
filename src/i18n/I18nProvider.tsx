import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator, DEFAULT_LOCALE, type Locale, type Translate } from "./i18n.ts";

const I18nContext = createContext<{ locale: Locale; t: Translate }>({ locale: DEFAULT_LOCALE, t: createTranslator(DEFAULT_LOCALE) });

/** Opcional: sem provider, `useI18n()` devolve pt-PT. */
export function I18nProvider({ locale = DEFAULT_LOCALE, children }: { locale?: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: createTranslator(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  return useContext(I18nContext);
}
