import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const dreNavItems = [
  { to: "/dre/demonstrativo", label: "Mapa" },
  { to: "/dre/receita-bruta", label: "Receitas" },
  { to: "/dre/custos-fixos", label: "Custos Fixos" },
  { to: "/dre/custos-variaveis", label: "Custos Variáveis" },
] as const;

const stockNavItems = [
  { to: "/stock/movimentacoes", label: "Balanço de stock" },
  { to: "/stock/historico-movimentos", label: "Histórico de movimentos" },
  { to: "/stock/stock", label: "Itens de stock" },
  { to: "/stock/pizzas", label: "Fichas Técnicas" },
] as const;

const hrNavItems = [
  { to: "/hr", label: "Funcionários" },
  { to: "/hr/calendar", label: "Calendário de turnos" },
  { to: "/hr/ferias", label: "Férias & Ausências" },
  { to: "/hr/relatorio", label: "Relatório de assiduidade" },
  { to: "/hr/historico", label: "Histórico de alterações" },
] as const;

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-slate-100 text-slate-900"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
  }`;

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-slate-400 transition-transform ${
        open ? "rotate-180" : ""
      }`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg
      className="h-5 w-5 text-slate-600"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 5A.75.75 0 012.75 9h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 9.75zm0 5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SidebarContent({ onNavClick }: { onNavClick: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const isDrePath = location.pathname.startsWith("/dre");
  const isStockPath = location.pathname.startsWith("/stock");
  const isHrPath = location.pathname.startsWith("/hr");
  const isAdminPath = location.pathname.startsWith("/admin");
  const [dreOpen, setDreOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [hrOpen, setHrOpen] = useState(false);
  const dreExpanded = isDrePath || dreOpen;
  const stockExpanded = isStockPath || stockOpen;
  const hrExpanded = isHrPath || hrOpen;

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <>
      <div className="p-4">
        <h1 className="text-lg font-semibold text-slate-800">Angry Box Hub</h1>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 pb-4">
        <NavLink to="/" end className={navLinkClass} onClick={onNavClick}>
          Dashboard
        </NavLink>
        <NavLink to="/analytics" className={navLinkClass} onClick={onNavClick}>
          Vendus Analytics
        </NavLink>

        <div className="mt-0.5">
          <button
            type="button"
            onClick={() => setDreOpen(!dreExpanded)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
              isDrePath
                ? "bg-slate-100 text-slate-900"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            <span>Mapa de rentabilidade</span>
            <ChevronDown open={dreExpanded} />
          </button>
          {dreExpanded && (
            <div className="mt-0.5 flex flex-col gap-0.5 pl-1">
              {dreNavItems.map(({ to, label }) => (
                <NavLink key={to} to={to} className={navLinkClass} onClick={onNavClick}>
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        <div className="mt-0.5">
          <button
            type="button"
            onClick={() => setStockOpen(!stockExpanded)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
              isStockPath
                ? "bg-slate-100 text-slate-900"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            <span>Gestão de Stock</span>
            <ChevronDown open={stockExpanded} />
          </button>
          {stockExpanded && (
            <div className="mt-0.5 flex flex-col gap-0.5 pl-1">
              {stockNavItems.map(({ to, label }) => (
                <NavLink key={to} to={to} className={navLinkClass} onClick={onNavClick}>
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        <div className="mt-0.5">
          <button
            type="button"
            onClick={() => setHrOpen(!hrExpanded)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
              isHrPath
                ? "bg-slate-100 text-slate-900"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            <span>Recursos Humanos</span>
            <ChevronDown open={hrExpanded} />
          </button>
          {hrExpanded && (
            <div className="mt-0.5 flex flex-col gap-0.5 pl-1">
              {hrNavItems.map(({ to, label }) => (
                <NavLink key={to} to={to} className={navLinkClass} onClick={onNavClick}>
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        <NavLink to="/cash-closings" className={navLinkClass} onClick={onNavClick}>
          Fechos de Caixa
        </NavLink>

        {user?.role === "admin" && (
          <NavLink
            to="/admin/users"
            onClick={onNavClick}
            className={`mt-0.5 block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isAdminPath
                ? "bg-slate-100 text-slate-900"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            Utilizadores
          </NavLink>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 px-3 py-3">
        <p className="truncate text-xs text-slate-500">{user?.email}</p>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="mt-1 w-full rounded-lg px-3 py-1.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800"
        >
          Sair
        </button>
      </div>
    </>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
        <SidebarContent onNavClick={() => {}} />
      </aside>

      {/* Mobile top bar */}
      <div className="fixed top-0 inset-x-0 z-30 flex h-12 items-center gap-3 border-b border-slate-200 bg-white px-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-1 hover:bg-slate-100"
          aria-label="Abrir menu"
        >
          <HamburgerIcon />
        </button>
        <span className="text-base font-semibold text-slate-800">Angry Box Hub</span>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-slate-200 bg-white transition-transform duration-200 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent onNavClick={closeMobile} />
      </aside>
    </>
  );
}
