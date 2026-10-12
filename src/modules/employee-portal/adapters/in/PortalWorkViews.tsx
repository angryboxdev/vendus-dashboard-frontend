import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hoursLabel, missingAnswers, missingRequired, type MyTask, type RequestForm } from "../../domain/entities/portal-engagement.ts";
import { PortalRequestError } from "../../domain/entities/portal.ts";
import { useEmployeePortalModule } from "../../employee-portal.module.tsx";

const CARD = "rounded-2xl border border-[#F5C992]/50 bg-white p-4 shadow-sm";
const FIELD = "w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700";
const PRIMARY = "rounded-xl bg-[#ED5C32] px-3 py-2 text-sm font-medium text-white disabled:opacity-50";
const day = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
const time = (iso: string) => new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" }).format(new Date(iso));
const message = (e: unknown) => (e instanceof Error ? e.message : "Não foi possível concluir.");

// ── Tarefas (FE-073) ──────────────────────────────────────────────────

/** As minhas tarefas: marcar itens e concluir (só com os obrigatórios feitos). */
export function PortalTasksView() {
  const { engagement } = useEmployeePortalModule();
  const { data, isLoading, isError } = useQuery({ queryKey: ["portal-tasks"], queryFn: () => engagement.tasks(), retry: false });
  if (isLoading) return <p className="text-sm text-stone-500">A carregar…</p>;
  if (isError || !data) return <p className="text-sm text-red-700">Não foi possível carregar as tarefas.</p>;
  if (data.length === 0) return <p className="text-sm text-stone-500">Não tem tarefas atribuídas.</p>;
  return (
    <div className="space-y-3">
      {data.map((t) => (
        <TaskCard key={t.id} task={t} />
      ))}
    </div>
  );
}

function TaskCard({ task }: { task: MyTask }) {
  const { engagement } = useEmployeePortalModule();
  const qc = useQueryClient();
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["portal-tasks"] }), qc.invalidateQueries({ queryKey: ["portal-pending"] })]);
  const toggle = useMutation({ mutationFn: (v: { itemId: string; done: boolean }) => engagement.toggleItem(task.id, v.itemId, v.done), onSuccess: refresh });
  const complete = useMutation({ mutationFn: () => engagement.completeTask(task.id), onSuccess: refresh });
  const open = task.status === "open";
  const missing = missingRequired(task);
  return (
    <article className={`${CARD} space-y-2`} aria-label={task.title}>
      <div>
        <p className={`text-sm font-semibold ${open ? "text-stone-900" : "text-stone-500 line-through"}`}>{task.title}</p>
        {task.dueAt && <p className="text-xs text-stone-500">Prazo: {day(task.dueAt)}</p>}
        {task.description && <p className="text-sm text-stone-700">{task.description}</p>}
      </div>
      <ul className="space-y-1">
        {task.checklist.map((i) => (
          <li key={i.id}>
            <label className="flex items-start gap-2 text-sm text-stone-700">
              <input type="checkbox" className="mt-1" checked={i.done} disabled={!open || toggle.isPending} onChange={(e) => toggle.mutate({ itemId: i.id, done: e.target.checked })} />
              <span>
                {i.text}
                {i.required && <span className="ml-1 text-xs text-[#C2410C]">(obrigatório)</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {open && (
        <button type="button" className={PRIMARY} disabled={missing.length > 0 || complete.isPending} onClick={() => complete.mutate()}>
          Concluir tarefa
        </button>
      )}
      {open && missing.length > 0 && <p className="text-xs text-stone-500">Faltam {missing.length} item(ns) obrigatório(s).</p>}
      {(toggle.isError || complete.isError) && <p className="text-sm text-red-700">{message(toggle.error ?? complete.error)}</p>}
    </article>
  );
}

// ── Solicitações (FE-078) ─────────────────────────────────────────────

const STATUS = { pending: "Pendente", approved: "Aprovada", rejected: "Recusada" } as const;

/** As minhas solicitações: escolher o formulário, responder e acompanhar o estado. */
export function PortalCustomRequestsView() {
  const { engagement } = useEmployeePortalModule();
  const forms = useQuery({ queryKey: ["portal-forms"], queryFn: () => engagement.forms(), retry: false });
  const mine = useQuery({ queryKey: ["portal-custom-requests"], queryFn: () => engagement.customRequests(), retry: false });
  const [formId, setFormId] = useState("");
  const form = forms.data?.find((f) => f.id === formId);
  return (
    <div className="space-y-4">
      <section className={`${CARD} space-y-3`} aria-label="Nova solicitação">
        <h2 className="text-sm font-semibold text-stone-900">Nova solicitação</h2>
        {forms.isError && <p className="text-sm text-red-700">Não foi possível carregar os formulários.</p>}
        {forms.data && forms.data.length === 0 && <p className="text-sm text-stone-500">A empresa ainda não criou formulários.</p>}
        {forms.data && forms.data.length > 0 && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-600">Formulário</span>
            <select className={FIELD} value={formId} onChange={(e) => setFormId(e.target.value)}>
              <option value="">Escolher…</option>
              {forms.data.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </label>
        )}
        {form && <CustomRequestForm key={form.id} form={form} onSent={() => setFormId("")} />}
      </section>
      <section className="space-y-2" aria-label="As minhas solicitações">
        <h2 className="text-sm font-semibold text-stone-900">As minhas solicitações</h2>
        {mine.data && mine.data.length === 0 && <p className="text-sm text-stone-500">Ainda não fez solicitações.</p>}
        {(mine.data ?? []).map((r) => (
          <article key={r.id} className={CARD}>
            <p className="text-sm font-medium text-stone-900">{forms.data?.find((f) => f.id === r.formId)?.title ?? "Solicitação"}</p>
            <p className="text-xs text-stone-500">
              {day(r.createdAt)} · {STATUS[r.status]}
              {r.status === "pending" && r.dueAt && ` · resposta até ${day(r.dueAt)}`}
            </p>
            {r.decisionComment && <p className="mt-1 text-sm text-stone-700">{r.decisionComment}</p>}
          </article>
        ))}
      </section>
    </div>
  );
}

function CustomRequestForm({ form, onSent }: { form: RequestForm; onSent: () => void }) {
  const { engagement } = useEmployeePortalModule();
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [tried, setTried] = useState(false);
  const send = useMutation({
    mutationFn: () => engagement.submitCustomRequest(form, answers),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["portal-custom-requests"] });
      onSent();
    },
  });
  const missing = tried ? missingAnswers(form, answers) : [];
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!missingAnswers(form, answers).length) send.mutate();
      }}
    >
      {form.responseDays && <p className="text-xs text-stone-500">Resposta prevista em {form.responseDays} dia(s).</p>}
      {form.fields.map((f) => (
        <fieldset key={f.id} className="space-y-1">
          <legend className="text-sm font-medium text-stone-800">
            {f.title}
            {f.required && <span className="text-[#C2410C]"> *</span>}
          </legend>
          {f.type === "text" && <textarea className={FIELD} rows={2} aria-label={f.title} value={String(answers[f.id] ?? "")} onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })} />}
          {f.type === "single" &&
            f.options.map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm text-stone-700">
                <input type="radio" name={f.id} checked={answers[f.id] === o} onChange={() => setAnswers({ ...answers, [f.id]: o })} />
                {o}
              </label>
            ))}
          {f.type === "multiple" &&
            f.options.map((o) => {
              const cur = Array.isArray(answers[f.id]) ? (answers[f.id] as string[]) : [];
              return (
                <label key={o} className="flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" checked={cur.includes(o)} onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.checked ? [...cur, o] : cur.filter((x) => x !== o) })} />
                  {o}
                </label>
              );
            })}
          {missing.includes(f.id) && <p className="text-xs text-red-700">Resposta obrigatória.</p>}
        </fieldset>
      ))}
      <button type="submit" className={PRIMARY} disabled={send.isPending}>
        Enviar solicitação
      </button>
      {send.isError && <p className="text-sm text-red-700">{send.error instanceof PortalRequestError ? send.error.message : message(send.error)}</p>}
    </form>
  );
}

// ── Quem está (FE-075) ────────────────────────────────────────────────

const STATE = { work: "A trabalhar", remote: "Remoto", break_paid: "Em pausa", break_unpaid: "Em pausa" } as Record<string, string>;

/** Quem está a trabalhar agora, no âmbito que a empresa definiu. */
export function PortalTeamView() {
  const { engagement } = useEmployeePortalModule();
  const { data, isLoading, error } = useQuery({ queryKey: ["portal-whos-in"], queryFn: () => engagement.whosIn(), retry: false, refetchInterval: 60_000 });
  if (isLoading) return <p className="text-sm text-stone-500">A carregar…</p>;
  // FE-116: secção desligada pela empresa → "não disponível", nunca "não encontrada".
  if (error instanceof PortalRequestError) return <p className="text-sm text-stone-600">Esta secção não está disponível.</p>;
  if (error || !data) return <p className="text-sm text-red-700">Não foi possível carregar quem está.</p>;
  return (
    <section className={`${CARD} space-y-2`} aria-label="Quem está">
      <p className="text-xs text-stone-500">{data.scope === "own_location" ? "A mostrar só o seu centro." : "A mostrar toda a empresa."}</p>
      {data.people.length === 0 && <p className="text-sm text-stone-500">Ninguém registou entrada ainda.</p>}
      <ul className="divide-y divide-stone-100">
        {data.people.map((p) => (
          <li key={p.employeeId} className="flex items-center justify-between py-2 text-sm">
            <span className="text-stone-800">{p.name}</span>
            <span className="text-xs text-stone-500">
              {STATE[p.state] ?? p.state} · desde {time(p.since)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── Banco de horas (FE-076) ───────────────────────────────────────────

const KIND: Record<string, string> = {
  excess: "Excedente de tempo",
  deficit: "Défice de tempo",
  multiplier: "Multiplicador",
  holiday: "Feriado",
  compensation_rest: "Compensação em descanso",
  compensation_paid: "Compensação paga",
  expiry: "Expiração",
  adjustment: "Ajuste",
};

/** O meu banco de horas: saldo e movimentos (só se a empresa o mostrar). */
export function PortalTimeBankView() {
  const { engagement } = useEmployeePortalModule();
  const { data, isLoading, error } = useQuery({ queryKey: ["portal-time-bank"], queryFn: () => engagement.timeBank(), retry: false });
  if (isLoading) return <p className="text-sm text-stone-500">A carregar…</p>;
  if (error) return <p className="text-sm text-stone-600">{error instanceof PortalRequestError ? error.message : "Não foi possível carregar o banco de horas."}</p>;
  if (!data) return null;
  return (
    <div className="space-y-3">
      <section className={`${CARD} space-y-1`} aria-label="Saldo">
        <p className="text-xs text-stone-500">Saldo até {day(data.cutoff)}</p>
        <p className={`text-2xl font-semibold ${data.balance < 0 ? "text-red-700" : "text-stone-900"}`}>{hoursLabel(data.balance)}</p>
        <p className="text-xs text-stone-500">
          Gerado {hoursLabel(data.generated)} · Descanso {hoursLabel(data.compensatedRest)} · Pago {hoursLabel(data.compensatedPaid)}
          {data.expired !== 0 && ` · Expirado ${hoursLabel(data.expired)}`}
        </p>
      </section>
      <section className={`${CARD} space-y-1`} aria-label="Movimentos">
        <h2 className="text-sm font-semibold text-stone-900">Movimentos</h2>
        {data.entries.length === 0 && <p className="text-sm text-stone-500">Sem movimentos.</p>}
        <ul className="divide-y divide-stone-100">
          {[...data.entries].reverse().map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>
                <span className="block text-stone-800">{KIND[e.kind] ?? e.kind}</span>
                <span className="block text-xs text-stone-500">{day(e.workDate)}</span>
              </span>
              <span className={e.seconds < 0 ? "text-red-700" : "text-emerald-700"}>{hoursLabel(e.seconds)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
