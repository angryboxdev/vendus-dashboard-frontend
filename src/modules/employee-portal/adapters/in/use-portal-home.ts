import { useQuery } from "@tanstack/react-query";
import { useEmployeePortalModule } from "../../employee-portal.module.tsx";

export const PORTAL_HOME_QUERY_KEY = ["portal-home"];

/** Início do Portal — atualiza ao voltar à app (o estado da picagem pode ter mudado noutro dispositivo/pelo gestor). */
export function usePortalHome() {
  const { getHome } = useEmployeePortalModule();
  return useQuery({
    queryKey: PORTAL_HOME_QUERY_KEY,
    queryFn: () => getHome.execute(),
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    retry: false,
  });
}
