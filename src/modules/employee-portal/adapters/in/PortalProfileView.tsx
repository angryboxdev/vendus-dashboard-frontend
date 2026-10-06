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
      <section className="rounded-2xl border border-[#F5C992]/50 bg-white p-5 shadow-sm">
        <p className="text-lg font-semibold text-stone-900">{home?.employee.shortName ?? ""}</p>
        <p className="text-sm text-stone-600">{user?.email}</p>
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
        <button onClick={() => setChanging(true)} className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700">
          Mudar palavra-passe
        </button>
      )}
      {saved && <p className="text-sm text-emerald-700">Palavra-passe atualizada.</p>}

      {user && user.role !== "employee" && (
        <Link to="/" className="block w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-center text-sm font-medium text-stone-700">
          Ir para a área de gestão
        </Link>
      )}

      <button onClick={() => void signOut()} className="w-full rounded-xl px-4 py-3 text-sm font-medium text-red-600">
        Terminar sessão
      </button>
    </div>
  );
}
