import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Drawer, IconBell, Tabs } from "../../../../../components/ui/index.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { NotificationsList } from "../NotificationsBell.tsx";
import { useUnreadNotifications } from "../use-unread-notifications.ts";
import { RequestsBody } from "../dashboard/Widgets.tsx";

/**
 * Sino da barra de topo: pedidos por decidir + as minhas notificações num só
 * sítio (contador = soma). A gaveta tem os pedidos agregados (as mesmas ações
 * da Caixa; o servidor revalida) e as notificações; a Caixa completa continua
 * em /hr/novo/pedidos.
 */
export function InboxButton({ active = false }: { active?: boolean }) {
  const { t } = useI18n();
  const { inbox } = useNovoRh();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"requests" | "notifications">("requests");
  // Mesma chave do widget Solicitações: um só pedido partilhado.
  const q = useQuery({ queryKey: ["novo-rh", "inbox", "dashboard"], queryFn: () => inbox.list({ type: null, segment: "mine" }), staleTime: 30_000, refetchInterval: 60_000 });
  const pending = (q.data?.items ?? []).filter((r) => r.canDecide).length;
  const unread = useUnreadNotifications();
  const total = pending + unread;
  const label = t("novoRh.inboxButton");
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTab(pending || !unread ? "requests" : "notifications");
          setOpen(true);
        }}
        aria-label={total ? `${label} — ${total}` : label}
        title={label}
        aria-current={active ? "page" : undefined}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${active ? "bg-brand-50 text-brand-600" : "text-ink-secondary hover:bg-surface-soft hover:text-ink"}`}
      >
        <IconBell size={18} />
        {total > 0 && <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-[#ED5C32] px-1 text-center text-[11px] font-semibold leading-[18px] text-white">{total > 99 ? "99+" : total}</span>}
      </button>
      <Drawer
        open={open}
        title={label}
        description={pending ? `${pending} por decidir` : undefined}
        onClose={() => setOpen(false)}
        footer={
          tab === "requests" ? (
            <Link to="/hr/novo/pedidos" onClick={() => setOpen(false)} className="inline-flex h-10 items-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-500">
              {t("novoRh.inboxOpenAll")}
            </Link>
          ) : undefined
        }
      >
        <Tabs
          label={label}
          value={tab}
          onChange={(k) => setTab(k as "requests" | "notifications")}
          items={[
            { key: "requests", label: `Pedidos${pending ? ` (${pending})` : ""}` },
            { key: "notifications", label: `Notificações${unread ? ` (${unread})` : ""}` },
          ]}
        />
        {open && tab === "requests" && <RequestsBody editing={false} limit={30} />}
        {open && tab === "notifications" && <NotificationsList onNavigate={() => setOpen(false)} />}
      </Drawer>
    </>
  );
}
