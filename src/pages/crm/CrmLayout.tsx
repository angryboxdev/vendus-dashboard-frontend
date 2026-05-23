import { NavLink, Outlet } from "react-router-dom";

const navItems: { to: string; label: string; end?: boolean }[] = [
  { to: "/crm", label: "Dashboard", end: true },
  { to: "/crm/customers", label: "Clientes" },
  { to: "/crm/parameters", label: "Parâmetros" },
];

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
    isActive
      ? "border-slate-900 text-slate-900"
      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
  }`;

export function CrmLayout() {
  return (
    <div className="min-h-full bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 pt-4">
          <h1 className="text-2xl font-semibold text-slate-900">CRM</h1>
          <nav className="mt-3 flex gap-1">
            {navItems.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={tabClass}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
