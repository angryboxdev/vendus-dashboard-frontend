import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../i18n/i18n.ts";
import { Button, SECTION_TITLE, SURFACE, Tabs } from "../../../../components/ui/index.ts";
import type { AppNotification } from "../../domain/entities/governance.ts";
import type { InboxType } from "../../domain/entities/inbox.ts";
import { safeInternalLink } from "../../domain/services/errors.service.ts";
import { useNovoRh } from "../../novo-rh.module.tsx";
import { ErrorPanel } from "./common/ErrorPanel.tsx";

const KEY = ["novo-rh", "notifications"];

/**
 * FE-004: centro de notificações. Os pendentes (pedidos por decidir) são um
 * bloco à parte: não mudam ao marcar notificações como lidas.
 */
export function NotificationsView() {
  const { t } = useI18n();
  const { notifications } = useNovoRh();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const list = useQuery({
    queryKey: [...KEY, "page", tab],
    queryFn: () => notifications.list({ unreadOnly: tab === "unread", limit: 100 }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });
  const read = useMutation({ mutationFn: (id: string) => notifications.markRead(id), onSuccess: refresh });
  const readAll = useMutation({ mutationFn: () => notifications.markAllRead(), onSuccess: refresh });
  const open = (n: AppNotification) => {
    if (!n.readAt) read.mutate(n.id);
    const to = safeInternalLink(n.link);
    if (to) navigate(to);
  };
  const items = list.data ?? [];
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className={`${SURFACE} space-y-3 p-4`} aria-label={t("notifications.title")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { key: "unread", label: t("notifications.tab.unread") },
              { key: "all", label: t("notifications.tab.all") },
            ]}
          />
          {items.some((n) => !n.readAt) && (
            <Button size="sm" disabled={readAll.isPending} onClick={() => readAll.mutate()}>
              {t("notifications.markAll")}
            </Button>
          )}
        </div>
        {list.isError && <ErrorPanel error={list.error} route="/hr/novo/notificacoes" onRetry={() => void list.refetch()} />}
        {list.data && items.length === 0 && <p className="text-sm text-stone-500">{tab === "unread" ? t("notifications.emptyUnread") : t("notifications.empty")}</p>}
        <ul className="divide-y divide-stone-100">
          {items.map((n) => (
            <li key={n.id} className={`py-2 ${n.readAt ? "text-stone-500" : "text-stone-800"}`}>
              <button type="button" onClick={() => open(n)} className="w-full text-left">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-[#ED5C32]" aria-label={t("notifications.new")} />}
                  {n.title}
                </span>
                {n.body && <span className="block text-xs">{n.body}</span>}
                <span className="block text-[11px] text-stone-400">{new Date(n.createdAt).toLocaleString("pt-PT")}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <PendingSummary />
    </div>
  );
}

const TYPES: InboxType[] = ["leave", "clock", "overtime", "swap", "custom"];

/** Pedidos por decidir (da caixa de pedidos), independentes das notificações lidas. */
function PendingSummary() {
  const { t } = useI18n();
  const { inbox } = useNovoRh();
  const q = useQuery({ queryKey: ["novo-rh", "inbox", "summary"], queryFn: () => inbox.list({ type: null, segment: "mine" }), refetchInterval: 60_000 });
  if (q.isError) return null;
  const counters = q.data?.counters ?? {};
  const rows = TYPES.filter((ty) => q.data?.types.includes(ty)).map((ty) => ({ ty, n: counters[ty]?.mine ?? 0 }));
  return (
    <section className={`${SURFACE} space-y-2 p-4`} aria-label={t("notifications.pending")}>
      <h3 className={SECTION_TITLE}>{t("notifications.pending")}</h3>
      {q.data && rows.every((r) => r.n === 0) && <p className="text-sm text-stone-500">{t("notifications.pendingNone")}</p>}
      <ul className="divide-y divide-stone-100">
        {rows
          .filter((r) => r.n > 0)
          .map((r) => (
            <li key={r.ty}>
              <Link to="/hr/novo/pedidos" className="flex items-center justify-between py-2 text-sm text-stone-700 hover:text-[#C2410C]">
                <span>{t(`inbox.type.${r.ty}` as MessageKey)}</span>
                <span className="rounded-full bg-[#ED5C32] px-2 py-0.5 text-xs font-semibold text-white">{r.n}</span>
              </Link>
            </li>
          ))}
      </ul>
    </section>
  );
}
