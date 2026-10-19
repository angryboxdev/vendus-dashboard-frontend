import { useState } from "react";
import { Button, Drawer, IconChevronDown } from "../../../../../components/ui/index.ts";
import type { Violation } from "../../../domain/entities/rosters.ts";
import { conflictGroups, conflictSummary, RULE_LABEL, weekLabel } from "../../../domain/services/roster-conflicts.service.ts";

const ddmm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

/**
 * «Ver conflitos»: ocorrências agrupadas por colaborador (recolhíveis), cada
 * uma com a data, a semana, as escalas e horários envolvidos, o tipo e o
 * estado de publicação; «Abrir turno» leva à escala, à semana e ao turno.
 */
export function ConflictsDrawer({
  open,
  title,
  violations,
  name,
  currentRosterName,
  onClose,
  onOpenShift,
  confirm,
}: {
  open: boolean;
  title: string;
  violations: Violation[];
  name: (id: string) => string;
  currentRosterName: string;
  onClose: () => void;
  onOpenShift: (v: Violation, which: "self" | "other") => void;
  /** Avisos que se podem aceitar (ex.: «Publicar mesmo assim»). */
  confirm?: { label: string; onConfirm: () => void } | null;
}) {
  const groups = conflictGroups(violations, name);
  const s = conflictSummary(violations);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setClosed((c) => (c.has(id) ? new Set([...c].filter((x) => x !== id)) : new Set([...c, id])));
  return (
    <Drawer
      open={open}
      title={title}
      description={`${s.total} ${s.total === 1 ? "ocorrência" : "ocorrências"} · ${s.employees} ${s.employees === 1 ? "colaborador afetado" : "colaboradores afetados"}${s.weeks.length === 1 ? ` · ${weekLabel(s.weeks[0]!)}` : s.weeks.length > 1 ? ` · ${s.weeks.length} semanas` : ""}`}
      onClose={onClose}
      footer={
        confirm ? (
          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>Rever primeiro</Button>
            <Button variant="primary" onClick={confirm.onConfirm}>
              {confirm.label}
            </Button>
          </div>
        ) : undefined
      }
    >
      {!groups.length ? (
        <p className="text-sm text-ink-secondary">Sem conflitos.</p>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const expanded = !closed.has(g.employeeId);
            return (
              <section key={g.employeeId} className="rounded-xl border border-line-subtle" aria-label={g.name}>
                <button type="button" aria-expanded={expanded} onClick={() => toggle(g.employeeId)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-navy-900">{g.name}</span>
                    <span className="text-xs text-ink-secondary">
                      {g.items.length} {g.items.length === 1 ? "ocorrência" : "ocorrências"}
                      {g.blocking > 0 && ` · ${g.blocking} ${g.blocking === 1 ? "bloqueia" : "bloqueiam"}`}
                    </span>
                  </span>
                  <IconChevronDown size={16} className={`shrink-0 text-ink-secondary transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>
                {expanded && (
                  <ul className="divide-y divide-line-subtle border-t border-line-subtle">
                    {g.items.map((v, i) => (
                      <li key={`${v.rule}-${v.workDate}-${i}`} className="space-y-1 px-3 py-2.5 text-sm">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-semibold tabular-nums text-navy-900">{ddmm(v.workDate)}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${v.severity === "block" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
                            <span aria-hidden="true">{v.severity === "block" ? "●" : "▲"}</span>
                            {RULE_LABEL[v.rule]} · {v.severity === "block" ? "bloqueia" : "aviso"}
                          </span>
                          <span className="text-xs text-ink-muted">{weekLabel(v.workDate)}</span>
                        </p>
                        {v.conflict ? (
                          <p className="text-xs text-ink">
                            {currentRosterName} × {v.conflict.rosterName ?? "outra escala"} ({v.conflict.hours}, {v.conflict.published ? "publicado" : "rascunho"})
                            {v.overlap && <> · sobreposição {v.overlap}</>}
                          </p>
                        ) : (
                          <p className="text-xs text-ink">{v.message}</p>
                        )}
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {v.shiftId && (
                            <Button size="sm" variant="tertiary" onClick={() => onOpenShift(v, "self")}>
                              Abrir turno
                            </Button>
                          )}
                          {v.conflict?.shiftId && (
                            <Button size="sm" variant="tertiary" onClick={() => onOpenShift(v, "other")}>
                              Ver turno existente
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </Drawer>
  );
}
