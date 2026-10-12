import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { Button, FIELD, IconPlus, LABEL, SECTION_TITLE, StatusBadge, SURFACE, Tabs } from "../../../../../components/ui/index.ts";
import type { FormField } from "../../../domain/entities/engagement.ts";
import { newField, parseChecklist, parseOptions, shortDateTime } from "../../../domain/services/engagement.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const KEY = ["novo-rh", "workspace"];
const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** Novo RH → Tarefas, Solicitações e Quem está (Fase 9). */
export function WorkspaceView() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"tasks" | "requests" | "whosIn">("tasks");
  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "tasks", label: t("ws.tab.tasks") },
          { key: "requests", label: t("ws.tab.requests") },
          { key: "whosIn", label: t("ws.tab.whosIn") },
        ]}
      />
      {tab === "tasks" && <TasksPanel />}
      {tab === "requests" && <RequestsPanel />}
      {tab === "whosIn" && <WhosInPanel />}
    </div>
  );
}

function TasksPanel() {
  const { t } = useI18n();
  const { workspace, settings } = useNovoRh();
  const qc = useQueryClient();
  const tasks = useQuery({ queryKey: [...KEY, "tasks"], queryFn: () => workspace.tasks() });
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  const name = (id: string | null) => (id ? (employees.data?.find((e) => e.id === id)?.label ?? id) : "—");
  const [v, setV] = useState({ title: "", assignee: "", due: "", checklist: "" });
  const create = useMutation({
    mutationFn: () => workspace.createTask({ title: v.title, description: null, assigneeEmployeeId: v.assignee || null, dueAt: v.due ? new Date(v.due).toISOString() : null, checklist: parseChecklist(v.checklist) }),
    onSuccess: async () => {
      setV({ title: "", assignee: "", due: "", checklist: "" });
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const toggle = useMutation({ mutationFn: (x: { task: string; item: string; done: boolean }) => workspace.toggleItem(x.task, x.item, x.done), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  const complete = useMutation({ mutationFn: (id: string) => workspace.completeTask(id), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  return (
    <div className="space-y-4">
      <section className={`${SURFACE} space-y-2 p-4`} aria-label={t("ws.task.new")}>
        <h3 className={SECTION_TITLE}>{t("ws.task.new")}</h3>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[200px] flex-1">
            <span className={LABEL}>{t("ws.task.title")}</span>
            <input className={`${FIELD} w-full`} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </label>
          <label>
            <span className={LABEL}>{t("ws.task.assignee")}</span>
            <select className={FIELD} value={v.assignee} onChange={(e) => setV({ ...v, assignee: e.target.value })}>
              <option value="">—</option>
              {(employees.data ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={LABEL}>{t("ws.task.due")}</span>
            <input type="datetime-local" className={FIELD} value={v.due} onChange={(e) => setV({ ...v, due: e.target.value })} />
          </label>
        </div>
        <label className="block">
          <span className={LABEL}>{t("ws.task.checklist")}</span>
          <textarea className={`${FIELD} w-full`} rows={3} value={v.checklist} onChange={(e) => setV({ ...v, checklist: e.target.value })} />
        </label>
        <Button variant="primary" disabled={!v.title.trim() || create.isPending} onClick={() => create.mutate()}>
          {t("ws.task.create")}
        </Button>
        {create.isError && <p className="text-sm text-red-700">{message(create.error, t("common.error"))}</p>}
      </section>
      <section className={`${SURFACE} space-y-2 p-4`}>
        {tasks.data?.length === 0 && <p className="text-sm text-stone-500">{t("ws.tasks.none")}</p>}
        {(tasks.data ?? []).map((task) => (
          <article key={task.id} className="space-y-1 rounded-md border border-stone-200 p-2 text-sm" aria-label={task.title}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-stone-900">{task.title}</span>
              <StatusBadge tone={task.status === "done" ? "success" : "neutral"}>{t(`ws.task.status.${task.status}` as MessageKey)}</StatusBadge>
              <span className="text-xs text-stone-500">
                {name(task.assigneeEmployeeId)} · {shortDateTime(task.dueAt)}
              </span>
              {task.status === "open" && (
                <Button size="sm" disabled={complete.isPending} onClick={() => complete.mutate(task.id)}>
                  {t("ws.task.complete")}
                </Button>
              )}
            </div>
            <ul className="space-y-0.5">
              {task.checklist.map((i) => (
                <li key={i.id}>
                  <label className="flex items-center gap-1 text-stone-700">
                    <input type="checkbox" checked={i.done} disabled={task.status !== "open"} onChange={(e) => toggle.mutate({ task: task.id, item: i.id, done: e.target.checked })} />
                    {i.text}
                    {i.required && <span className="text-red-700">*</span>}
                  </label>
                </li>
              ))}
            </ul>
          </article>
        ))}
        {(complete.isError || toggle.isError) && <p className="text-sm text-red-700">{message(complete.error ?? toggle.error, t("common.error"))}</p>}
      </section>
    </div>
  );
}

function RequestsPanel() {
  const { t } = useI18n();
  const { workspace, settings } = useNovoRh();
  const qc = useQueryClient();
  const forms = useQuery({ queryKey: [...KEY, "forms"], queryFn: () => workspace.forms() });
  const pending = useQuery({ queryKey: [...KEY, "requests"], queryFn: () => workspace.requests("pending") });
  const employees = useQuery({ queryKey: ["novo-rh", "settings", "employees"], queryFn: () => settings.listEmployees() });
  const name = (id: string) => employees.data?.find((e) => e.id === id)?.label ?? id;
  const [title, setTitle] = useState("");
  const [days, setDays] = useState("");
  const [fields, setFields] = useState<(FormField & { optionsText: string })[]>([{ ...newField(0), optionsText: "" }]);
  const [comment, setComment] = useState("");
  const create = useMutation({
    mutationFn: () => workspace.createForm({ title, responseDays: days ? Number(days) : null, fields: fields.map(({ optionsText, ...f }) => ({ ...f, options: f.type === "text" ? [] : parseOptions(optionsText) })) }),
    onSuccess: async () => {
      setTitle("");
      setFields([{ ...newField(0), optionsText: "" }]);
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const decide = useMutation({ mutationFn: (x: { id: string; d: "approve" | "reject" }) => workspace.decide(x.id, x.d, comment.trim() || null), onSuccess: () => qc.invalidateQueries({ queryKey: KEY }) });
  const set = (i: number, patch: Partial<FormField & { optionsText: string }>) => setFields(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const formTitle = (id: string) => forms.data?.find((f) => f.id === id)?.title ?? "";
  return (
    <div className="space-y-4">
      <section className={`${SURFACE} space-y-2 p-4`}>
        <h3 className={SECTION_TITLE}>{t("ws.requests.pending")}</h3>
        {pending.data?.length === 0 && <p className="text-sm text-stone-500">{t("ws.requests.none")}</p>}
        {!!pending.data?.length && <input aria-label={t("abs.field.comment")} className={`${FIELD} w-full max-w-sm`} placeholder={t("abs.field.comment")} value={comment} onChange={(e) => setComment(e.target.value)} />}
        <ul className="space-y-1 text-sm">
          {(pending.data ?? []).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{formTitle(r.formId)}</span>
              <span>{name(r.employeeId)}</span>
              <span className="text-xs text-stone-500">{Object.values(r.answers).flat().join(" · ")}</span>
              <Button size="sm" variant="primary" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.id, d: "approve" })}>
                {t("ws.request.approve")}
              </Button>
              <Button size="sm" disabled={decide.isPending || !comment.trim()} onClick={() => decide.mutate({ id: r.id, d: "reject" })}>
                {t("ws.request.reject")}
              </Button>
            </li>
          ))}
        </ul>
        {decide.isError && <p className="text-sm text-red-700">{message(decide.error, t("common.error"))}</p>}
      </section>
      <section className={`${SURFACE} space-y-2 p-4`} aria-label={t("ws.form.new")}>
        <h3 className={SECTION_TITLE}>{t("ws.forms")}</h3>
        <ul className="text-sm text-stone-700">
          {(forms.data ?? [])
            .filter((f) => !f.archived)
            .map((f) => (
              <li key={f.id}>
                {f.title} · {f.fields.length}
              </li>
            ))}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[200px] flex-1">
            <span className={LABEL}>{t("ws.form.title")}</span>
            <input className={`${FIELD} w-full`} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            <span className={LABEL}>{t("ws.form.days")}</span>
            <input className={`${FIELD} w-20`} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
          </label>
        </div>
        {fields.map((f, i) => (
          <fieldset key={f.id} className="flex flex-wrap items-end gap-2 rounded-md border border-stone-200 p-2">
            <legend className="px-1 text-xs font-semibold text-stone-600">{t("ws.form.field", { n: i + 1 })}</legend>
            <label className="min-w-[160px] flex-1">
              <span className={LABEL}>{t("ws.form.fieldTitle")}</span>
              <input className={`${FIELD} w-full`} value={f.title} onChange={(e) => set(i, { title: e.target.value })} />
            </label>
            <label>
              <span className={LABEL}>{t("ws.form.fieldType")}</span>
              <select className={FIELD} value={f.type} onChange={(e) => set(i, { type: e.target.value as FormField["type"] })}>
                {(["text", "single", "multiple"] as const).map((x) => (
                  <option key={x} value={x}>
                    {t(`ws.form.type.${x}` as MessageKey)}
                  </option>
                ))}
              </select>
            </label>
            {f.type !== "text" && (
              <label className="min-w-[160px] flex-1">
                <span className={LABEL}>{t("ws.form.options")}</span>
                <input className={`${FIELD} w-full`} value={f.optionsText} onChange={(e) => set(i, { optionsText: e.target.value })} />
              </label>
            )}
            <label className="flex items-center gap-1 pb-2 text-sm text-stone-700">
              <input type="checkbox" checked={f.required} onChange={(e) => set(i, { required: e.target.checked })} />
              {t("ws.form.required")}
            </label>
          </fieldset>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={<IconPlus />} disabled={fields.length >= 50} onClick={() => setFields([...fields, { ...newField(fields.length), optionsText: "" }])}>
            {t("ws.form.addField")}
          </Button>
          <Button variant="primary" disabled={!title.trim() || create.isPending} onClick={() => create.mutate()}>
            {t("ws.form.create")}
          </Button>
        </div>
        {create.isError && <p className="text-sm text-red-700">{message(create.error, t("common.error"))}</p>}
      </section>
    </div>
  );
}

function WhosInPanel() {
  const { t } = useI18n();
  const { workspace } = useNovoRh();
  const q = useQuery({ queryKey: [...KEY, "whos-in"], queryFn: () => workspace.whosIn(), retry: false });
  if (q.isError) return <p className="text-sm text-amber-800">{message(q.error, t("common.loadError"))}</p>;
  return (
    <section className={`${SURFACE} space-y-2 p-4`}>
      {q.data && <p className="text-xs text-stone-500">{t(`ws.whosIn.scope.${q.data.scope}` as MessageKey)}</p>}
      {q.data?.people.length === 0 && <p className="text-sm text-stone-500">{t("ws.whosIn.none")}</p>}
      <ul className="space-y-1 text-sm">
        {(q.data?.people ?? []).map((p) => (
          <li key={p.employeeId} className="flex items-center gap-2">
            <span className="font-medium text-stone-900">{p.name}</span>
            <StatusBadge tone="success">{t(`att.segment.${p.state}` as MessageKey)}</StatusBadge>
            <span className="text-xs text-stone-500">{t("ws.whosIn.since", { time: shortDateTime(p.since).slice(11) })}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
