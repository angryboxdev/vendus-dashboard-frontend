import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useI18n } from "../../../../i18n/I18nProvider.tsx";
import { Button, IconBell } from "../../../../components/ui/index.ts";
import { useNovoRh } from "../../novo-rh.module.tsx";

/** As minhas notificações (Novo RH, ticket 10) — botão com contador e lista. */
export function NotificationsBell() {
  const { t } = useI18n();
  const { notifications } = useNovoRh();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const count = useQuery({ queryKey: ["novo-rh", "notifications", "count"], queryFn: () => notifications.unreadCount(), refetchInterval: 60_000 });
  const list = useQuery({ queryKey: ["novo-rh", "notifications", "list"], queryFn: () => notifications.list(), enabled: open });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["novo-rh", "notifications"] });
  const read = useMutation({ mutationFn: (id: string) => notifications.markRead(id), onSuccess: refresh });
  const readAll = useMutation({ mutationFn: () => notifications.markAllRead(), onSuccess: refresh });
  const unread = count.data ?? 0;

  return (
    <div className="relative">
      <Button
        size="sm"
        icon={<IconBell />}
        aria-expanded={open}
        aria-label={`${t("notifications.title")}${unread ? ` — ${t("notifications.unread", { count: unread })}` : ""}`}
        onClick={() => setOpen(!open)}
      >
        {unread > 0 ? <span className="rounded-full bg-[#ED5C32] px-1.5 text-xs font-semibold text-white">{unread}</span> : null}
      </Button>
      {open && (
        <div role="dialog" aria-label={t("notifications.title")} className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-[#F5C992]/40 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-stone-900">{t("notifications.title")}</p>
            {unread > 0 && (
              <button type="button" className="text-xs text-[#C2410C] hover:underline" onClick={() => readAll.mutate()}>
                {t("notifications.markAll")}
              </button>
            )}
          </div>
          {(list.data ?? []).length === 0 ? (
            <p className="text-sm text-stone-500">{t("notifications.empty")}</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-auto">
              {list.data!.map((n) => (
                <li key={n.id} className={`rounded-lg p-2 text-sm ${n.readAt ? "text-stone-500" : "bg-[#FDF8F5] text-stone-800"}`}>
                  {n.link ? (
                    <Link to={n.link} className="font-medium hover:underline" onClick={() => (!n.readAt && read.mutate(n.id), setOpen(false))}>
                      {n.title}
                    </Link>
                  ) : (
                    <button type="button" className="text-left font-medium" onClick={() => !n.readAt && read.mutate(n.id)}>
                      {n.title}
                    </button>
                  )}
                  {n.body && <p className="text-xs">{n.body}</p>}
                  <p className="text-[11px] text-stone-400">{new Date(n.createdAt).toLocaleString("pt-PT")}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
