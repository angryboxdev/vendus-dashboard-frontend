import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PositionPayload } from "../../domain/entities/position.ts";
import { useHrModule } from "../../hr.module.tsx";

export const POSITIONS_QUERY_KEY = ["hr-positions"];

/** Lista de cargos partilhada pela aba Cargos, pela Lista e pelo perfil (nome do cargo de cada colaborador). */
export function usePositions() {
  const { api } = useHrModule();
  return useQuery({ queryKey: POSITIONS_QUERY_KEY, queryFn: () => api.listPositions() });
}

export function useManagePositions() {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: POSITIONS_QUERY_KEY });
    void qc.invalidateQueries({ queryKey: ["hr-people-list"] });
  };

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | null; payload: Required<Pick<PositionPayload, "name">> & PositionPayload }) =>
      id ? api.updatePosition(id, payload) : api.createPosition(payload),
    onSuccess: invalidate,
  });

  const setActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.setPositionActive(id, active),
    onSuccess: invalidate,
  });

  return { saveMutation, setActiveMutation };
}
