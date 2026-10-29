import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import type { ConferenceResult, ReviewWeek } from "../../../../domain/entities/attendance-review.ts";
import { weekOf } from "../../../../domain/services/attendance.service.ts";
import { addDays } from "../../../../domain/services/rosters.service.ts";
import { todayIn } from "../../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../../novo-rh.module.tsx";
import { useEmployeePhotos } from "../../common/use-employee-photos.ts";
import { ConferenceView } from "./ConferenceView.tsx";
import type { ReviewCommand } from "./ReviewDrawer.tsx";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const short = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
/** Sem pedido de ausência: confirma a falta como injustificada. */
const UNJUSTIFIED = { id: "", name: "Falta injustificada (sem pedido de ausência)" };

/**
 * Conferência V2 ligada ao servidor (ADR-0043): lê a semana da equipa,
 * grava as decisões (um lote por confirmação) e anula-as. Uma ausência com
 * tipo é primeiro atribuída nas Ausências (regras e saldos de sempre, com a
 * permissão de ausências) e só depois confirmada na conferência.
 */
export function ConferencePanel({ extra, onOpenCorrections }: { extra?: ReactNode; onOpenCorrections: () => void }) {
  const { attendance, absences } = useNovoRh();
  const qc = useQueryClient();
  const photo = useEmployeePhotos();
  const today = todayIn();
  const [from, setFrom] = useState(() => weekOf(today).from);
  const to = addDays(from, 6);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const q = useQuery({ queryKey: ["novo-rh", "attendance", "conference", from], queryFn: () => attendance.conference(from, to) });
  const types = useQuery({ queryKey: ["novo-rh", "absences", "types"], queryFn: () => absences.listTypes() });
  const corrections = useQuery({ queryKey: ["novo-rh", "attendance", "corrections", "pending"], queryFn: () => attendance.corrections("pending") });

  const week: ReviewWeek = q.data ? { ...q.data, people: q.data.people.map((p) => ({ ...p, photoUrl: photo(p.id) })) } : { from, to, people: [], days: [] };
  const absenceTypes = [UNJUSTIFIED, ...(types.data ?? []).filter((t) => !t.archived).map((t) => ({ id: t.id, name: t.name }))];
  const refresh = () => qc.invalidateQueries({ queryKey: ["novo-rh", "attendance"] });

  const apply = async (cmd: ReviewCommand): Promise<ConferenceResult> => {
    let rows = cmd.apply;
    let absenceType: string | null = null;
    const failed: ConferenceResult["skipped"] = [];
    if (cmd.decision === "absence") {
      const type = absenceTypes.find((t) => t.id === cmd.absenceType) ?? UNJUSTIFIED;
      absenceType = type.id ? type.name : "Falta injustificada";
      if (type.id) {
        // Um pedido por dia (atribuído pela gestão); o que falhar não é confirmado.
        const ok: typeof rows = [];
        for (const r of rows) {
          if (r.bucket !== "apply") {
            ok.push(r);
            continue;
          }
          try {
            await absences.assign(r.day.employeeId, { typeId: type.id, startDate: r.day.date, endDate: r.day.date, startTime: null, endTime: null, halfDay: false, comment: cmd.reason });
            ok.push(r);
          } catch (e) {
            failed.push({ employeeId: r.day.employeeId, workDate: r.day.date, reason: "absence_failed", label: e instanceof Error ? e.message : "Ausência não registada" });
          }
        }
        rows = ok;
      }
    }
    try {
      if (!rows.length) return { batchId: "", applied: [], kept: [], skipped: failed };
      const r = await attendance.applyConference({
        decision: cmd.decision,
        scope: cmd.scope,
        items: rows.map((x) => ({ employeeId: x.day.employeeId, workDate: x.day.date, version: x.day.version ?? null })),
        reason: cmd.reason,
        declared: cmd.declared,
        manual: cmd.manual ?? null,
        absenceType,
      });
      return { ...r, skipped: [...failed, ...r.skipped] };
    } finally {
      await refresh();
    }
  };

  return (
    <ConferenceView
      key={from}
      week={week}
      dates={dates}
      today={today}
      weekLabel={`${short(from)} – ${short(to)}`}
      onPrevWeek={() => setFrom(addDays(from, -7))}
      onNextWeek={() => setFrom(addDays(from, 7))}
      onApply={apply}
      absenceTypes={absenceTypes}
      onVoid={async (id, reason) => {
        await attendance.voidConferenceReview(id, reason);
        await refresh();
      }}
      extra={extra}
      pendingCorrections={{ count: corrections.data?.length ?? 0, onOpen: onOpenCorrections }}
      loading={q.isLoading}
    />
  );
}
