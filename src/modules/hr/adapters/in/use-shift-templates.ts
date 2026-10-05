import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ShiftTemplatePayload } from "../../domain/entities/shift-template.ts";
import { useHrModule } from "../../hr.module.tsx";

export const SHIFT_TEMPLATES_QUERY_KEY = ["hr-shift-templates"];

/** Modelos de turno (RH 2.0) — lista partilhada pela aba Modelos & Automatizações e, a seguir, por "Aplicar modelo". */
export function useShiftTemplates() {
  const { api } = useHrModule();
  return useQuery({ queryKey: SHIFT_TEMPLATES_QUERY_KEY, queryFn: () => api.listShiftTemplates() });
}

export function useManageShiftTemplates() {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: SHIFT_TEMPLATES_QUERY_KEY });

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | null; payload: ShiftTemplatePayload }) =>
      id ? api.updateShiftTemplate(id, payload) : api.createShiftTemplate(payload),
    onSuccess: invalidate,
  });

  const setActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.setShiftTemplateActive(id, active),
    onSuccess: invalidate,
  });

  return { saveMutation, setActiveMutation };
}
