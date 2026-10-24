import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEmployeePortalModule } from "../../employee-portal.module.tsx";
import { useAuth } from "../../../../contexts/AuthContext.tsx";
import { AppIcon, BRAND, FOCUS_RING, type AppIconKey } from "../../../../components/ui";
import { SetPasswordView } from "./SetPasswordView.tsx";

const TABS: { to: string; label: string; end: boolean; icon: AppIconKey }[] = [
  { to: "/portal", label: "Início", end: true, icon: "home" },
  { to: "/portal/escala", label: "Escala", end: false, icon: "rosters" },
  { to: "/portal/documentos", label: "Documentos", end: false, icon: "documents" },
  { to: "/portal/ausencias", label: "Pedidos", end: false, icon: "requests" },
  { to: "/portal/mais", label: "Mais", end: false, icon: "more" },
];

/** Secções abertas a partir de "Mais" (o separador fica ativo nelas). */
const MORE = ["/portal/mais", "/portal/perfil", "/portal/comunicados", "/portal/tarefas", "/portal/solicitacoes", "/portal/equipa"];

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
      add("meta", { name: "theme-color", content: BRAND.primary }),
    ];
    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker.register("/portal-sw.js", { scope: "/portal" }).catch(() => undefined);
    }
    return () => added.forEach((el) => el.remove());
  }, []);
}

/** Número laranja de notificações (1, 2, … 9+). */
function NavBadge({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-surface-card" aria-label={`${n} por tratar`}>
      {n > 9 ? "9+" : n}
    </span>
  );
}

/**
 * Portal do Colaborador — mobile-first, sem a barra lateral de gestão.
 * Telemóvel: cabeçalho curto e barra de baixo fixa (ícone + nome, alvos ≥ 44 px,
 * safe-area). Ecrã largo (≥ 1024 px): os mesmos separadores no cabeçalho.
 */
export function PortalLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  usePortalPwa();
  const showNav = !user?.mustChangePassword;
  const { engagement } = useEmployeePortalModule();
  // Número laranja no «Mais»: comunicados/documentos da empresa, tarefas e solicitações que pedem ação.
  const pending = useQuery({ queryKey: ["portal-pending"], queryFn: () => engagement.pendingCount(), retry: false, enabled: showNav, refetchInterval: 5 * 60_000 });
  const badge = (t: (typeof TABS)[number]) => (t.to === "/portal/mais" ? (pending.data ?? 0) : 0);
  const active = (t: (typeof TABS)[number], isActive: boolean) => isActive || (t.to === "/portal/mais" && MORE.includes(pathname));

  return (
    <div className="flex min-h-[100dvh] flex-col bg-surface-app font-sans text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-surface-card/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-brand-600" />
            Portal do Colaborador
          </p>
          {showNav && (
            <nav aria-label="Portal (ecrã largo)" className="hidden lg:block">
              <ul className="flex items-center gap-1">
                {TABS.map((t) => (
                  <li key={t.to}>
                    <NavLink
                      to={t.to}
                      end={t.end}
                      className={({ isActive }) =>
                        `flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors ${FOCUS_RING} ${active(t, isActive) ? "bg-brand-50 text-brand-600" : "text-ink-secondary hover:bg-surface-soft hover:text-navy-900"}`
                      }
                    >
                      <AppIcon name={t.icon} size={18} />
                      {t.label}
                      <NavBadge n={badge(t)} />
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </header>

      <main className={`mx-auto w-full max-w-xl flex-1 px-4 pt-5 sm:px-6 md:max-w-3xl lg:max-w-5xl lg:pb-10 ${showNav ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))]" : "pb-8"}`}>
        {user?.mustChangePassword ? <SetPasswordView firstAccess /> : <Outlet />}
      </main>

      {showNav && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Portal">
          <ul className="mx-auto grid max-w-xl grid-cols-5">
            {TABS.map((t) => (
              <li key={t.to}>
                <NavLink
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    `flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors ${FOCUS_RING} ${active(t, isActive) ? "text-brand-600" : "text-ink-secondary"}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={`relative flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active(t, isActive) ? "bg-brand-50" : ""}`}>
                        <AppIcon name={t.icon} size={20} />
                        {badge(t) > 0 && (
                          <span className="absolute -right-0.5 -top-1">
                            <NavBadge n={badge(t)} />
                          </span>
                        )}
                      </span>
                      {t.label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
