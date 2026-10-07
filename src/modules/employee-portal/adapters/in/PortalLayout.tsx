import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../../../contexts/AuthContext.tsx";
import { SetPasswordView } from "./SetPasswordView.tsx";

const TABS = [
  { to: "/portal", label: "Início", end: true },
  { to: "/portal/escala", label: "Escala", end: false },
  { to: "/portal/documentos", label: "Documentos", end: false },
  { to: "/portal/ausencias", label: "Pedidos", end: false },
  { to: "/portal/perfil", label: "Perfil", end: false },
];

/** Liga o manifest da PWA e o service worker só no Portal (a área de gestão não é instalável). */
function usePortalPwa() {
  useEffect(() => {
    const add = <K extends "link" | "meta">(tag: K, attrs: Record<string, string>) => {
      const el = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      document.head.appendChild(el);
      return el;
    };
    const added = [
      add("link", { rel: "manifest", href: "/portal.webmanifest" }),
      // iPhone: "Adicionar ao ecrã principal" usa estes (não lê o manifest para o ícone).
      add("link", { rel: "apple-touch-icon", href: "/portal/apple-touch-icon.png" }),
      add("meta", { name: "apple-mobile-web-app-capable", content: "yes" }),
      add("meta", { name: "apple-mobile-web-app-title", content: "Portal" }),
      add("meta", { name: "theme-color", content: "#ED5C32" }),
    ];
    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register("/portal-sw.js", { scope: "/portal" }).catch(() => undefined);
    }
    return () => added.forEach((el) => el.remove());
  }, []);
}

/** Portal do Colaborador — layout mobile, sem a barra lateral de gestão. */
export function PortalLayout() {
  const { user } = useAuth();
  usePortalPwa();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#FAF6F3] pb-[env(safe-area-inset-bottom)]">
      <header className="sticky top-0 z-10 border-b border-[#F5C992]/40 bg-white/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
        <p className="text-sm font-semibold text-[#ED5C32]">Portal do Colaborador</p>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-5">
        {user?.mustChangePassword ? <SetPasswordView firstAccess /> : <Outlet />}
      </main>

      {!user?.mustChangePassword && (
        <nav className="sticky bottom-0 border-t border-[#F5C992]/40 bg-white pb-[env(safe-area-inset-bottom)]" aria-label="Portal">
          <ul className="mx-auto grid max-w-md grid-cols-5">
            {TABS.map((t) => (
              <li key={t.to}>
                <NavLink
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) => `block px-1 py-3 text-center text-xs font-medium ${isActive ? "text-[#ED5C32]" : "text-stone-500"}`}
                >
                  {t.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
