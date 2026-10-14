import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Drawer, IconBell } from "../../../../../components/ui/index.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { RequestsBody } from "../dashboard/Widgets.tsx";

/**
 * Caixa de pedidos na navegação (🔔): contador só com pendentes e gaveta com os
 * pedidos agregados das fontes atuais. As ações são as mesmas da Caixa de
 * pedidos (o servidor revalida); a página completa continua em /hr/novo/pedidos.
 */
export function InboxButton({ active = false }: { active?: boolean }) {
  const { t } = useI18n();
  const { inbox } = useNovoRh();
  const [open, setOpen] = useState(false);
  // Mesma chave do widget Solicitações: um só pedido partilhado.
  const q = useQuery({ queryKey: ["novo-rh", "inbox", "dashboard"], queryFn: () => inbox.list({ type: null, segment: "mine" }), staleTime: 30_000, refetchInterval: 60_000 });
  const pending = (q.data?.items ?? []).filter((r) => r.canDecide).length;
  const label = t("novoRh.inboxButton");
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={pending ? `${label} — ${pending}` : label}
        aria-current={active ? "page" : undefined}
        className={`relative inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium transition-colors ${active ? "bg-brand-50 text-brand-600" : "text-ink-secondary hover:bg-surface-soft hover:text-ink"}`}
      >
        <IconBell size={18} />
        <span className="hidden sm:inline">{label}</span>
        {pending > 0 && <span className="rounded-full bg-[#ED5C32] px-1.5 text-xs font-semibold leading-5 text-white">{pending}</span>}
      </button>
      <Drawer
        open={open}
        title={label}
        description={pending ? `${pending} por decidir` : undefined}
        onClose={() => setOpen(false)}
        footer={
          <Link to="/hr/novo/pedidos" onClick={() => setOpen(false)} className="inline-flex h-10 items-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-500">
            {t("novoRh.inboxOpenAll")}
          </Link>
        }
      >
        {open && <RequestsBody editing={false} limit={30} />}
      </Drawer>
    </>
  );
}
