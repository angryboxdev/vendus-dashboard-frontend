import type { MessageKey } from "./pt-PT.ts";

/**
 * es-ES (ADR-0023 do backend: pt-PT agora, es-ES depois). Chaves em falta
 * usam o texto pt-PT; `missingKeys("es-ES")` lista-as para o relatório de fase.
 */
export const esES: Partial<Record<MessageKey, string>> = {
  "common.inDevelopment": "En desarrollo",
  "common.done": "Completada",
  "common.inProgress": "En curso",
  "common.planned": "Planificada",
  "novoRh.title": "Nuevo RR. HH.",
};
