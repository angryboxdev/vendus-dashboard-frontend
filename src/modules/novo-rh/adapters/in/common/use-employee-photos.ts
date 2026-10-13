import { useQuery } from "@tanstack/react-query";
import { useNovoRh } from "../../../novo-rh.module.tsx";

/**
 * Foto de cada colaborador (a mesma lista em cache dos seletores de
 * colaborador): devolve o URL ou null. Os ecrãs mostram-na ao lado do nome.
 */
export function useEmployeePhotos(): (employeeId: string) => string | null {
  const { settings } = useNovoRh();
  const q = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  return (id) => q.data?.find((e) => e.id === id)?.photoUrl ?? null;
}
