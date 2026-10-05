import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import type { ShiftRotation } from "../../domain/entities/schedule.ts";
import { MOTION_ROW_HOVER } from "../../../../components/motion/index.ts";

function formatPattern(p: { startTime: string; endTime: string; secondStartTime: string | null; secondEndTime: string | null }): string {
  const first = `${p.startTime}–${p.endTime}`;
  return p.secondStartTime && p.secondEndTime ? `${first} + ${p.secondStartTime}–${p.secondEndTime}` : first;
}

/**
 * Rotações A/B antigas (RH-03). Deixaram de ser usadas assim (2026-10-06 —
 * substituídas pelas Automatizações): já não se criam rotações novas; as
 * que existem podem ser pré-visualizadas, aplicadas, pausadas ou
 * **apagadas**. Apagar remove só a regra — os turnos já criados ficam na
 * escala. Sem rotações, o painel não aparece.
 */
export function ShiftRotationsPanel() {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<string | null>(null);

  const { data: rotations = [] } = useQuery({
    queryKey: ["hr-shift-rotations"],
    queryFn: () => api.listShiftRotations(),
  });

  const { data: preview = [] } = useQuery({
    queryKey: ["hr-shift-rotation-preview", previewingId],
    queryFn: () => api.previewShiftRotation(previewingId!, 2),
    enabled: !!previewingId,
  });

  const applyMutation = useMutation({
    mutationFn: (id: string) => api.applyShiftRotation(id),
    onSuccess: (result) => {
      setApplyResult(`${result.created.length} turno(s) criado(s), ${result.updated.length} atualizado(s).`);
      void qc.invalidateQueries({ queryKey: ["hr-work-shifts"] });
    },
  });

  const setActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.setShiftRotationActive(id, active),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["hr-shift-rotations"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteShiftRotation(id),
    onSuccess: (_data, id) => {
      if (previewingId === id) setPreviewingId(null);
      setApplyResult(null);
      void qc.invalidateQueries({ queryKey: ["hr-shift-rotations"] });
    },
  });

  function handleDelete(r: ShiftRotation) {
    if (window.confirm(`Apagar a rotação ${r.participantNames.join(" / ")}? Os turnos já criados por ela ficam na escala.`)) {
      deleteMutation.mutate(r.id);
    }
  }

  if (rotations.length === 0) return null;

  return (
    <section className="space-y-3 rounded-xl border border-[#F5C992]/40 bg-white p-4 shadow-sm" aria-label="Rotações antigas">
      <div>
        <h2 className="text-base font-semibold text-stone-900">Rotações antigas (A/B)</h2>
        <p className="text-xs text-stone-500">Já não se criam rotações novas — use as Automatizações. Pode apagar as que existem; os turnos já criados ficam na escala.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#F5C992]/40">
        <table className="min-w-full text-sm">
          <thead className="border-b border-[#F5C992]/40 bg-stone-50/60">
            <tr>
              {["Colaboradores", "Turno A", "Turno B", "Início", "Estado", ""].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F5C992]/30">
            {rotations.map((r: ShiftRotation) => (
              <tr key={r.id} className={MOTION_ROW_HOVER}>
                <td className="px-3 py-2">{r.participantNames.join(" / ")}</td>
                <td className="px-3 py-2 text-stone-500">{formatPattern(r.patternA)}</td>
                <td className="px-3 py-2 text-stone-500">{formatPattern(r.patternB)}</td>
                <td className="px-3 py-2 text-stone-500">{r.anchorDate}</td>
                <td className="px-3 py-2">{r.active ? "Ativa" : "Pausada"}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-3 text-xs font-medium">
                    <button onClick={() => setPreviewingId(r.id)} className="text-stone-500 hover:underline">
                      Pré-visualizar
                    </button>
                    <button
                      onClick={() => applyMutation.mutate(r.id)}
                      disabled={applyMutation.isPending || !r.active}
                      className="text-[#ED5C32] hover:underline disabled:opacity-40"
                    >
                      Aplicar
                    </button>
                    <button onClick={() => setActiveMutation.mutate({ id: r.id, active: !r.active })} className="text-stone-500 hover:underline">
                      {r.active ? "Pausar" : "Retomar"}
                    </button>
                    <button
                      onClick={() => handleDelete(r)}
                      disabled={deleteMutation.isPending}
                      aria-label={`Apagar rotação ${r.participantNames.join(" / ")}`}
                      className="text-red-600 hover:underline disabled:opacity-40"
                    >
                      Apagar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteMutation.isError && <p className="text-sm text-red-600">Não foi possível apagar a rotação.</p>}
      {applyResult && <p className="text-sm text-emerald-700">{applyResult}</p>}

      {previewingId && preview.length > 0 && (
        <div className="rounded-xl border border-[#F5C992]/40 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-800">Pré-visualização (2 semanas)</h3>
            <button onClick={() => setPreviewingId(null)} className="text-xs text-stone-400 hover:text-stone-600">
              Fechar
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {preview.map((week, i) => (
              <div key={week.weekStartDate} className="rounded-lg border border-stone-100 p-3 text-sm">
                <p className="mb-2 font-semibold text-stone-700">
                  Semana {i + 1} — {week.weekStartDate}
                </p>
                <p className="text-stone-600">
                  Turno A: {week.patternAEmployeeName} <span className="text-stone-400">· {formatPattern(week.patternA)}</span>
                </p>
                <p className="text-stone-600">
                  Turno B: {week.patternBEmployeeName} <span className="text-stone-400">· {formatPattern(week.patternB)}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
