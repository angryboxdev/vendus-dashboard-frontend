import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHrModule } from "../../hr.module.tsx";
import { formatMinutes } from "../../../../lib/format-minutes.ts";
import type { AttendanceCorrectionType, AttendanceIssueDetail } from "../../domain/entities/attendance-conference.ts";
import { ABSENCE_TYPE_LABEL, type AbsenceType } from "../../domain/entities/absences.ts";

/**
 * "Resolver ocorrência" (mockup Assiduidade, 2026-10-07) — painel lateral
 * com 4 caminhos principais: registar ausência (fica em Férias & Ausências e
 * a ocorrência fica associada), associar a uma ausência existente, corrigir
 * picagem, corrigir o turno planeado. As ações antigas (manter, justificar
 * sem impacto, remover marcação) continuam em "Mais opções". A ocorrência
 * fecha sempre por uma correção com motivo (o backend exige-o).
 */
type Path = "register_absence" | "link_absence" | "fix_punch" | "fix_shift" | "keep_as_is" | "justify_no_impact" | "remove_marking";

const MAIN: Array<{ key: Path; title: string; hint: string }> = [
  { key: "register_absence", title: "Registar ausência", hint: "Criar um registo em Férias & Ausências." },
  { key: "link_absence", title: "Associar a ausência existente", hint: "Vincular esta ocorrência a uma ausência já registada." },
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

  const [path, setPath] = useState<Path>("register_absence");
  const [showMore, setShowMore] = useState(false);
  // Registar ausência
  const [kind, setKind] = useState<"falta" | AbsenceType>("falta");
  const [justified, setJustified] = useState(true);
  const [absStart, setAbsStart] = useState(plannedStart);
  const [absEnd, setAbsEnd] = useState(plannedEnd);
  // Associar
  const [linkedId, setLinkedId] = useState("");
  // Corrigir picagem / turno
  const [actualStart, setActualStart] = useState(planned?.actualStart ?? "");
  const [actualEnd, setActualEnd] = useState(planned?.actualEnd ?? "");
  const [shiftStart, setShiftStart] = useState(plannedStart);
  const [shiftEnd, setShiftEnd] = useState(plannedEnd);
  // Comum
  const [reason, setReason] = useState("");

  const { data: dayBoard } = useQuery({
    queryKey: ["hr-absence-board", issue.workDate, issue.workDate],
    queryFn: () => api.getAbsenceBoard(issue.workDate, issue.workDate),
    enabled: path === "link_absence",
    retry: false,
  });
  const existing = (dayBoard?.records ?? []).filter((r) => r.source === "absence" && r.status === "approved" && r.employeeId === issue.employeeId);

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
        case "register_absence": {
          await api.registerAbsence({
            employeeId: issue.employeeId,
            type: absenceType,
            duration: fullShift ? "day" : "hours",
            startDate: issue.workDate,
            endDate: issue.workDate,
            ...(fullShift ? {} : { startTime: absStart, endTime: absEnd }),
            notes: reason || null,
          });
          const why = `Ausência registada em Férias & Ausências: ${ABSENCE_TYPE_LABEL[absenceType]}${reason ? ` — ${reason}` : ""}`;
          // Falta injustificada continua a contar como ausência; as restantes ficam justificadas.
          return correction(absenceType === "unjustified" ? "mark_absence" : "justify_no_impact", why);
        }
        case "link_absence": {
          const a = existing.find((r) => r.id === linkedId)!;
          return correction("justify_no_impact", `Associada à ausência existente: ${ABSENCE_TYPE_LABEL[a.type]} (${a.startDate}${a.endDate !== a.startDate ? ` a ${a.endDate}` : ""})${reason ? ` — ${reason}` : ""}`);
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
      onCorrected();
    },
  });

  const reasonRequired = path === "fix_punch" || path === "keep_as_is" || path === "justify_no_impact" || path === "remove_marking";
  const canSubmit =
    !resolve.isPending &&
    (!reasonRequired || reason.trim().length > 0) &&
    (path !== "register_absence" || fullShift || (absStart && absEnd && absEnd > absStart)) &&
    (path !== "link_absence" || !!linkedId) &&
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

          {path === "register_absence" && (
            <section className="space-y-3 border-t border-stone-100 pt-4" aria-label="Dados da ausência">
              <p className="text-sm font-semibold text-stone-900">Dados da ausência</p>
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
              <div className="flex items-start gap-2 rounded-lg bg-orange-50 p-3 text-sm">
                <span className="text-[#ED5C32]">ⓘ</span>
                <p>
                  <strong>Será criado 1 registo em Férias &amp; Ausências</strong> ({fullShift ? "dia inteiro" : `${absStart}–${absEnd}`}).
                  <span className="block text-stone-600">Esta ocorrência ficará associada ao mesmo registo.</span>
                </p>
              </div>
            </section>
          )}

          {path === "link_absence" && (
            <section className="space-y-2 border-t border-stone-100 pt-4">
              <p className="text-sm font-semibold text-stone-900">Ausências registadas neste dia</p>
              {!dayBoard ? (
                <p className="text-xs text-stone-500">A carregar…</p>
              ) : existing.length === 0 ? (
                <p className="text-xs text-stone-500">Não há nenhuma ausência deste colaborador neste dia — use "Registar ausência".</p>
              ) : (
                existing.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm">
                    <input type="radio" name="linked" checked={linkedId === a.id} onChange={() => setLinkedId(a.id)} className="accent-[#ED5C32]" />
                    {ABSENCE_TYPE_LABEL[a.type]} · {a.duration}
                  </label>
                ))
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

        <div className="grid grid-cols-[1fr_2fr] gap-3 border-t border-stone-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-stone-300 py-2.5 text-sm font-medium text-stone-700">
            Cancelar
          </button>
          <button type="button" disabled={!canSubmit} onClick={() => resolve.mutate()} className="rounded-lg bg-[#ED5C32] py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {resolve.isPending ? "A guardar…" : "Resolver ocorrência"}
          </button>
        </div>
      </div>
    </div>
  );
}
