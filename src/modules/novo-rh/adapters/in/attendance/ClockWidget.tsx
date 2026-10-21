import { useQuery } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { Button, StatusBadge } from "../../../../../components/ui/index.ts";
import { formatDuration, nextActions, timeIn } from "../../../domain/services/attendance.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { useMyClockPunch } from "./use-my-clock-punch.ts";

/**
 * FE-003: o meu ponto no cabeçalho — estado e total de hoje vindos do
 * servidor (nunca somados aqui) e a ação seguinte com um toque. Sem ficha
 * ligada (ou sem permissão), não aparece.
 */
export function ClockWidget() {
  const { t } = useI18n();
  const { myClock } = useNovoRh();
  const status = useQuery({ queryKey: ["novo-rh", "my-clock"], queryFn: () => myClock.status(), retry: false, refetchInterval: 60_000, refetchOnWindowFocus: true });
  const { punch, pending, error, busy } = useMyClockPunch();
  if (!status.data) return null;
  const s = status.data;
  const next = nextActions(s.state)[0];
  const since = s.since && s.state !== "off" ? timeIn(s.since, s.timeZone) : null;
  return (
    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap" role="group" aria-label={t("att.widget.label")}>
      <StatusBadge tone={s.state === "off" ? "neutral" : "success"}>{t(`att.segment.${s.state}` as MessageKey)}</StatusBadge>
      <span className="hidden text-xs text-ink-secondary lg:inline">
        {since && `${t("att.since", { time: since })} · `}
        {t("att.widget.today", { worked: formatDuration(s.today.workedSeconds) })}
      </span>
      {next && (
        <Button size="sm" variant="primary" disabled={busy} onClick={() => void punch(next)}>
          {busy || pending > 0 ? t("att.widget.confirming") : t(`att.action.${next}` as MessageKey)}
        </Button>
      )}
      {error && (
        <span role="alert" className="max-w-48 truncate text-xs text-red-700" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
