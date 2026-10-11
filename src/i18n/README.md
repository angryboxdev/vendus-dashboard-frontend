# i18n — idiomas da interface

> Status: active (partilhado) — desde 2026-10-11 (task RH, Fase 0; ADR-0023 do backend)

pt-PT agora, es-ES depois. Sem dependências: catálogos tipados + `Intl`.

- `messages/pt-PT.ts` — catálogo de origem; chaves planas `área.texto`, parâmetros `{nome}`.
- `messages/es-ES.ts` — mesmas chaves; as que faltam usam o texto pt-PT.
- `i18n.ts` — `createTranslator(locale)`, `missingKeys(locale)` (lista para o relatório de fase), `formatters(locale, fuso)` para datas, horas e números **no fuso do centro**.
- `I18nProvider.tsx` — `useI18n()` devolve `{ locale, t }`; sem provider, pt-PT.

Ecrãs novos (Novo RH) usam `t()` desde o início; os existentes não são migrados em bloco.

Como testar: `npx vitest run src/i18n`
