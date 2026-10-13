import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import {
  Button,
  FIELD,
  IconPlus,
  IconTrash,
  LABEL,
  SECTION_TITLE,
  StatusBadge,
  SURFACE,
  TimePicker,
} from "../../../../../components/ui/index.ts";
import type { Segment } from "../../../domain/entities/rosters.ts";
import {
  daysFrom,
  formatSegments,
} from "../../../domain/services/rosters.service.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const KEY = ["novo-rh", "rosters"];
const message = (e: unknown, fallback: string) =>
  e instanceof Error ? e.message : fallback;

/** Modelos de turno (RE-15): nome e abreviatura obrigatórios, uma ou mais faixas. */
export function TemplatesPanel() {
  const { t } = useI18n();
  const { rosters } = useNovoRh();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: [...KEY, "templates"],
    queryFn: () => rosters.listTemplates(),
  });
  const [v, setV] = useState({
    name: "",
    abbreviation: "",
    color: "#ED5C32",
    onCall: false,
  });
  // Faixas escolhidas no relógio (sem escrever); até 3 por modelo.
  const [segments, setSegments] = useState<Segment[]>([
    { start: "09:00", end: "17:00" },
  ]);
  const valid = segments.every((s) => s.start !== s.end);
  const setSegment = (i: number, patch: Partial<Segment>) =>
    setSegments(segments.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const create = useMutation({
    mutationFn: () =>
      rosters.createTemplate({
        name: v.name,
        abbreviation: v.abbreviation,
        color: v.color,
        onCall: v.onCall,
        segments,
      }),
    onSuccess: async () => {
      setV({ ...v, name: "", abbreviation: "" });
      setSegments([{ start: "09:00", end: "17:00" }]);
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const archive = useMutation({
    mutationFn: (id: string) => rosters.archiveTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
  const list = (q.data ?? []).filter((x) => !x.archived);
  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      {q.data && list.length === 0 && (
        <p className="text-sm text-stone-500">{t("ros.templates.none")}</p>
      )}
      <ul className="space-y-1 text-sm">
        {list.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded px-1 text-xs font-semibold text-white"
              style={{ backgroundColor: x.color ?? "#78716c" }}
            >
              {x.abbreviation}
            </span>
            <span className="font-medium text-stone-900">{x.name}</span>
            <span className="text-stone-500">{formatSegments(x.segments)}</span>
            {x.onCall && (
              <StatusBadge tone="neutral">
                {t("ros.template.onCall")}
              </StatusBadge>
            )}
            <Button
              size="sm"
              variant="tertiary"
              aria-label={`${t("abs.archive")} ${x.name}`}
              onClick={() => archive.mutate(x.id)}
            >
              {t("abs.archive")}
            </Button>
          </li>
        ))}
      </ul>
      <div
        className="flex flex-wrap items-end gap-2"
        role="group"
        aria-label={t("ros.template.create")}
      >
        <label>
          <span className={LABEL}>{t("ros.template.name")}</span>
          <input
            className={FIELD}
            maxLength={80}
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
        </label>
        <label>
          <span className={LABEL}>{t("ros.template.abbr")}</span>
          <input
            className={`${FIELD} w-20`}
            maxLength={6}
            value={v.abbreviation}
            onChange={(e) => setV({ ...v, abbreviation: e.target.value })}
          />
        </label>
        <fieldset className="min-w-[220px] flex-1">
          <legend className={LABEL}>{t("ros.template.segments")}</legend>
          <div className="flex flex-wrap items-center gap-2">
            {segments.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <TimePicker
                  label={`${t("ros.template.start")} ${i + 1}`}
                  value={s.start}
                  onChange={(start) => setSegment(i, { start })}
                />
                <span className="text-ink-muted">–</span>
                <TimePicker
                  label={`${t("ros.template.end")} ${i + 1}`}
                  value={s.end}
                  onChange={(end) => setSegment(i, { end })}
                />
                {segments.length > 1 && (
                  <Button
                    size="sm"
                    variant="tertiary"
                    aria-label={`${t("ros.template.removeSegment")} ${i + 1}`}
                    onClick={() =>
                      setSegments(segments.filter((_, j) => j !== i))
                    }
                  >
                    <IconTrash size={16} />
                  </Button>
                )}
              </div>
            ))}
            {segments.length < 3 && (
              <Button
                size="sm"
                variant="tertiary"
                icon={<IconPlus size={16} />}
                onClick={() => {
                  const last = segments[segments.length - 1]!;
                  // Nova faixa começa onde a última acaba e dura 4 h.
                  const [h, m] = last.end.split(":").map(Number);
                  const end = `${String(((h ?? 0) + 4) % 24).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;
                  setSegments([...segments, { start: last.end, end }]);
                }}
              >
                {t("ros.template.addSegment")}
              </Button>
            )}
          </div>
        </fieldset>
        <label className="flex items-center gap-1 pb-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={v.onCall}
            onChange={(e) => setV({ ...v, onCall: e.target.checked })}
          />
          {t("ros.template.onCall")}
        </label>
        <Button
          variant="primary"
          disabled={!valid || create.isPending}
          onClick={() => create.mutate()}
        >
          {t("ros.template.create")}
        </Button>
      </div>
      {!valid && (
        <p className="text-sm text-red-700">
          {t("ros.template.invalidSegments")}
        </p>
      )}
      {create.isError && (
        <p className="text-sm text-red-700">
          {message(create.error, t("common.error"))}
        </p>
      )}
    </section>
  );
}

/** Trocas à espera da gestão (o colega já aceitou). */
export function SwapsPanel() {
  const { t } = useI18n();
  const { rosters, settings } = useNovoRh();
  const qc = useQueryClient();
  const employees = useQuery({
    queryKey: ["novo-rh", "settings", "employees"],
    queryFn: () => settings.listEmployees(),
  });
  const q = useQuery({
    queryKey: [...KEY, "swaps", "pending_manager"],
    queryFn: () => rosters.listSwaps("pending_manager"),
  });
  const [comment, setComment] = useState("");
  const decide = useMutation({
    mutationFn: (v: { id: string; decision: "approve" | "reject" }) =>
      rosters.decideSwap(v.id, v.decision, comment.trim() || null, true),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
  const name = (id: string) =>
    employees.data?.find((e) => e.id === id)?.label ?? id;
  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      {q.data?.length === 0 && (
        <p className="text-sm text-stone-500">{t("ros.swaps.none")}</p>
      )}
      {!!q.data?.length && (
        <>
          <input
            aria-label={t("abs.field.comment")}
            className={`${FIELD} w-full max-w-sm`}
            placeholder={t("abs.field.comment")}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <ul className="space-y-1 text-sm">
            {q.data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {t("ros.swap.row", {
                    from: name(s.requesterEmployeeId),
                    to: name(s.targetEmployeeId),
                    date: s.createdAt.slice(0, 10),
                  })}
                </span>
                {s.comment && (
                  <span className="text-xs text-stone-500">{s.comment}</span>
                )}
                <Button
                  size="sm"
                  variant="primary"
                  disabled={decide.isPending}
                  onClick={() =>
                    decide.mutate({ id: s.id, decision: "approve" })
                  }
                >
                  {t("ros.swap.approve")}
                </Button>
                <Button
                  size="sm"
                  disabled={decide.isPending || !comment.trim()}
                  onClick={() =>
                    decide.mutate({ id: s.id, decision: "reject" })
                  }
                >
                  {t("ros.swap.reject")}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      {decide.isError && (
        <p className="text-sm text-red-700">
          {message(decide.error, t("common.error"))}
        </p>
      )}
    </section>
  );
}

/** O meu horário (Novo RH, em teste): turnos publicados e trocas. */
export function MyRosterPanel() {
  const { t } = useI18n();
  const { rosters, settings } = useNovoRh();
  const qc = useQueryClient();
  const from = todayIn();
  const to = daysFrom(from, 14).at(-1)!;
  const mine = useQuery({
    queryKey: [...KEY, "mine", from],
    queryFn: () => rosters.myRoster(from, to),
    retry: false,
  });
  const swaps = useQuery({
    queryKey: [...KEY, "mine", "swaps"],
    queryFn: () => rosters.mySwaps(),
    enabled: mine.isSuccess,
  });
  const employees = useQuery({
    queryKey: ["novo-rh", "settings", "employees"],
    queryFn: () => settings.listEmployees(),
  });
  const [req, setReq] = useState({
    shiftId: "",
    targetEmployeeId: "",
    comment: "",
  });
  const ask = useMutation({
    mutationFn: () =>
      rosters.requestSwap({
        shiftId: req.shiftId,
        targetEmployeeId: req.targetEmployeeId,
        counterShiftId: null,
        comment: req.comment.trim() || null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
  const respond = useMutation({
    mutationFn: (v: { id: string; accept: boolean }) =>
      rosters.respondSwap(v.id, v.accept),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
  const name = (id: string) =>
    employees.data?.find((e) => e.id === id)?.label ?? id;
  if (mine.isError)
    return (
      <p className="text-sm text-amber-800">
        {message(mine.error, t("common.loadError"))}
      </p>
    );
  const me = mine.data?.employeeId;
  const incoming = (swaps.data ?? []).filter(
    (s) => s.targetEmployeeId === me && s.status === "pending_target",
  );
  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-500">{t("ros.mine.hint")}</p>
      <section className={`${SURFACE} space-y-2 p-4`}>
        {mine.data?.shifts.length === 0 && (
          <p className="text-sm text-stone-500">{t("ros.mine.none")}</p>
        )}
        <ul className="space-y-1 text-sm">
          {(mine.data?.shifts ?? []).map((s) => (
            <li key={s.id}>
              {s.workDate}:{" "}
              {s.kind === "day_off"
                ? t("ros.dayOff")
                : formatSegments(s.segments)}
            </li>
          ))}
        </ul>
      </section>
      {incoming.length > 0 && (
        <section className={`${SURFACE} space-y-2 p-4`}>
          <h3 className={SECTION_TITLE}>{t("ros.mine.incoming")}</h3>
          <ul className="space-y-1 text-sm">
            {incoming.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2">
                <span>{name(s.requesterEmployeeId)}</span>
                {s.comment && (
                  <span className="text-xs text-stone-500">{s.comment}</span>
                )}
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => respond.mutate({ id: s.id, accept: true })}
                >
                  {t("ros.mine.accept")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => respond.mutate({ id: s.id, accept: false })}
                >
                  {t("ros.mine.decline")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!!mine.data?.shifts.length && (
        <section
          className={`${SURFACE} space-y-2 p-4`}
          aria-label={t("ros.mine.request")}
        >
          <h3 className={SECTION_TITLE}>{t("ros.mine.request")}</h3>
          <div className="flex flex-wrap items-end gap-2">
            <label>
              <span className={LABEL}>{t("ros.mine.myShift")}</span>
              <select
                className={FIELD}
                value={req.shiftId}
                onChange={(e) => setReq({ ...req, shiftId: e.target.value })}
              >
                <option value="">{t("common.choose")}…</option>
                {mine.data.shifts
                  .filter((s) => s.kind === "shift")
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.workDate} · {formatSegments(s.segments)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span className={LABEL}>{t("ros.mine.colleague")}</span>
              <select
                className={FIELD}
                value={req.targetEmployeeId}
                onChange={(e) =>
                  setReq({ ...req, targetEmployeeId: e.target.value })
                }
              >
                <option value="">{t("common.choose")}…</option>
                {(employees.data ?? [])
                  .filter((e) => e.id !== me)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="min-w-[200px] flex-1">
              <span className={LABEL}>{t("abs.field.comment")}</span>
              <input
                className={`${FIELD} w-full`}
                value={req.comment}
                onChange={(e) => setReq({ ...req, comment: e.target.value })}
              />
            </label>
            <Button
              variant="primary"
              disabled={!req.shiftId || !req.targetEmployeeId || ask.isPending}
              onClick={() => ask.mutate()}
            >
              {t("ros.mine.request")}
            </Button>
          </div>
          {ask.isError && (
            <p className="text-sm text-red-700">
              {message(ask.error, t("common.error"))}
            </p>
          )}
          <ul className="space-y-0.5 text-xs text-stone-600">
            {(swaps.data ?? [])
              .filter((s) => s.requesterEmployeeId === me)
              .map((s) => (
                <li key={s.id}>
                  {name(s.targetEmployeeId)} —{" "}
                  {t(`ros.swap.status.${s.status}` as MessageKey)}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
