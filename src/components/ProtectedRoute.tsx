import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * `allowEmployee`: só o Portal do Colaborador. Em todas as outras rotas, uma
 * conta `employee` é levada para `/portal` (o backend recusa-lhe na mesma
 * qualquer rota de gestão — isto é só para não mostrar ecrãs vazios).
 */
export function ProtectedRoute({ children, allowEmployee = false }: { children: React.ReactNode; allowEmployee?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="text-sm text-slate-500">A carregar…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (user.role === "employee" && !allowEmployee) {
    return <Navigate to="/portal" replace />;
  }

  return <>{children}</>;
}
