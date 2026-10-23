import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { REQUEST_REASONS, type MyRequest, type RequestKind } from "../../domain/entities/portal.ts";
import { addDays, dayLabel, shiftHours } from "../../domain/services/portal-text.service.ts";
import { FOCUS_RING, IconCalendar, IconChevronRight, IconHistory } from "../../../../components/ui";
import { useEmployeePortalModule } from "../../employee-portal.module.tsx";
import { todayLisbon } from "./portal-today.ts";
import { PeriodSheet } from "./PeriodSheet.tsx";
import { daysInclusive, periodLabel, shortDate } from "../../domain/services/period-picker.service.ts";

/** Folga: máximo de dias seguidos (o servidor aplica a mesma regra). */
const MAX_DAY_OFF_DAYS = 7;

const REQUESTS_KEY = ["portal-requests"];
/** Justificar: turnos dos últimos 30 dias (o servidor aceita até 62). */
const JUSTIFY_LOOKBACK_DAYS = 30;

const STATUS: Record<MyRequest["status"], { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-amber-50 text-amber-800" },
  approved: { label: "Aprovado", cls: "bg-emerald-50 text-emerald-800" },
  rejected: { label: "Rejeitado", cls: "bg-red-50 text-red-800" },
  cancelled: { label: "Cancelado", cls: "bg-surface-soft text-ink-secondary" },
};

const inputCls = `min-h-11 w-full rounded-xl border border-line bg-surface-card px-3 py-2 text-base text-ink sm:text-sm ${FOCUS_RING}`;
const labelCls = "mb-1 block text-xs font-medium text-ink";

function ReasonFields({ kind, code, text, onCode, onText }: { kind: RequestKind; code: string; text: string; onCode: (c: string) => void; onText: (t: string) => void }) {
  return (
    <>
      <div>
        <label className={labelCls} htmlFor={`reason-${kind}`}>
          Motivo
        </label>
        <select id={`reason-${kind}`} value={code} onChange={(e) => onCode(e.target.value)} className={inputCls}>
          <option value="">Escolha…</option>
          {REQUEST_REASONS[kind].map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor={`text-${kind}`}>
          {code === "other" ? "Descreva o motivo" : "Observação (opcional)"}
        </label>
        <textarea id={`text-${kind}`} value={text} onChange={(e) => onText(e.target.value)} rows={2} maxLength={500} className={inputCls} />
      </div>
    </>
  );
}

function JustifyForm({ onDone }: { onDone: () => void }) {
  const { selfService } = useEmployeePortalModule();
  const qc = useQueryClient();
  const today = todayLisbon();
  const { data: shifts } = useQuery({
    queryKey: ["portal-shifts-past", today],
    queryFn: () => selfService.listShifts(addDays(today, -JUSTIFY_LOOKBACK_DAYS), today),
    retry: false,
  });
  const [shiftId, setShiftId] = useState("");
  const [code, setCode] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const create = useMutation({
    mutationFn: () => selfService.createRequest({ kind: "justify_absence", workShiftId: shiftId, reasonCode: code, reasonText: text || null, attachment: file }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: REQUESTS_KEY });
      onDone();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };
  const past = [...(shifts ?? [])].filter((s) => s.kind !== "day_off").reverse();

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Justificar falta">
      <div>
        <label className={labelCls} htmlFor="justify-shift">
          Turno
        </label>
        <select id="justify-shift" value={shiftId} onChange={(e) => setShiftId(e.target.value)} className={inputCls}>
          <option value="">Escolha o turno…</option>
          {past.map((s) => (
            <option key={s.id} value={s.id}>
              {dayLabel(s.workDate, today)} · {shiftHours(s)} · {s.locationName}
            </option>
          ))}
        </select>
        {shifts && past.length === 0 && <p className="mt-1 text-xs text-ink-secondary">Sem turnos nos últimos {JUSTIFY_LOOKBACK_DAYS} dias.</p>}
      </div>
      <ReasonFields kind="justify_absence" code={code} text={text} onCode={setCode} onText={setText} />
      <div>
        <label className={labelCls} htmlFor="justify-file">
          Comprovativo (opcional) — PDF ou foto
        </label>
        <input id="justify-file" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-xs" />
      </div>
      {create.isError && (
        <p role="alert" className="text-xs text-red-700">
          {create.error instanceof Error ? create.error.message : "Não foi possível enviar."}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={!shiftId || !code || create.isPending} className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white disabled:opacity-50">
          {create.isPending ? "A enviar…" : "Enviar ao RH"}
        </button>
        <button type="button" onClick={onDone} className="min-h-11 rounded-xl border border-line px-4 text-sm text-ink-secondary">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function DayOffForm({ onDone }: { onDone: () => void }) {
  const { selfService } = useEmployeePortalModule();
  const qc = useQueryClient();
  const today = todayLisbon();
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [code, setCode] = useState("");
  const [text, setText] = useState("");
  const create = useMutation({
    mutationFn: () => selfService.createRequest({ kind: "day_off", startDate: period!.start, endDate: period!.end, reasonCode: code, reasonText: text || null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: REQUESTS_KEY });
      onDone();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (period) create.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Pedir folga">
      <div>
        <span className={labelCls}>Período</span>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className={`flex min-h-11 w-full items-center justify-between rounded-xl border bg-surface-card px-3 py-2.5 text-left text-sm ${FOCUS_RING} ${period ? "border-brand-500 text-navy-900" : "border-line text-ink-secondary"}`}
        >
          <span className="flex items-center gap-2">
            <IconCalendar size={16} />
            {period ? (period.start === period.end ? shortDate(period.start) : `${shortDate(period.start)} → ${shortDate(period.end)}`) : "Escolher dias"}
          </span>
          <IconChevronRight size={16} className="text-ink-muted" />
        </button>
        {period && (
          <p className="mt-1 text-xs text-ink-secondary">
            {daysInclusive(period.start, period.end)} {daysInclusive(period.start, period.end) === 1 ? "dia" : "dias"}
          </p>
        )}
      </div>
      <ReasonFields kind="day_off" code={code} text={text} onCode={setCode} onText={setText} />
      {create.isError && (
        <p role="alert" className="text-xs text-red-700">
          {create.error instanceof Error ? create.error.message : "Não foi possível enviar."}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="submit" disabled={!period || !code || create.isPending} className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white disabled:opacity-50">
          {create.isPending ? "A enviar…" : "Enviar pedido"}
        </button>
        <button type="button" onClick={onDone} className="min-h-11 rounded-xl border border-line px-4 text-sm text-ink-secondary">
          Cancelar
        </button>
      </div>
      <p className="text-xs text-ink-secondary">Vai para o gerente. Se for aprovado, ele ajusta a escala desses dias.</p>
      {picking && (
        <PeriodSheet
          initial={{ start: period?.start ?? null, end: period?.end ?? null }}
          today={today}
          maxDays={MAX_DAY_OFF_DAYS}
          onClose={() => setPicking(false)}
          onConfirm={(p) => {
            setPeriod(p);
            setPicking(false);
          }}
        />
      )}
    </form>
  );
}

/** "Novo pedido" (mockup): Tipo escolhe entre folga e justificar falta. */
function NewRequestCard({ onDone }: { onDone: () => void }) {
  const [kind, setKind] = useState<RequestKind>("day_off");
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface-card p-4 shadow-card" aria-label="Novo pedido">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <IconCalendar size={20} />
        </span>
        <div>
          <p className="text-base font-semibold text-navy-900">Novo pedido</p>
          <p className="text-xs text-ink-secondary">Peça uma folga ou justifique uma falta.</p>
        </div>
      </div>
      <div>
        <label className={labelCls} htmlFor="request-kind">
          Tipo
        </label>
        <select id="request-kind" value={kind} onChange={(e) => setKind(e.target.value as RequestKind)} className={inputCls}>
          <option value="day_off">Folga</option>
          <option value="justify_absence">Justificar falta ou atraso</option>
        </select>
      </div>
      {kind === "day_off" ? <DayOffForm onDone={onDone} /> : <JustifyForm onDone={onDone} />}
    </section>
  );
}

function RequestItem({ r }: { r: MyRequest }) {
  const { selfService } = useEmployeePortalModule();
  const qc = useQueryClient();
  const cancel = useMutation({
    mutationFn: () => selfService.cancelRequest(r.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: REQUESTS_KEY }),
  });
  const st = STATUS[r.status];
  const isDayOff = r.kind === "day_off";
  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <IconCalendar size={16} className="shrink-0 text-ink-muted" />
        <p className="min-w-0 flex-1 text-sm text-navy-900">{periodLabel(r.startDate, r.endDate)}</p>
        <span className="flex items-center gap-1.5 text-xs text-ink-secondary">
          <span className={`h-2 w-2 rounded-full ${isDayOff ? "bg-orange-500" : "bg-emerald-500"}`} />
          {isDayOff ? "Folga" : "Justificação"}
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span>
      </div>
      <p className="mt-1 pl-7 text-xs text-ink-secondary">
        {r.reasonLabel}
        {r.attachmentName && " · com comprovativo"}
      </p>
      {r.decisionNote && <p className={`pl-7 text-xs ${r.status === "rejected" ? "text-red-700" : "text-ink-secondary"}`}>{r.decisionNote}</p>}
      {r.status === "pending" && (
        <button type="button" disabled={cancel.isPending} onClick={() => cancel.mutate()} className={`ml-6 mt-1 inline-flex min-h-11 items-center rounded-lg px-1 text-sm font-medium text-ink-secondary underline disabled:opacity-50 ${FOCUS_RING}`}>
          Cancelar pedido
        </button>
      )}
    </li>
  );
}

/** Pedidos do colaborador (ticket 12): justificar falta (→ RH) e pedir folga (→ gerente). */
export function PortalRequestsSection() {
  const { selfService } = useEmployeePortalModule();
  const [creating, setCreating] = useState(false);
  const { data, isLoading, isError } = useQuery({ queryKey: REQUESTS_KEY, queryFn: () => selfService.listRequests(), retry: false });

  return (
    <section className="space-y-3" aria-label="Pedidos">
      <h1 className="text-lg font-bold text-navy-900">Pedidos</h1>
      {creating ? (
        <NewRequestCard onDone={() => setCreating(false)} />
      ) : (
        <button type="button" onClick={() => setCreating(true)} className={`h-12 w-full rounded-2xl bg-brand-600 px-3 text-sm font-semibold text-white active:bg-brand-500 ${FOCUS_RING}`}>
          + Novo pedido
        </button>
      )}

      {isLoading ? (
        <p className="text-sm text-ink-secondary">A carregar…</p>
      ) : isError ? (
        <p className="text-sm text-red-700">Não foi possível carregar os pedidos.</p>
      ) : data && data.length > 0 ? (
        <div className="rounded-2.5xl border border-line bg-surface-card shadow-card">
          <p className="flex items-center gap-2 border-b border-line-subtle px-4 py-3 text-sm font-semibold text-navy-900">
            <IconHistory size={16} className="text-ink-secondary" />
            Pedidos recentes
          </p>
          <ul className="divide-y divide-line-subtle">
            {data.map((r) => (
              <RequestItem key={r.id} r={r} />
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-ink-secondary">Ainda não fez nenhum pedido.</p>
      )}
    </section>
  );
}
