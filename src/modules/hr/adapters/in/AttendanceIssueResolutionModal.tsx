import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import { formatMinutes } from "../../../../lib/format-minutes.ts";
import type { AttendanceCorrectionType, AttendanceIssueDetail } from "../../domain/entities/attendance-conference.ts";
import { ABSENCE_TYPE_LABEL, type AbsenceType, type ConfirmAbsenceResult } from "../../domain/entities/absences.ts";

/**
 * "Resolver ocorrência" (mockup Assiduidade) — painel lateral. "Confirmar
 * ausência" (task 2026-10-08) junta registar e associar: o servidor procura
 * a ausência compatível e vincula-a, ou cria uma; com pedido pendente ou
 * várias possíveis, nunca decide sozinho. Mantém corrigir picagem/turno. As ações antigas (manter, justificar
 * sem impacto, remover marcação) continuam em "Mais opções". A ocorrência
 * fecha sempre por uma correção com motivo (o backend exige-o).
 */
type Path = "confirm_absence" | "fix_punch" | "fix_shift" | "keep_as_is" | "justify_no_impact" | "remove_marking";

const MAIN: Array<{ key: Path; title: string; hint: string }> = [
  { key: "confirm_absence", title: "Confirmar ausência", hint: "Registar ou vincular automaticamente a ausência correspondente." },
  { key: "fix_punch", title: "Corrigir picagem", hint: "Registar ou corrigir a(s) picagem(ns) deste turno." },
  { key: "fix_shift", title: "Corrigir turno", hint: "Ajustar o turno planeado." },
];
const MORE: Array<{ key: Path; title: string; hint: string }> = [
  { key: "keep_as_is", title: "Manter como está", hint: "Conta como atraso/ocorrência nas horas e dias." },
  { key: "justify_no_impact", title: "Justificar (sem impacto)", hint: "Deixa de contar para os KPIs de atraso/ausência." },
  { key: "remove_marking", title: "Remover marcação", hint: "A marcação é apagada — o turno fica sem entrada/saída." },
];

/** Tipo "Falta" divide-se em justificada / injustificada (como no mockup); os outros são tipos de ausência diretos. */
const ABSENCE_KINDS: Array<{ key: "falta" | AbsenceType; label: string }> = [
  { key: "falta", label: "Falta" },
  { key: "sick_leave", label: ABSENCE_TYPE_LABEL.sick_leave },
  { key: "compensatory", label: ABSENCE_TYPE_LABEL.compensatory },
  { key: "authorized_absence", label: ABSENCE_TYPE_LABEL.authorized_absence },
  { key: "license", label: ABSENCE_TYPE_LABEL.license },
  { key: "vacation", label: ABSENCE_TYPE_LABEL.vacation },
  { key: "other", label: ABSENCE_TYPE_LABEL.other },
];

const fmtDay = (ymd: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", weekday: "long", timeZone: "UTC" });
const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#ED5C32] disabled:bg-stone-100";
const labelCls = "w-28 shrink-0 text-sm text-stone-600";

function Option({ title, hint, checked, onSelect }: { title: string; hint: string; checked: boolean; onSelect: () => void }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 ${checked ? "border-[#ED5C32] bg-orange-50/60" : "border-stone-200 hover:bg-stone-50"}`}>
      <input type="radio" name="resolution-path" checked={checked} onChange={onSelect} className="mt-1 accent-[#ED5C32]" />
      <span>
        <span className="block text-sm font-semibold text-stone-900">{title}</span>
        <span className="block text-xs text-stone-500">{hint}</span>
      </span>
    </label>
  );
}

export function AttendanceIssueResolutionModal({ issue, onClose, onCorrected }: { issue: AttendanceIssueDetail; onClose: () => void; onCorrected: () => void }) {
  const { api } = useHrModule();
  const qc = useQueryClient();
  const planned = issue.periods[0];
  const plannedStart = planned?.plannedStart ?? "";
  const plannedEnd = planned?.plannedEnd ?? "";

  const [path, setPath] = useState<Path>("confirm_absence");
  const [showMore, setShowMore] = useState(false);
  // Registar ausência
  const [kind, setKind] = useState<"falta" | AbsenceType>("falta");
  const [justified, setJustified] = useState(true);
  const [absStart, setAbsStart] = useState(plannedStart);
  const [absEnd, setAbsEnd] = useState(plannedEnd);
  // Várias compatíveis: a escolhida
  const [chosenId, setChosenId] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [decisionNote, setDecisionNote] = useState("");
  const [done, setDone] = useState<ConfirmAbsenceResult | null>(null);
  // Corrigir picagem / turno
  const [actualStart, setActualStart] = useState(planned?.actualStart ?? "");
  const [actualEnd, setActualEnd] = useState(planned?.actualEnd ?? "");
  const [shiftStart, setShiftStart] = useState(plannedStart);
  const [shiftEnd, setShiftEnd] = useState(plannedEnd);
  // Comum
  const [reason, setReason] = useState("");

  const ref = { workShiftId: issue.shiftId, attendanceId: issue.attendanceId, employeeId: issue.employeeId, workDate: issue.workDate, locationId: issue.locationId ?? "" };
  const previewKey = ["hr-confirm-absence-preview", issue.employeeId, issue.workDate, issue.shiftId];
  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: previewKey,
    queryFn: () => api.previewConfirmAbsence(ref),
    enabled: path === "confirm_absence" && !done,
    retry: false,
  });
  const decideRequest = useMutation({
    mutationFn: (decision: "approve" | "reject") => api.decidePortalRequest(preview!.pendingRequest!.id, decision, decisionNote || null),
    onSuccess: () => {
      setReviewing(false);
      void qc.invalidateQueries({ queryKey: previewKey });
      void qc.invalidateQueries({ queryKey: ["hr-requests-count"] });
    },
  });

  const absenceType: AbsenceType = kind === "falta" ? (justified ? "justified" : "unjustified") : kind;
  // Turno inteiro (ou noturno) = ausência de dia; horas diferentes do turno = parcial.
  const fullShift = issue.endsNextDay || (absStart === plannedStart && absEnd === plannedEnd);

  const correction = (correctionType: AttendanceCorrectionType, why: string, extra: { actualStartTime?: string | null; actualEndTime?: string | null } = {}) =>
    api.correctShiftAttendance({
      workShiftId: issue.shiftId,
      attendanceId: issue.attendanceId,
      employeeId: issue.employeeId,
      workDate: issue.workDate,
      locationId: issue.locationId ?? "",
      correctionType,
      ...extra,
      reason: why,
    });

  const resolve = useMutation({
    mutationFn: async () => {
      switch (path) {
        case "confirm_absence": {
          const result = await api.confirmAbsence({
            ...ref,
            ...(preview?.match === "multiple" ? { absenceId: chosenId } : {}),
            ...(preview?.match === "none" ? { newAbsence: { type: absenceType, startTime: absStart || null, endTime: absEnd || null, notes: reason || null } } : {}),
          });
          setDone(result);
          return null;
        }
        case "fix_punch":
          return correction("fix_times", reason, { actualStartTime: actualStart || null, actualEndTime: actualEnd || null });
        case "fix_shift":
          await api.updateWorkShift(issue.shiftId!, { startTime: shiftStart, endTime: shiftEnd });
          return null;
        default:
          return correction(path, reason);
      }
    },
    onSuccess: () => {
      for (const key of ["hr-attendance-issues", "hr-attendance-closure", "hr-attendance-summary", "hr-attendance-employee-detail", "hr-absence-board", "hr-work-shifts"]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
      // "Confirmar ausência" mostra primeiro a mensagem (já registada / registada); fecha em "Concluir".
      if (path !== "confirm_absence") onCorrected();
    },
    onError: () => {
      if (path === "confirm_absence") void qc.invalidateQueries({ queryKey: previewKey });
    },
  });

  const reasonRequired = path === "fix_punch" || path === "keep_as_is" || path === "justify_no_impact" || path === "remove_marking";
  const canSubmit =
    !resolve.isPending &&
    (!reasonRequired || reason.trim().length > 0) &&
    (path !== "confirm_absence" ||
      (!!preview &&
        (preview.match === "single" || (preview.match === "multiple" && !!chosenId) || (preview.match === "none" && (fullShift || (absStart && absEnd && absEnd > absStart)))))) &&
    (path !== "fix_shift" || (!!issue.shiftId && shiftStart && shiftEnd && shiftStart !== shiftEnd));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label="Resolver ocorrência">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="text-lg font-semibold text-stone-900">Resolver ocorrência</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-stone-400 hover:text-stone-600">
            ✕
          </button>
        </div>

        {done ? (
          <div className="flex-1 space-y-3 px-6 py-8 text-center">
            <p className="text-4xl text-emerald-600">✓</p>
            <p className="text-lg font-semibold text-stone-900">{done.outcome === "linked" ? "Ausência já registada" : "Ausência registada"}</p>
            <p className="text-sm text-stone-600">
              {done.outcome === "linked"
                ? done.fullDay
                  ? "Existe uma ausência para este dia. A ocorrência foi vinculada automaticamente."
                  : "Existe uma ausência para este período. A ocorrência foi vinculada automaticamente ao registo existente em Férias & Ausências."
                : "Foi criado um registo em Férias & Ausências e vinculado a esta ocorrência."}
            </p>
            <p className="text-xs text-stone-500">
              {ABSENCE_TYPE_LABEL[done.absence.type]} · {done.absence.duration}
            </p>
          </div>
        ) : (
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold text-stone-600">
              {issue.employeeName
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-900">{issue.employeeName}</p>
              <p className="text-xs text-stone-500">{issue.locationName ?? "—"}</p>
            </div>
          </div>

          <div className="rounded-xl bg-orange-50/70 p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-stone-700">{fmtDay(issue.workDate)}</p>
                <p className="font-medium text-stone-900">
                  Turno planeado: {issue.periods.map((p) => `${p.plannedStart ?? "—"} – ${p.plannedEnd ?? "—"}`).join(" | ")}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-red-700">● {issue.occurrenceLabel}</span>
            </div>
            <p className="mt-1 text-xs text-stone-500">
              {issue.periods.some((p) => p.actualStart) ? (
                <>
                  Registado: {issue.periods.map((p) => `${p.actualStart ?? "—"}–${p.actualEnd ?? "—"}`).join(" | ")} ({formatMinutes(issue.diffMinutes)})
                </>
              ) : (
                "Não existe qualquer picagem para este turno."
              )}
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-stone-900">O que aconteceu?</p>
            <div className="space-y-2">
              {MAIN.filter((o) => o.key !== "fix_shift" || issue.shiftId).map((o) => (
                <Option key={o.key} title={o.title} hint={o.hint} checked={path === o.key} onSelect={() => setPath(o.key)} />
              ))}
              <button type="button" onClick={() => setShowMore((s) => !s)} className="text-xs font-medium text-stone-500 hover:underline">
                {showMore ? "Menos opções" : "Mais opções"}
              </button>
              {showMore && MORE.map((o) => <Option key={o.key} title={o.title} hint={o.hint} checked={path === o.key} onSelect={() => setPath(o.key)} />)}
            </div>
          </div>

          {path === "confirm_absence" && (
            <section className="space-y-3 border-t border-stone-100 pt-4" aria-label="Confirmar ausência">
              {previewLoading || !preview ? (
                <p className="text-xs text-stone-500">A procurar ausências registadas…</p>
              ) : preview.match === "single" ? (
                <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                  <p className="font-semibold">Ausência já registada</p>
                  <p>
                    {ABSENCE_TYPE_LABEL[preview.candidates[0]!.type]} · {preview.candidates[0]!.duration}
                    {preview.candidates[0]!.startTime && ` (${preview.candidates[0]!.startTime}–${preview.candidates[0]!.endTime})`}. Ao confirmar, a ocorrência fica vinculada a esse registo — não é
                    criado outro.
                  </p>
                </div>
              ) : preview.match === "multiple" ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-stone-900">Há mais de uma ausência neste período — qual corresponde?</p>
                  {preview.candidates.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm">
                      <input type="radio" name="chosen-absence" checked={chosenId === c.id} onChange={() => setChosenId(c.id)} className="accent-[#ED5C32]" />
                      {ABSENCE_TYPE_LABEL[c.type]} · {c.duration}
                      {c.startTime && ` (${c.startTime}–${c.endTime})`}
                    </label>
                  ))}
                </div>
              ) : preview.match === "pending_request" ? (
                <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">Existe um pedido pendente para este período.</p>
                  <p>
                    {preview.pendingRequest!.kind === "day_off" ? "Pedido de folga" : "Justificação de falta"} · {preview.pendingRequest!.reasonLabel}
                    {preview.pendingRequest!.reasonText && ` — ${preview.pendingRequest!.reasonText}`}
                  </p>
                  {!reviewing ? (
                    <button type="button" onClick={() => setReviewing(true)} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium">
                      Rever pedido
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        aria-label="Nota da decisão"
                        placeholder="Nota (obrigatória para rejeitar)"
                        value={decisionNote}
                        onChange={(e) => setDecisionNote(e.target.value)}
                        rows={2}
                        className={inputCls}
                      />
                      <div className="flex gap-2">
                        <button type="button" disabled={decideRequest.isPending} onClick={() => decideRequest.mutate("approve")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                          Aprovar
                        </button>
                        <button
                          type="button"
                          disabled={decideRequest.isPending || !decisionNote.trim()}
                          onClick={() => decideRequest.mutate("reject")}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50"
                        >
                          Rejeitar
                        </button>
                      </div>
                      {decideRequest.isError && <p className="text-xs text-red-700">{decideRequest.error instanceof Error ? decideRequest.error.message : "Não foi possível decidir."}</p>}
                    </div>
                  )}
                  <p className="text-xs">Depois de aprovado, a ausência criada é vinculada a esta ocorrência.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-stone-900">Não há ausência registada — dados para registar</p>
                  <div className="flex items-center gap-3">
                    <label className={labelCls} htmlFor="res-kind">
                      Tipo
                    </label>
                    <select id="res-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={inputCls}>
                      {ABSENCE_KINDS.map((k) => (
                        <option key={k.key} value={k.key}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {kind === "falta" && (
                    <div className="flex items-center gap-3">
                      <label className={labelCls} htmlFor="res-class">
                        Classificação
                      </label>
                      <select id="res-class" value={justified ? "j" : "i"} onChange={(e) => setJustified(e.target.value === "j")} className={inputCls}>
                        <option value="j">Justificada</option>
                        <option value="i">Injustificada</option>
                      </select>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <span className={labelCls}>Período</span>
                    <span className="text-sm text-stone-700">{issue.workDate.split("-").reverse().join("/")}</span>
                    <input aria-label="Início da ausência" type="time" value={absStart} disabled={issue.endsNextDay} onChange={(e) => setAbsStart(e.target.value)} className={inputCls} />
                    <span className="text-stone-400">→</span>
                    <input aria-label="Fim da ausência" type="time" value={absEnd} disabled={issue.endsNextDay} onChange={(e) => setAbsEnd(e.target.value)} className={inputCls} />
                  </div>
                  <p className="text-xs text-stone-500">Será criado 1 registo em Férias &amp; Ausências ({fullShift ? "dia inteiro" : `${absStart}–${absEnd}`}) e vinculado a esta ocorrência.</p>
                </>
              )}
            </section>
          )}

          {path === "fix_punch" && (
            <section className="space-y-2 border-t border-stone-100 pt-4">
              <p className="text-sm font-semibold text-stone-900">Picagens</p>
              <div className="flex items-center gap-2">
                <input aria-label="Entrada" type="time" value={actualStart} onChange={(e) => setActualStart(e.target.value)} className={inputCls} />
                <span className="text-stone-400">→</span>
                <input aria-label="Saída" type="time" value={actualEnd} onChange={(e) => setActualEnd(e.target.value)} className={inputCls} />
              </div>
              <button
                type="button"
                onClick={() => {
                  setActualStart(plannedStart);
                  setActualEnd(plannedEnd);
                }}
                className="text-xs font-medium text-[#ED5C32] hover:underline"
              >
                Cumpriu o horário ({plannedStart}–{plannedEnd})
              </button>
            </section>
          )}

          {path === "fix_shift" && (
            <section className="space-y-2 border-t border-stone-100 pt-4">
              <p className="text-sm font-semibold text-stone-900">Turno planeado</p>
              <div className="flex items-center gap-2">
                <input aria-label="Início do turno" type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} className={inputCls} />
                <span className="text-stone-400">→</span>
                <input aria-label="Fim do turno" type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} className={inputCls} />
              </div>
              <p className="text-xs text-stone-500">O turno é alterado nas Escalas; a ocorrência é recalculada com o novo horário.</p>
            </section>
          )}

          {path !== "fix_shift" && (
            <div>
              <label htmlFor="res-reason" className="mb-1 block text-sm font-medium text-stone-700">
                {reasonRequired ? (
                  <>
                    Motivo <span className="text-red-500">*</span>
                  </>
                ) : (
                  "Observação (opcional)"
                )}
              </label>
              <textarea id="res-reason" value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} rows={2} className={inputCls} />
            </div>
          )}

          {issue.corrections.length > 0 && (
            <details className="text-xs text-stone-500">
              <summary className="cursor-pointer font-medium">Histórico ({issue.corrections.length})</summary>
              <ul className="mt-2 space-y-1">
                {issue.corrections.map((c) => (
                  <li key={c.id}>
                    {c.reason} — {c.actor}, {new Date(c.createdAt).toLocaleString("pt-PT")}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {resolve.isError && (
            <p role="alert" className="text-sm text-red-700">
              {resolve.error instanceof Error ? resolve.error.message : "Não foi possível resolver."}
            </p>
          )}
        </div>
        )}

        {done ? (
          <div className="border-t border-stone-100 px-6 py-4">
            <button type="button" onClick={onCorrected} className="w-full rounded-lg bg-[#ED5C32] py-2.5 text-sm font-medium text-white">
              Concluir
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-[1fr_2fr] gap-3 border-t border-stone-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-300 py-2.5 text-sm font-medium text-stone-700">
            Cancelar
          </button>
          <button type="button" disabled={!canSubmit} onClick={() => resolve.mutate()} className="rounded-lg bg-[#ED5C32] py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {resolve.isPending ? "A guardar…" : "Resolver ocorrência"}
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
