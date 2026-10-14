import { useQuery } from "@tanstack/react-query";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.tsx";
import { legacyTabsFor } from "./legacyHrTabs.ts";
import { fetchExpiringContracts } from "./hrApi";

function ExpiringContractsBadge() {
  const { data } = useQuery({
    queryKey: ["hr", "expiring-contracts"],
    queryFn: () => fetchExpiringContracts(30),
    staleTime: 5 * 60 * 1000,
  });

  if (!data || data.length === 0) return null;

  const urgent = data.filter((c) => c.daysRemaining <= 7).length;
  const badgeClass = urgent > 0
    ? "bg-red-100 text-red-700 border-red-200"
    : "bg-amber-100 text-amber-700 border-amber-200";

  return (
    <Link
      to="/hr/employees"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}
      title={data.map((c) => `${c.fullName} — ${c.daysRemaining}d`).join("\n")}
    >
      ⚠ {data.length} contrato{data.length > 1 ? "s" : ""} a expirar
    </Link>
  );
}

/**
 * Recursos Humanos. O Novo RH (`/hr/novo`) tem a sua própria moldura; os
 * ecrãs antigos ficam juntos em "RH antigo", com separadores lado a lado.
 */
export function HrLayout() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  if (pathname.startsWith("/hr/novo")) return <Outlet />;
  const tabs = legacyTabsFor(user?.access ?? null);
  const isOn = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  return (
    <div className="min-h-full bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">RH antigo</h1>
            <span className="text-sm text-slate-500">Gestão de funcionários</span>
            <ExpiringContractsBadge />
          </div>
          <nav aria-label="RH antigo" className="mt-3 flex gap-1 overflow-x-auto">
            {tabs.map((t) => {
              const active = isOn(t.path) || !!t.also?.some(isOn);
              return (
                <NavLink
                  key={t.path}
                  to={t.path}
                  aria-current={active ? "page" : undefined}
                  className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${active ? "border-[#ED5C32] text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                >
                  {t.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
