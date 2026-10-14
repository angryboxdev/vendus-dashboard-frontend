import { useQuery } from "@tanstack/react-query";
import { useNovoRh } from "../../novo-rh.module.tsx";

export const NOTIFICATIONS_KEY = ["novo-rh", "notifications"] as const;

/** Contador de notificações por ler (partilhado pelo sino da barra e pelo botão de notificações). */
export function useUnreadNotifications(): number {
  const { notifications } = useNovoRh();
  return useQuery({ queryKey: [...NOTIFICATIONS_KEY, "count"], queryFn: () => notifications.unreadCount(), refetchInterval: 60_000 }).data ?? 0;
}
