import { Navigate, useLocation } from "react-router-dom";
import { legacyTarget } from "../../../domain/services/screens.registry.ts";
import { NotFoundView } from "./NotFoundView.tsx";

/** Caminho antigo do Novo RH → novo (mantém o resto do caminho, a query e o hash; sem entrada extra no histórico). */
export function LegacyRedirect() {
  const { pathname, search, hash } = useLocation();
  const to = legacyTarget(pathname, search, hash);
  return to ? <Navigate to={to} replace /> : <NotFoundView />;
}
