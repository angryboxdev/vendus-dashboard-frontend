import { NavLink, useLocation } from "react-router-dom";

import { useState } from "react";

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
  { to: "/hr/relatorio", label: "Relatório de assiduidade" },
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

export function Sidebar() {
  const location = useLocation();
  const isDrePath = location.pathname.startsWith("/dre");
  const isStockPath = location.pathname.startsWith("/stock");
  const isHrPath = location.pathname.startsWith("/hr");
  const [dreOpen, setDreOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [hrOpen, setHrOpen] = useState(false);
  const dreExpanded = isDrePath || dreOpen;
  const stockExpanded = isStockPath || stockOpen;
  const hrExpanded = isHrPath || hrOpen;

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="p-4">
        <h1 className="text-lg font-semibold text-slate-800">Angry Box Hub</h1>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 pb-4">
        <NavLink to="/" end className={navLinkClass}>
          Dashboard
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
                <NavLink key={to} to={to} className={navLinkClass}>
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
                <NavLink key={to} to={to} className={navLinkClass}>
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
                <NavLink key={to} to={to} className={navLinkClass}>
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
