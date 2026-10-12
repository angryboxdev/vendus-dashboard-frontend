import type { MessageKey } from "../../../../../i18n/i18n.ts";
import type { StatusTone } from "../../../../../components/ui/index.ts";
import type { PersonStatus } from "../../../domain/entities/overview.ts";

/** Etiqueta e cor de cada estado do painel. */
export const STATUS: Record<PersonStatus, { tone: StatusTone; key: MessageKey }> = {
  working: { tone: "success", key: "ovw.status.working" },
  remote: { tone: "success", key: "ovw.status.remote" },
  break: { tone: "warning", key: "ovw.status.break" },
  finished: { tone: "neutral", key: "ovw.status.finished" },
  absent: { tone: "neutral", key: "ovw.status.absent" },
  missing: { tone: "danger", key: "ovw.status.missing" },
  not_started: { tone: "neutral", key: "ovw.status.not_started" },
  day_off: { tone: "neutral", key: "ovw.status.day_off" },
};
