import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStockPlanningModule } from "../../stock-planning.module.tsx";
import { formatIsoDatePt } from "../../../../lib/format.ts";
import { FORECAST_FEEDBACK_REASON_OPTIONS, type ForecastDeviationRowDTO } from "../../domain/entities/stock-planning.ts";

const COMMENT_MAX = 300;

function fmtQty(n: number): string {
  return n.toLocaleString("pt-PT", { maximumFractionDigits: 1 });
}

/**
 * Drawer "Ontem as vendas foram diferentes do esperado" (screenshot 1,
 * segunda imagem). Sem endpoint de "principais produtos com maior
 * variação" nem de curva intradiária — o backend só devolve o agregado do
 * dia (`ForecastDeviationRowDTO`), por isso este drawer mostra só o que é
 * suportado: cartões previsto/realizado/desvio, grelha de motivos e
 * comentário. Ver README do módulo.
 */
export function ForecastFeedbackDrawer({
  deviation,
  locationLabel,
  onClose,
}: {
  deviation: ForecastDeviationRowDTO;
  locationLabel?: string;
  onClose: () => void;
}) {
  const { api } = useStockPlanningModule();
  const qc = useQueryClient();
  const [reasonCode, setReasonCode] = useState<string | null>(deviation.reasonCode);
  const [comment, setComment] = useState("");

  const submitMutation = useMutation({
    mutationFn: () => api.submitForecastFeedback(deviation.feedbackId, { reasonCode: reasonCode!, comment: comment.trim() || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["stock-planning-history"] });
      onClose();
    },
  });

  const deviationAbove = deviation.actualValue > deviation.forecastValue;
  const deviationBadgeCls = deviation.deviationPercent == null
    ? "bg-stone-100 text-stone-500"
    : deviationAbove
      ? "bg-sky-50 text-sky-700"
      : "bg-red-50 text-red-600";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-stone-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Ontem as vendas foram diferentes do esperado</h2>
            <p className="mt-0.5 text-xs text-stone-500">{formatIsoDatePt(deviation.periodDate)}{locationLabel ? ` · ${locationLabel}` : ""}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-stone-200 bg-white p-3">
              <p className="text-xs text-stone-500">Previsto</p>
              <p className="mt-0.5 text-lg font-bold text-stone-800">{fmtQty(deviation.forecastValue)}</p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-3">
              <p className="text-xs text-stone-500">Realizado</p>
              <p className="mt-0.5 text-lg font-bold text-stone-800">{fmtQty(deviation.actualValue)}</p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-3">
              <p className="text-xs text-stone-500">Desvio</p>
              <p className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-sm font-bold ${deviationBadgeCls}`}>
                {deviation.deviationPercent != null ? `${deviationAbove ? "+" : ""}${(deviation.deviationPercent * 100).toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%` : "—"}
              </p>
            </div>
          </div>

          {deviation.hasFeedback ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-700">Feedback já registado</p>
              <p className="mt-1 text-sm text-stone-600">
                Motivo: {FORECAST_FEEDBACK_REASON_OPTIONS.find((o) => o.value === deviation.reasonCode)?.label ?? deviation.reasonCode ?? "—"}
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className="mb-2 text-sm font-medium text-stone-700">Porque achas que isto aconteceu?</p>
                <div className="grid grid-cols-2 gap-2">
                  {FORECAST_FEEDBACK_REASON_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                        reasonCode === opt.value ? "border-[#ED5C32] bg-[#ED5C32]/10 text-[#ED5C32]" : "border-stone-200 text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="reasonCode"
                        className="accent-[#ED5C32]"
                        checked={reasonCode === opt.value}
                        onChange={() => setReasonCode(opt.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-stone-500">Comentário (opcional)</label>
                  <span className="text-[10px] text-stone-400">{comment.length}/{COMMENT_MAX}</span>
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
                  rows={3}
                  className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-[#ED5C32]"
                  placeholder="Detalhes adicionais…"
                />
              </div>

              <div className="rounded-md border border-stone-200 bg-stone-50 p-3 text-xs text-stone-500">
                Esta resposta será utilizada para melhorar previsões futuras — não altera automaticamente o stock nem cria compras.
              </div>

              {submitMutation.isError && (
                <p className="text-xs text-red-600">{submitMutation.error instanceof Error ? submitMutation.error.message : "Erro ao enviar feedback."}</p>
              )}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50">
                  Ignorar
                </button>
                <button
                  type="button"
                  disabled={!reasonCode || submitMutation.isPending}
                  onClick={() => submitMutation.mutate()}
                  className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {submitMutation.isPending ? "A enviar…" : "Enviar feedback"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
