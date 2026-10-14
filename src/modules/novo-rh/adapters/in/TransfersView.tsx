import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../i18n/i18n.ts";
import { Button, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR, type StatusTone } from "../../../../components/ui/index.ts";
import { pollInterval, transferState, type TransferState } from "../../domain/services/transfers.service.ts";
import { useNovoRh } from "../../novo-rh.module.tsx";
import { ErrorPanel } from "./common/ErrorPanel.tsx";
import { downloadBlob } from "./download.ts";

const KEY = ["novo-rh", "periods", "exports"];
const TONE: Record<TransferState, StatusTone> = { queued: "neutral", running: "neutral", ready: "success", failed: "danger", expired: "warning" };
const when = (iso: string) => iso.slice(0, 16).replace("T", " ");

/**
 * FE-005: centro de transferências — as minhas exportações, o estado de cada
 * uma, descarregar (link temporário pedido a cada clique, nunca guardado) e
 * executar de novo as expiradas ou com erro.
 */
export function TransfersView() {
  const { t } = useI18n();
  const { periods } = useNovoRh();
  const qc = useQueryClient();
  const attempts = useRef(0);
  const q = useQuery({
    queryKey: KEY,
    queryFn: () => periods.exports(),
    refetchInterval: (query) => {
      const next = pollInterval(query.state.data, attempts.current);
      attempts.current = next === false ? 0 : attempts.current + 1;
      return next;
    },
  });
  const dl = useMutation({
    mutationFn: async (id: string) => {
      const job = q.data!.find((j) => j.id === id)!;
      const f = await periods.download(job);
      downloadBlob(f.blob, f.fileName);
    },
  });
  const rerun = useMutation({
    mutationFn: async (id: string) => {
      const job = q.data!.find((j) => j.id === id)!;
      return periods.requestExport(job.periodId, job.kind, job.includeSensitive);
    },
    onSuccess: async () => {
      attempts.current = 0;
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const now = new Date();
  return (
    <section className={`${SURFACE} space-y-3 p-4`} aria-label={t("transfers.title")}>
      <p className="text-xs text-stone-500">{t("per.exports.hint")}</p>
      {q.isError && <ErrorPanel error={q.error} route="/hr/novo/pessoas/transferencias" onRetry={() => void q.refetch()} />}
      {q.data?.length === 0 && <p className="text-sm text-stone-500">{t("per.exports.none")}</p>}
      {(q.data?.length ?? 0) > 0 && (
        <div className="overflow-auto">
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>{t("transfers.col.kind")}</th>
                <th className={TH}>{t("transfers.col.requested")}</th>
                <th className={TH}>{t("transfers.col.state")}</th>
                <th className={TH}>{t("transfers.col.expires")}</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {q.data!.map((j) => {
                const state = transferState(j, now);
                return (
                  <tr key={j.id} className={TR}>
                    <td className={TD}>
                      {t(`per.export.kind.${j.kind}` as MessageKey)}
                      {j.includeSensitive && <span className="ml-1 text-xs text-stone-400">({t("transfers.sensitive")})</span>}
                    </td>
                    <td className={TD}>{when(j.createdAt)}</td>
                    <td className={TD}>
                      <StatusBadge tone={TONE[state]}>{t(`transfers.state.${state}` as MessageKey)}</StatusBadge>
                      {state === "failed" && j.error && <span className="block text-xs text-red-700">{j.error}</span>}
                    </td>
                    <td className={TD}>{j.expiresAt ? when(j.expiresAt) : "—"}</td>
                    <td className={TD}>
                      {state === "ready" && (
                        <Button size="sm" disabled={dl.isPending} onClick={() => dl.mutate(j.id)}>
                          {t("per.export.download")}
                        </Button>
                      )}
                      {(state === "expired" || state === "failed") && (
                        <Button size="sm" disabled={rerun.isPending} onClick={() => rerun.mutate(j.id)}>
                          {t("transfers.rerun")}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {(dl.isError || rerun.isError) && <ErrorPanel error={dl.error ?? rerun.error} route="/hr/novo/pessoas/transferencias" />}
    </section>
  );
}
