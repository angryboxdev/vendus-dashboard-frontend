import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AppIcon, FOCUS_RING, type AppIconKey } from "../../../../components/ui";
import { useEmployeePortalModule } from "../../employee-portal.module.tsx";

const ITEMS: { to: string; label: string; hint: string; icon: AppIconKey }[] = [
  { to: "/portal/comunicados", label: "Comunicados e documentos", hint: "O que a empresa lhe enviou", icon: "news" },
  { to: "/portal/tarefas", label: "Tarefas", hint: "Listas de verificação a cumprir", icon: "tasks" },
  { to: "/portal/solicitacoes", label: "Solicitações", hint: "Pedidos à empresa (fardamento, declarações…)", icon: "customRequests" },
  { to: "/portal/equipa", label: "Quem está", hint: "Quem está a trabalhar agora", icon: "people" },
  { to: "/portal/perfil", label: "Perfil", hint: "Conta e palavra-passe", icon: "profile" },
];

/** "Mais": as secções do Portal que não cabem na barra de baixo (onda 6). */
export function PortalMoreView() {
  const { engagement } = useEmployeePortalModule();
  const pending = useQuery({ queryKey: ["portal-pending"], queryFn: () => engagement.pendingCount(), retry: false });
  const visibility = useQuery({ queryKey: ["portal-visibility"], queryFn: () => engagement.visibility(), retry: false });
  // FE-116: secção desligada pela empresa não aparece (a API recusa-a na mesma).
  const items = ITEMS.filter((i) => i.to !== "/portal/equipa" || visibility.data?.whosIn !== false);
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-navy-900">Mais</h1>
      <nav aria-label="Mais" className="divide-y divide-line-subtle overflow-hidden rounded-2.5xl border border-line bg-surface-card shadow-card lg:max-w-2xl">
        {items.map((i) => (
          <Link key={i.to} to={i.to} className={`flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-soft ${FOCUS_RING}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <AppIcon name={i.icon} size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-navy-900">{i.label}</span>
              <span className="block text-xs text-ink-secondary">{i.hint}</span>
            </span>
            {i.to === "/portal/comunicados" && (pending.data ?? 0) > 0 && (
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white" aria-label={`${pending.data} por tratar`}>
                {pending.data}
              </span>
            )}
            <AppIcon name="chevronRight" size={18} className="shrink-0 text-ink-muted" />
          </Link>
        ))}
      </nav>
    </div>
  );
}
