import { Link, useLocation } from "react-router-dom";

const LINKS: { path: string; label: string }[] = [
  { path: "/stock/planeamento", label: "Itens" },
  { path: "/stock/planeamento/alertas", label: "Alertas" },
  { path: "/stock/planeamento/lista-compras", label: "Lista de compras" },
  { path: "/stock/planeamento/historico", label: "Histórico de previsões" },
];

/**
 * Breadcrumb + navegação entre as 4 páginas do módulo "Planeamento de
 * stock". A sidebar só tem uma entrada ("Planeamento") — esta barra é como
 * se navega entre Itens/Alertas/Lista de compras/Histórico, espelhando o
 * breadcrumb "Stock > Planeamento > …" dos mockups.
 */
export function PlanningSubNav({ current }: { current: string }) {
  const location = useLocation();

  return (
    <div className="border-b border-stone-200 bg-white px-6 pt-4">
      <nav className="mb-3 flex items-center gap-1.5 text-sm text-stone-400">
        <span>Stock</span>
        <span>/</span>
        <span className="font-medium text-stone-700">Planeamento</span>
        {current && (
          <>
            <span>/</span>
            <span className="font-medium text-stone-700">{current}</span>
          </>
        )}
      </nav>
      <div className="flex gap-1 overflow-x-auto pb-3">
        {LINKS.map((l) => {
          const active = l.path === "/stock/planeamento" ? location.pathname === l.path : location.pathname.startsWith(l.path);
          return (
            <Link
              key={l.path}
              to={l.path}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? "bg-[#ED5C32] text-white" : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
