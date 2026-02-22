import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Vendus Analytics" },
  { to: "/dre", label: "DRE" },
] as const;

export function Sidebar() {
  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="p-4">
        <h1 className="text-lg font-semibold text-slate-800">Angry Box Hub</h1>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 pb-4">
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
