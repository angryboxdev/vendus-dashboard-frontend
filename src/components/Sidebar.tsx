import { NavLink, useLocation } from "react-router-dom";

import { useState } from "react";

const dreNavItems = [
  { to: "/dre/demonstrativo", label: "Demonstrativo" },
  { to: "/dre/receita-bruta", label: "Receitas" },
  { to: "/dre/custos-fixos", label: "Custos Fixos" },
  { to: "/dre/custos-variaveis", label: "Custos Variáveis" },
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
  const [dreOpen, setDreOpen] = useState(false);
  const dreExpanded = isDrePath || dreOpen;

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
            <span>DRE</span>
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
      </nav>
    </aside>
  );
}
