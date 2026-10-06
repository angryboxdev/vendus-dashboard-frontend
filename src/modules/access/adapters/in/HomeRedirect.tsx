import { Navigate } from "react-router-dom";
import { useAuth } from "../../../../contexts/AuthContext.tsx";
import { canOpenPath } from "../../domain/services/access-ui.service.ts";

/** Ordem de preferência da página inicial — a primeira a que o perfil tem acesso. */
const HOME_CANDIDATES = ["/vendus", "/results", "/hr/overview", "/hr/schedules", "/stock/movimentacoes", "/crm", "/financial/invoices", "/dre/demonstrativo", "/empresa"];

/** `/` → primeira área permitida (antes era sempre `/vendus`, que um perfil RH, por exemplo, não vê). */
export function HomeRedirect() {
  const { user } = useAuth();
  const access = user?.access;
  if (!access) return <Navigate to="/vendus" replace />;
  if (access.portalOnly) return <Navigate to="/portal" replace />;
  const target = HOME_CANDIDATES.find((p) => canOpenPath(access, p)) ?? "/empresa";
  return <Navigate to={target} replace />;
}
