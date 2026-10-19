import type { MessageKey } from "./pt-PT.ts";

/**
 * es-ES (ADR-0023 do backend: pt-PT agora, es-ES depois). Chaves em falta
 * usam o texto pt-PT; `missingKeys("es-ES")` lista-as para o relatório de fase.
 */
export const esES: Partial<Record<MessageKey, string>> = {
  "ros.board.areas": "Áreas",
  "ros.tab.areas": "Áreas de trabajo",
  "ros.area": "Área de trabajo",
  "ros.area.none": "Sin área",
  "ros.area.manage": "Gestionar áreas",
  "ros.areas.location": "Centro",
  "ros.areas.empty": "Este centro aún no tiene áreas. Cree, por ejemplo, Sala, Caja o Cocina.",
  "ros.areas.name": "Nombre del área",
  "ros.areas.add": "Añadir área",
  "ros.areas.up": "Subir",
  "ros.areas.down": "Bajar",
  "ros.areas.rename": "Cambiar el nombre",
  "ros.areas.save": "Guardar",
  "ros.areas.deactivate": "Desactivar",
  "ros.areas.activate": "Reactivar",
  "ros.areas.inactive": "Desactivada",
  "ros.areas.hint": "Las áreas son opcionales y se eligen en cada turno. Desactivar un área no la borra de los turnos antiguos.",
  "common.inDevelopment": "En desarrollo",
  "common.done": "Completada",
  "common.inProgress": "En curso",
  "common.planned": "Planificada",
  "novoRh.title": "Nuevo RR. HH.",
};
