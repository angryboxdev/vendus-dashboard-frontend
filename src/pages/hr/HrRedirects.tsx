import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.tsx";
import { hrHomeFor } from "./legacyHrTabs.ts";

/** `/hr`: Novo RH (módulos principais) ou, para quem não o abre, o RH antigo. */
export function HrHomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={hrHomeFor(user?.access ?? null)} replace />;
}

/** `/hr/antigo`: primeiro ecrã do RH antigo que o utilizador pode abrir. */
export function LegacyHrRedirect() {
  const { user } = useAuth();
  return <Navigate to={hrHomeFor(user?.access ?? null, true)} replace />;
}
