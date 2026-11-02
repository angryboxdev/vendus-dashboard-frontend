import { useEffect, useMemo, useState } from "react";
import { Button, Drawer, EmployeeCell, FIELD, LABEL, SegmentedControl, StatusBadge } from "../../../../../../components/ui/index.ts";
import type { Classified, ConferenceResult, ReviewDay, ReviewDecision, ReviewScope, ReviewWeek } from "../../../../domain/entities/attendance-review.ts";
import { classify, dayState, formatMinutes, rangeMinutes, rangesLabel } from "../../../../domain/services/attendance-review.service.ts";
import { ABSENCE_TYPES, DECISION, REASON, REASONS, STATE, ddmm, dayLabel, keyOf } from "./review-ui.ts";

/** O que o painel pede para aplicar (um só comando, auditado como um lote). */
export interface ReviewCommand {
  decision: ReviewDecision;
  scope: ReviewScope;
  /** Dias a aplicar (aptos marcados + já conformes, que ficam revistos sem mudar horas). */
  apply: Classified[];
  reason: string;
  manual?: { start: string; end: string; breakMinutes: number };
  /** Id do tipo de ausência escolhido ("" = falta injustificada, sem pedido). */
  absenceType?: string;
  /** Declaração do gestor de que o horário foi cumprido (exigida quando muda horas). */
  declared: boolean;
}

export interface ReviewOutcome {
  applied: number;
  kept: number;
  ignored: { day: ReviewDay; reason: string }[];
  blocked: { day: ReviewDay; reason: string }[];
}

const PUNCH = { in: "Entrada", out: "Saída", break_start: "Início pausa", break_end: "Fim pausa" } as const;

/**
 * Painel único «Rever marcação»: o mesmo para um dia, dias selecionados ou a
 * semana. Uma pergunta (o que aconteceu?), uma abrangência, a
 * pré-visualização e UM botão de confirmação. A decisão "cumpriu o horário"
 * só existe aqui.
 */
export function ReviewDrawer({
  open,
  week,
  keys,
  onClose,
  onConfirm,
  absenceTypes,
  onVoid,
}: {
  open: boolean;
  week: ReviewWeek;
  /** Dias de partida: um (clique numa célula/linha) ou vários (seleção). */
  keys: string[];
  onClose: () => void;
  /** Grava; devolve o resultado do servidor (null = pré-visualização sem servidor). Um erro fica no painel. */
  onConfirm: (cmd: ReviewCommand) => Promise<ConferenceResult | null>;
  /** Tipos de ausência existentes (id "" = falta injustificada, sem pedido de ausência). */
  absenceTypes?: { id: string; name: string }[];
  /** Anular a decisão de um dia já revisto (com motivo). */
  onVoid?: (reviewId: string, reason: string) => Promise<void>;
}) {
  const types = absenceTypes ?? ABSENCE_TYPES.map((name) => ({ id: name, name }));
  const single = keys.length === 1;
  const scopes: { key: ReviewScope; label: string }[] = [
    ...(single ? [{ key: "day" as const, label: "Este dia" }] : [{ key: "selected" as const, label: `Dias selecionados (${keys.length})` }]),
    { key: "week", label: "Semana inteira" },
  ];
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [scope, setScope] = useState<ReviewScope>(single ? "day" : "selected");
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [detail, setDetail] = useState("");
  const [declared, setDeclared] = useState(false);
  const [manual, setManual] = useState({ start: "", end: "", breakMinutes: 0 });
  const [absenceType, setAbsenceType] = useState<string>("");
  const [outcome, setOutcome] = useState<ReviewOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Abrir de novo = começar do zero.
  const sig = keys.join(",");
  useEffect(() => {
    setDecision(null);
    setScope(keys.length === 1 ? "day" : "selected");
    setUnchecked(new Set());
    setReason(REASONS[0]);
    setDetail("");
    setDeclared(false);
    setOutcome(null);
    setError(null);
    setAbsenceType(types[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, open]);

  const byKey = useMemo(() => new Map(week.days.map((d) => [keyOf(d.employeeId, d.date), d])), [week.days]);
  const people = new Map(week.people.map((p) => [p.id, p]));
  const start = keys.map((k) => byKey.get(k)).filter((d): d is ReviewDay => !!d);
  const employees = [...new Set(start.map((d) => d.employeeId))];
  const candidates =
    scope === "week" ? week.days.filter((d) => employees.includes(d.employeeId)) : scope === "day" ? start.slice(0, 1) : start;
  const first = candidates[0];
  const one = candidates.length === 1 ? first : undefined;

  useEffect(() => {
    if (one && decision === "manual") {
      const ins = one.punches.find((p) => p.kind === "in")?.at ?? one.planned?.[0]?.start ?? "";
      const outs = [...one.punches].reverse().find((p) => p.kind === "out")?.at ?? one.planned?.at(-1)?.end ?? "";
      setManual({ start: ins, end: outs, breakMinutes: one.unpaidBreakMinutes ?? 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision, one?.employeeId, one?.date]);

  const rows = decision ? classify(candidates, decision) : [];
  const manualAfter = manual.start && manual.end ? Math.max(0, rangeMinutes(manual) - manual.breakMinutes) : 0;
  const withManual = rows.map((r) => (decision === "manual" && r.bucket === "apply" ? { ...r, after: manualAfter } : r));
  const apply = withManual.filter((r) => r.bucket === "apply" && !unchecked.has(keyOf(r.day.employeeId, r.day.date)));
  const already = withManual.filter((r) => r.bucket === "already" && r.reason === "already_ok");
  const excluded = withManual.filter((r) => r.bucket === "excluded" || (r.bucket === "already" && r.reason !== "already_ok"));
  const individual = withManual.filter((r) => r.bucket === "individual");
  const before = apply.reduce((s, r) => s + r.before, 0);
  const after = apply.reduce((s, r) => s + r.after, 0);
  const changesHours = apply.some((r) => r.after !== r.before);
  const needsDeclaration = decision === "fulfilled" && changesHours;
  const manualMissing = decision === "manual" && (!manual.start || !manual.end);
  const canConfirm = !!decision && apply.length + already.length > 0 && (!needsDeclaration || declared) && !manualMissing && !!reason;

  const confirm = async () => {
    if (!decision || busy) return;
    const full = [reason === "Outro" ? "" : reason, detail.trim()].filter(Boolean).join(" — ") || reason;
    const why = (r: Classified) => ({ day: r.day, reason: r.reason ? REASON[r.reason] : "Desmarcado na pré-visualização" });
    const ignored = [...withManual.filter((r) => r.bucket === "apply" && unchecked.has(keyOf(r.day.employeeId, r.day.date))), ...individual].map(why);
    setBusy(true);
    setError(null);
    try {
      const server = await onConfirm({
        decision,
        scope,
        apply: [...apply, ...already],
        reason: full,
        declared,
        ...(decision === "manual" && { manual }),
        ...(decision === "absence" && { absenceType }),
      });
      if (!server) {
        setOutcome({ applied: apply.length, kept: already.length, ignored, blocked: excluded.map(why) });
        return;
      }
      // O servidor volta a classificar: o que ele saltou junta-se aos excluídos daqui.
      setOutcome({
        applied: server.applied.length,
        kept: server.kept.length,
        ignored,
        blocked: [
          ...excluded.map(why),
          ...server.skipped.flatMap((s) => {
            const day = byKey.get(keyOf(s.employeeId, s.workDate));
            return day ? [{ day, reason: s.label }] : [];
          }),
        ],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível guardar.");
    } finally {
      setBusy(false);
    }
  };

  const title = outcome ? "Revisão guardada" : "Rever marcação";
  const footer = outcome ? (
    <Button variant="primary" onClick={onClose}>
      Fechar
    </Button>
  ) : (
    <>
      <Button variant="tertiary" onClick={onClose}>
        Cancelar
      </Button>
      <Button variant="primary" disabled={!canConfirm} loading={busy} onClick={() => void confirm()}>
        {decision === "keep" ? "Guardar revisão" : "Confirmar correção"}
      </Button>
    </>
  );

  return (
    <Drawer open={open} title={title} onClose={onClose} footer={footer} width="max-w-xl" label="Rever marcação">
      {outcome ? (
        <Outcome outcome={outcome} name={(id) => people.get(id)?.name ?? id} />
      ) : (
        <div className="space-y-6">
          {/* A. Identificação */}
          <section aria-label="Identificação" className="space-y-2">
            {employees.length === 1 && first ? (
              <EmployeeCell
                name={people.get(first.employeeId)?.name ?? ""}
                photoUrl={people.get(first.employeeId)?.photoUrl ?? null}
                subtitle={people.get(first.employeeId)?.location}
                aside={one ? <StatusBadge tone={STATE[dayState(one)].tone}>{STATE[dayState(one)].label}</StatusBadge> : undefined}
              />
            ) : (
              <p className="text-sm font-medium text-navy-900">
                {employees.length} colaboradores · {candidates.length} dias
              </p>
            )}
            <p className="text-xs text-ink-secondary">
              {one ? `${dayLabel(one.date)} · ${ddmm(one.date)}` : `${ddmm(week.from)} a ${ddmm(week.to)}`}
            </p>
          </section>

          {/* B. Comparação */}
          {one ? <Compare day={one} /> : <GroupSummary days={candidates} />}
          {one?.review && <ReviewInfo day={one} onVoid={onVoid} />}

          {/* C. O que aconteceu? */}
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold text-navy-900">O que aconteceu?</legend>
            {(Object.keys(DECISION) as ReviewDecision[]).map((k) => (
              <label
                key={k}
                className={`flex cursor-pointer gap-3 rounded-xl border px-3.5 py-3 transition-colors ${decision === k ? "border-brand-500 bg-brand-50/60" : "border-line hover:bg-surface-soft"}`}
              >
                <input
                  type="radio"
                  name="decision"
                  className="mt-1 accent-brand-600"
                  checked={decision === k}
                  onChange={() => {
                    setDecision(k);
                    setDeclared(false);
                  }}
                />
                <span>
                  <span className="block text-sm font-medium text-navy-900">{DECISION[k].label}</span>
                  <span className="block text-xs text-ink-secondary">{DECISION[k].hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {/* D. Abrangência (independente da decisão) */}
          <div>
            <span className={LABEL}>Abrangência</span>
            <SegmentedControl
              size="sm"
              label="Abrangência"
              items={scopes}
              value={scope}
              onChange={(s) => {
                setScope(s);
                setUnchecked(new Set());
              }}
            />
          </div>

          {decision === "manual" && one && rows[0]?.bucket === "apply" && (
            <div className="grid grid-cols-3 gap-3">
              <label>
                <span className={LABEL}>Entrada</span>
                <input type="time" className={`${FIELD} w-full`} value={manual.start} onChange={(e) => setManual({ ...manual, start: e.target.value })} />
              </label>
              <label>
                <span className={LABEL}>Saída</span>
                <input type="time" className={`${FIELD} w-full`} value={manual.end} onChange={(e) => setManual({ ...manual, end: e.target.value })} />
              </label>
              <label>
                <span className={LABEL}>Pausa não paga (min)</span>
                <input
                  type="number"
                  min={0}
                  className={`${FIELD} w-full`}
                  value={manual.breakMinutes}
                  onChange={(e) => setManual({ ...manual, breakMinutes: Math.max(0, Number(e.target.value) || 0) })}
                />
              </label>
            </div>
          )}
          {decision === "absence" && apply.length > 0 && (
            <label className="block">
              <span className={LABEL}>Tipo de ausência</span>
              <select className={`${FIELD} w-full`} value={absenceType} onChange={(e) => setAbsenceType(e.target.value)}>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-ink-secondary">O efeito no saldo segue as regras atuais do tipo escolhido.</span>
            </label>
          )}

          {/* E. Pré-visualização */}
          {decision && (
            <section aria-label="Pré-visualização" className="space-y-3">
              <h3 className="text-sm font-semibold text-navy-900">Antes e depois</h3>
              {one ? (
                rows[0]!.bucket === "apply" || rows[0]!.bucket === "already" ? (
                  <p className="rounded-xl bg-surface-soft px-3.5 py-2.5 text-sm text-ink">
                    {formatMinutes(withManual[0]!.before)} → <strong>{formatMinutes(withManual[0]!.after)}</strong> validadas
                    {one.plannedMinutes > 0 && <> · diferença {formatMinutes(withManual[0]!.after - one.plannedMinutes, true)}</>}
                    {rows[0]!.bucket === "already" && <> · já conforme, fica revisto</>}
                  </p>
                ) : (
                  <p role="alert" className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
                    Não se aplica a este dia: {REASON[rows[0]!.reason!]}.
                    {rows[0]!.reason === "overtime" && " Escolha «Manter a marcação original» ou corrija manualmente."}
                  </p>
                )
              ) : (
                <BatchPreview
                  apply={withManual.filter((r) => r.bucket === "apply")}
                  unchecked={unchecked}
                  toggle={(k) => setUnchecked((cur) => (cur.has(k) ? new Set([...cur].filter((x) => x !== k)) : new Set([...cur, k])))}
                  already={already}
                  excluded={excluded}
                  individual={individual}
                  name={(id) => people.get(id)?.name ?? id}
                  before={before}
                  after={after}
                />
              )}
            </section>
          )}

          {/* F. Motivo e declaração */}
          {decision && apply.length + already.length > 0 && (
            <section className="space-y-3">
              <label className="block">
                <span className={LABEL}>Motivo</span>
                <select className={`${FIELD} w-full`} value={reason} onChange={(e) => setReason(e.target.value)}>
                  {REASONS.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={LABEL}>Detalhe (opcional)</span>
                <input className={`${FIELD} w-full`} value={detail} onChange={(e) => setDetail(e.target.value)} />
              </label>
              {needsDeclaration && (
                <label className="flex gap-2.5 rounded-xl border border-line px-3.5 py-3 text-sm text-navy-900">
                  <input type="checkbox" className="mt-0.5 accent-brand-600" checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
                  Confirmo que o horário indicado foi efetivamente cumprido.
                </label>
              )}
              <p className="text-xs text-ink-secondary">As picagens originais e a escala publicada não são alteradas; fica registado quem confirmou, quando e com que motivo.</p>
            </section>
          )}
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
              {error}
            </p>
          )}
        </div>
      )}
    </Drawer>
  );
}

function Compare({ day }: { day: ReviewDay }) {
  const row = "flex justify-between gap-4 py-2 text-sm";
  return (
    <section aria-label="Comparação" className="divide-y divide-line-subtle rounded-xl border border-line px-3.5">
      <div className={row}>
        <span className="text-ink-secondary">Horário publicado</span>
        <span className="text-right font-medium tabular-nums text-navy-900">
          {day.absence ?? (day.dayOff ? "Folga" : rangesLabel(day.planned))}
          {day.unpaidBreakMinutes ? ` (pausa ${day.unpaidBreakMinutes} min)` : ""}
        </span>
      </div>
      <div className={row}>
        <span className="text-ink-secondary">Picagens originais</span>
        <span className="text-right tabular-nums text-navy-900">
          {day.punches.length
            ? day.punches.map((p) => `${PUNCH[p.kind]} ${p.at}${p.nextDay ? " (+1)" : ""}`).join(" · ")
            : "Sem picagens"}
        </span>
      </div>
      <div className={row}>
        <span className="text-ink-secondary">Horas calculadas</span>
        <span className="tabular-nums text-navy-900">
          {formatMinutes(day.workedMinutes)} de {formatMinutes(day.plannedMinutes)}
        </span>
      </div>
      <div className={row}>
        <span className="text-ink-secondary">Diferença</span>
        <span className="tabular-nums text-navy-900">{formatMinutes(day.workedMinutes - day.plannedMinutes, true)}</span>
      </div>
    </section>
  );
}

/** Dia já revisto: quem decidiu o quê e, com motivo, anular (o dia volta ao calculado e pode ser revisto de novo). */
function ReviewInfo({ day, onVoid }: { day: ReviewDay; onVoid?: (reviewId: string, reason: string) => Promise<void> }) {
  const r = day.review!;
  const [voiding, setVoiding] = useState(false);
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const when = r.createdAt ? new Date(r.createdAt).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : null;
  return (
    <section aria-label="Decisão gravada" className="space-y-2 rounded-xl bg-emerald-50/60 px-3.5 py-3 text-sm">
      <p className="text-navy-900">
        <strong className="font-medium">{DECISION[r.decision].label}</strong> · {formatMinutes(r.validatedMinutes)} validadas
      </p>
      <p className="text-xs text-ink-secondary">
        {r.by}
        {when && ` · ${when}`} · {r.reason}
        {r.absenceType && ` · ${r.absenceType}`}
      </p>
      {onVoid && r.id && !day.closed && (
        <>
          {voiding ? (
            <div className="flex items-end gap-2">
              <label className="flex-1">
                <span className={LABEL}>Motivo para anular</span>
                <input className={`${FIELD} w-full`} value={why} onChange={(e) => setWhy(e.target.value)} />
              </label>
              <Button
                variant="danger"
                size="sm"
                disabled={!why.trim()}
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await onVoid(r.id!, why.trim());
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Não foi possível anular.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Anular
              </Button>
            </div>
          ) : (
            <button type="button" className="text-xs font-medium text-brand-600 hover:underline" onClick={() => setVoiding(true)}>
              Anular esta decisão
            </button>
          )}
          {error && <p className="text-xs text-red-700">{error}</p>}
        </>
      )}
    </section>
  );
}

function GroupSummary({ days }: { days: ReviewDay[] }) {
  const counts = new Map<string, number>();
  for (const d of days) counts.set(dayState(d), (counts.get(dayState(d)) ?? 0) + 1);
  return (
    <section aria-label="Comparação" className="flex flex-wrap gap-1.5">
      {[...counts.entries()].map(([s, n]) => (
        <StatusBadge key={s} tone={STATE[s as keyof typeof STATE].tone}>
          {n} {STATE[s as keyof typeof STATE].label.toLowerCase()}
        </StatusBadge>
      ))}
    </section>
  );
}

function BatchPreview(p: {
  apply: Classified[];
  unchecked: Set<string>;
  toggle: (k: string) => void;
  already: Classified[];
  excluded: Classified[];
  individual: Classified[];
  name: (id: string) => string;
  before: number;
  after: number;
}) {
  const label = (r: Classified) => `${p.name(r.day.employeeId)} · ${dayLabel(r.day.date)}`;
  const chosen = p.apply.length - p.apply.filter((r) => p.unchecked.has(keyOf(r.day.employeeId, r.day.date))).length;
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-4 gap-2 text-center">
        {[
          ["Aptos a aplicar", chosen],
          ["Já conformes", p.already.length],
          ["Excluídos", p.excluded.length],
          ["Revisão individual", p.individual.length],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-surface-soft px-2 py-2">
            <dt className="text-[11px] text-ink-secondary">{k}</dt>
            <dd className="text-lg font-semibold tabular-nums text-navy-900">{v}</dd>
          </div>
        ))}
      </dl>
      {chosen > 0 && (
        <p className="text-sm text-ink">
          Horas validadas nos dias aptos: {formatMinutes(p.before)} → <strong>{formatMinutes(p.after)}</strong> ({formatMinutes(p.after - p.before, true)})
        </p>
      )}
      {p.apply.length > 0 && (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
          {p.apply.map((r) => {
            const k = keyOf(r.day.employeeId, r.day.date);
            return (
              <li key={k}>
                <label className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-soft">
                  <span className="flex items-center gap-2">
                    <input type="checkbox" className="accent-brand-600" checked={!p.unchecked.has(k)} onChange={() => p.toggle(k)} />
                    {label(r)}
                  </span>
                  <span className="tabular-nums text-ink-secondary">
                    {formatMinutes(r.before)} → {formatMinutes(r.after)}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {[...p.individual, ...p.excluded].length > 0 && (
        <details className="rounded-xl border border-line px-3.5 py-2 text-sm" open={p.apply.length === 0}>
          <summary className="cursor-pointer font-medium text-navy-900">
            Fora desta decisão ({p.individual.length + p.excluded.length})
          </summary>
          <ul className="mt-2 space-y-1 text-ink-secondary">
            {[...p.individual, ...p.excluded].map((r) => (
              <li key={keyOf(r.day.employeeId, r.day.date)} className="flex justify-between gap-3">
                <span className="shrink-0 whitespace-nowrap">{label(r)}</span>
                <span className="text-right">{REASON[r.reason!]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Outcome({ outcome, name }: { outcome: ReviewOutcome; name: (id: string) => string }) {
  const list = (items: { day: ReviewDay; reason: string }[]) => (
    <ul className="mt-1 space-y-0.5 text-ink-secondary">
      {items.map((i) => (
        <li key={keyOf(i.day.employeeId, i.day.date)}>
          {name(i.day.employeeId)} · {dayLabel(i.day.date)} — {i.reason}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="space-y-4 text-sm" role="status">
      <dl className="grid grid-cols-4 gap-2 text-center">
        {[
          ["Aplicados", outcome.applied],
          ["Mantidos", outcome.kept],
          ["Ignorados", outcome.ignored.length],
          ["Bloqueados", outcome.blocked.length],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-surface-soft px-2 py-2">
            <dt className="text-[11px] text-ink-secondary">{k}</dt>
            <dd className="text-lg font-semibold tabular-nums text-navy-900">{v}</dd>
          </div>
        ))}
      </dl>
      {outcome.ignored.length > 0 && (
        <div>
          <p className="font-medium text-navy-900">Ignorados</p>
          {list(outcome.ignored)}
        </div>
      )}
      {outcome.blocked.length > 0 && (
        <div>
          <p className="font-medium text-navy-900">Bloqueados</p>
          {list(outcome.blocked)}
        </div>
      )}
    </div>
  );
}
