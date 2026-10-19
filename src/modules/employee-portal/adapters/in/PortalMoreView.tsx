import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useEmployeePortalModule } from "../../employee-portal.module.tsx";

const CARD = "rounded-2xl border border-[#F5C992]/50 bg-white shadow-sm";

const ITEMS = [
  { to: "/portal/comunicados", label: "Comunicados e documentos", hint: "O que a empresa lhe enviou" },
  { to: "/portal/tarefas", label: "Tarefas", hint: "Listas de verificação a cumprir" },
  { to: "/portal/solicitacoes", label: "Solicitações", hint: "Pedidos à empresa (fardamento, declarações…)" },
  { to: "/portal/equipa", label: "Quem está", hint: "Quem está a trabalhar agora" },
  { to: "/portal/perfil", label: "Perfil", hint: "Conta e palavra-passe" },
];

/** "Mais": as secções do Portal que não cabem na barra de baixo (onda 6). */
export function PortalMoreView() {
  const { engagement } = useEmployeePortalModule();
  const pending = useQuery({ queryKey: ["portal-pending"], queryFn: () => engagement.pendingCount(), retry: false });
  const visibility = useQuery({ queryKey: ["portal-visibility"], queryFn: () => engagement.visibility(), retry: false });
  // FE-116: secção desligada pela empresa não aparece (a API recusa-a na mesma).
  const items = ITEMS.filter((i) => i.to !== "/portal/equipa" || visibility.data?.whosIn !== false);
  return (
    <nav aria-label="Mais" className={`${CARD} divide-y divide-stone-100`}>
      {items.map((i) => (
        <Link key={i.to} to={i.to} className="flex items-center justify-between gap-3 px-4 py-3">
          <span>
            <span className="block text-sm font-medium text-stone-900">{i.label}</span>
            <span className="block text-xs text-stone-500">{i.hint}</span>
          </span>
          {i.to === "/portal/comunicados" && (pending.data ?? 0) > 0 && (
            <span className="rounded-full bg-[#ED5C32] px-2 py-0.5 text-xs font-semibold text-white" aria-label={`${pending.data} por tratar`}>
              {pending.data}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
