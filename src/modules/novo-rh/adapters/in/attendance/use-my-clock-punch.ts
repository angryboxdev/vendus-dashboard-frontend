import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../../../../lib/api.ts";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { SegmentType } from "../../../domain/entities/attendance.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/**
 * Picar com fila offline (RE-9): cada toque entra na fila com o seu
 * `clientEventId` e é reenviado com a mesma chave até o servidor responder.
 * Partilhado pelo painel "O meu ponto" e pelo widget do cabeçalho (FE-003).
 */
export function useMyClockPunch() {
  const { t } = useI18n();
  const { myClock, punchQueue } = useNovoRh();
  const qc = useQueryClient();
  const [pending, setPending] = useState(() => punchQueue.pending().length);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const flush = useCallback(async () => {
    const r = await punchQueue.flush(
      async (p) => {
        await myClock.punch({ segmentType: p.segmentType, clientEventId: p.clientEventId, occurredAt: p.createdAt, breakTypeId: p.breakTypeId ?? null, clockTypeId: p.clockTypeId ?? null });
      },
      (e) => !(e instanceof ApiError),
    );
    setPending(punchQueue.pending().length);
    if (r.refused.length) setError(t("att.queue.refused", { message: message(r.refused[0]!.error, t("common.error")) }));
    if (r.sent || r.refused.length) await qc.invalidateQueries({ queryKey: ["novo-rh", "my-clock"] });
  }, [myClock, punchQueue, qc, t]);

  useEffect(() => {
    void flush();
    const online = () => void flush();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [flush]);

  const punch = async (segmentType: SegmentType, breakTypeId: string | null = null, clockTypeId: string | null = null) => {
    setError(null);
    setBusy(true);
    punchQueue.add(segmentType, new Date().toISOString(), breakTypeId, clockTypeId);
    setPending(punchQueue.pending().length);
    try {
      await flush();
    } finally {
      setBusy(false);
    }
  };

  return { punch, pending, error, busy };
}
