import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../../contexts/AuthContext.tsx";
import { SetPasswordView } from "./SetPasswordView.tsx";
import { usePortalHome } from "./use-portal-home.ts";

export function PortalProfileView() {
  const { user, signOut } = useAuth();
  const { data: home } = usePortalHome();
  const [changing, setChanging] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-line bg-surface-card p-5 shadow-card">
        <p className="text-lg font-semibold text-navy-900">{home?.employee.shortName ?? ""}</p>
        <p className="text-sm text-ink-secondary">{user?.email}</p>
      </section>

      {changing ? (
        <SetPasswordView
          firstAccess={false}
          onDone={() => {
            setChanging(false);
            setSaved(true);
          }}
        />
      ) : (
        <button onClick={() => setChanging(true)} className="w-full rounded-xl border border-line bg-surface-card px-4 py-3 text-sm font-medium text-ink">
          Mudar palavra-passe
        </button>
      )}
      {saved && <p className="text-sm text-emerald-700">Palavra-passe atualizada.</p>}

      {user && user.role !== "employee" && (
        <Link to="/" className="block w-full rounded-xl border border-line bg-surface-card px-4 py-3 text-center text-sm font-medium text-ink">
          Ir para a área de gestão
        </Link>
      )}

      <button onClick={() => void signOut()} className="min-h-11 w-full rounded-xl px-4 py-3 text-sm font-medium text-red-700">
        Terminar sessão
      </button>
    </div>
  );
}
