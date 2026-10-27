import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { canOpenPath } from "../../modules/access/domain/services/access-ui.service.ts";
import { AppIcon, type AppIconKey } from "../../components/ui/app-icons.tsx";
import { PageShell, SURFACE } from "../../components/ui/index.ts";

/** Integrações que já existem no Mezza (sem páginas novas): cada linha leva à página real. */
const INTEGRATIONS: { path: string; title: string; description: string; icon: AppIconKey }[] = [
  {
    path: "/configuracoes/integracoes/faturas-por-email",
    title: "Faturas por email",
    description: "Endereço da empresa para os fornecedores enviarem as faturas, que entram para rever.",
    icon: "invite",
  },
  {
    path: "/admin/location-tokens",
    title: "Tokens de dispositivo",
    description: "Acesso dos quiosques, caixas e ecrãs de cozinha de cada local.",
    icon: "deviceTokens",
  },
];

/**
 * Configurações → Integrações (Menu V1): um só destino no menu; as integrações ficam aqui, sem terceiro nível de
 * menus. Cada pessoa só vê as que pode abrir.
 */
export function IntegrationsPage() {
  const { user } = useAuth();
  const access = user?.access;
  const visible = INTEGRATIONS.filter((i) => !access || canOpenPath({ isAdmin: access.isAdmin, portalOnly: access.portalOnly, permissions: { ...access.permissions } }, i.path));
  return (
    <PageShell title="Integrações" description="Ligações do Mezza a serviços e dispositivos externos.">
      <ul className={`${SURFACE} max-w-3xl divide-y divide-line`}>
        {visible.map((i) => (
          <li key={i.path}>
            <Link to={i.path} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ED5C32]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-soft text-navy-900">
                <AppIcon name={i.icon} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-navy-900">{i.title}</span>
                <span className="block text-[13px] text-ink-secondary">{i.description}</span>
              </span>
              <AppIcon name="chevronRight" size={16} className="shrink-0 text-ink-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
