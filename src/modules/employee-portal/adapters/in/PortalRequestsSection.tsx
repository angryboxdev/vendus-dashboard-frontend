import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { REQUEST_REASONS, type MyRequest, type RequestKind } from "../../domain/entities/portal.ts";
import { addDays, dateLabel, dayLabel, shiftHours } from "../../domain/services/portal-text.service.ts";
import { useEmployeePortalModule } from "../../employee-portal.module.tsx";
import { todayLisbon } from "./portal-today.ts";

const REQUESTS_KEY = ["portal-requests"];
/** Justificar: turnos dos últimos 30 dias (o servidor aceita até 62). */
const JUSTIFY_LOOKBACK_DAYS = 30;

const STATUS: Record<MyRequest["status"], { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-amber-50 text-amber-800" },
  approved: { label: "Aprovado", cls: "bg-emerald-50 text-emerald-800" },
  rejected: { label: "Rejeitado", cls: "bg-red-50 text-red-800" },
  cancelled: { label: "Cancelado", cls: "bg-stone-100 text-stone-600" },
};

const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";
const labelCls = "mb-1 block text-xs font-medium text-stone-700";

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
  const past = [...(shifts ?? [])].reverse();

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-[#F5C992]/50 bg-white p-4 shadow-sm" aria-label="Justificar falta">
      <p className="text-sm font-semibold text-stone-900">Justificar falta ou atraso</p>
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
        {shifts && past.length === 0 && <p className="mt-1 text-xs text-stone-500">Sem turnos nos últimos {JUSTIFY_LOOKBACK_DAYS} dias.</p>}
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
        <button type="submit" disabled={!shiftId || !code || create.isPending} className="rounded-lg bg-[#ED5C32] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {create.isPending ? "A enviar…" : "Enviar ao RH"}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600">
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
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [code, setCode] = useState("");
  const [text, setText] = useState("");
  const create = useMutation({
    mutationFn: () => selfService.createRequest({ kind: "day_off", startDate: start, endDate: end || start, reasonCode: code, reasonText: text || null }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: REQUESTS_KEY });
      onDone();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-[#F5C992]/50 bg-white p-4 shadow-sm" aria-label="Pedir folga">
      <p className="text-sm font-semibold text-stone-900">Pedir folga</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls} htmlFor="dayoff-start">
            De
          </label>
          <input id="dayoff-start" type="date" min={today} value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="dayoff-end">
            Até (opcional)
          </label>
          <input id="dayoff-end" type="date" min={start || today} value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
        </div>
      </div>
      <ReasonFields kind="day_off" code={code} text={text} onCode={setCode} onText={setText} />
      {create.isError && (
        <p role="alert" className="text-xs text-red-700">
          {create.error instanceof Error ? create.error.message : "Não foi possível enviar."}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={!start || !code || create.isPending} className="rounded-lg bg-[#ED5C32] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {create.isPending ? "A enviar…" : "Enviar ao gerente"}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600">
          Cancelar
        </button>
      </div>
      <p className="text-xs text-stone-500">Se for aprovado, o gerente ajusta a escala desses dias.</p>
    </form>
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
  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-stone-900">
            {r.kind === "justify_absence" ? "Justificação de falta" : "Folga"} ·{" "}
            {r.startDate === r.endDate ? dateLabel(r.startDate) : `${dateLabel(r.startDate)} – ${dateLabel(r.endDate)}`}
          </p>
          <p className="text-xs text-stone-500">
            {r.reasonLabel}
            {r.attachmentName && " · com comprovativo"}
          </p>
          {r.decisionNote && <p className={`mt-1 text-xs ${r.status === "rejected" ? "text-red-700" : "text-stone-600"}`}>{r.decisionNote}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.label}</span>
      </div>
      {r.status === "pending" && (
        <button type="button" disabled={cancel.isPending} onClick={() => cancel.mutate()} className="mt-1 text-xs font-medium text-stone-500 underline disabled:opacity-50">
          Cancelar pedido
        </button>
      )}
    </li>
  );
}

/** Pedidos do colaborador (ticket 12): justificar falta (→ RH) e pedir folga (→ gerente). */
export function PortalRequestsSection() {
  const { selfService } = useEmployeePortalModule();
  const [form, setForm] = useState<RequestKind | null>(null);
  const { data, isLoading, isError } = useQuery({ queryKey: REQUESTS_KEY, queryFn: () => selfService.listRequests(), retry: false });

  return (
    <section className="space-y-3" aria-label="Pedidos">
      <h1 className="text-base font-semibold text-stone-900">Pedidos</h1>
      {form === null && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setForm("justify_absence")} className="rounded-xl border border-[#F5C992] bg-white px-3 py-3 text-sm font-medium text-stone-800 shadow-sm">
            Justificar falta
          </button>
          <button type="button" onClick={() => setForm("day_off")} className="rounded-xl border border-[#F5C992] bg-white px-3 py-3 text-sm font-medium text-stone-800 shadow-sm">
            Pedir folga
          </button>
        </div>
      )}
      {form === "justify_absence" && <JustifyForm onDone={() => setForm(null)} />}
      {form === "day_off" && <DayOffForm onDone={() => setForm(null)} />}

      {isLoading ? (
        <p className="text-sm text-stone-500">A carregar…</p>
      ) : isError ? (
        <p className="text-sm text-red-700">Não foi possível carregar os pedidos.</p>
      ) : data && data.length > 0 ? (
        <ul className="divide-y divide-stone-100 rounded-2xl border border-[#F5C992]/50 bg-white shadow-sm">
          {data.map((r) => (
            <RequestItem key={r.id} r={r} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-500">Ainda não fez nenhum pedido.</p>
      )}
    </section>
  );
}
