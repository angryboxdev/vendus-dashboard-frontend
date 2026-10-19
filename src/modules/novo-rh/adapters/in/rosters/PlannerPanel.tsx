import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import {
  AlertBanner,
  Button,
  DateNavigator,
  Dialog,
  Drawer,
  DropdownMenu,
  EmptyState,
  FIELD,
  IconAlert,
  IconButton,
  IconCalendar,
  IconChevronDown,
  IconCopy,
  IconDownload,
  IconEye,
  IconLayers,
  IconPlus,
  IconRedo,
  IconSearch,
  IconSliders,
  IconStore,
  IconUndo,
  IconUserPlus,
  IconUsers,
  LABEL,
  Popover,
  SearchableSelect,
  SegmentedControl,
  Toolbar,
  ToolbarDivider,
  ToolbarGroup,
} from "../../../../../components/ui/index.ts";
import type {
  PublishOptions,
  RosterShift,
  ShiftInput,
  Violation,
} from "../../../domain/entities/rosters.ts";
import { weekOf } from "../../../domain/services/attendance.service.ts";
import {
  cellLabel,
  daysFrom,
  violationsOf,
} from "../../../domain/services/rosters.service.ts";
import {
  rangeLabel,
  rosterRows,
} from "../../../domain/services/roster-board.service.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { downloadBlob } from "../download.ts";
import { AssignPanel } from "./AssignPanel.tsx";
import { RosterBoard, type BoardMode } from "./RosterBoard.tsx";
import { useRosterEditing } from "./use-roster-editing.ts";
import { useEditHistory } from "./use-edit-history.ts";
import { MezzaAssistantButton } from "../assistant/MezzaAssistantButton.tsx";
import { aiBatchOp } from "../../../domain/services/assistant.service.ts";
import { PlacementPreview } from "./PlacementPreview.tsx";
import { cellKey } from "../../../domain/services/roster-edit.service.ts";
import { conflictShiftIds, conflictSummary, conflictTarget, weekLabel } from "../../../domain/services/roster-conflicts.service.ts";
import { AddEmployeesBody, AddEmployeesPicker } from "./AddEmployeesPicker.tsx";
import { ConflictsDrawer } from "./ConflictsDrawer.tsx";

const KEY = ["novo-rh", "rosters"];
const PUBLISH_TRIGGER_ID = "ros-publish-trigger";
const ROSTER_KEY = "novo-rh-roster-id";
const MODE_KEY = "novo-rh-roster-board-mode";
const message = (e: unknown, fallback: string) =>
  e instanceof Error ? e.message : fallback;
const plus = (d: string, n: number) => daysFrom(d, n + 1).at(-1)!;

function load(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function save(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // sem persistência — não faz mal.
  }
}

/**
 * Aviso compacto junto à operação (substitui a lista vermelha gigante): uma
 * só ocorrência mostra-se por inteiro («Horário indisponível…», com «Ver
 * turno existente»); várias mostram o resumo e «Ver conflitos» (painel).
 */
function ConflictNotice({
  kind,
  violations,
  name,
  onView,
  onOpenOther,
  onConfirm,
  confirmLabel,
  onDismiss,
}: {
  kind: "confirm" | "blocked";
  violations: Violation[];
  name: (id: string) => string;
  onView: () => void;
  onOpenOther: (v: Violation) => void;
  onConfirm: (() => void) | null;
  confirmLabel: string;
  onDismiss: () => void;
}) {
  const s = conflictSummary(violations);
  const one = violations.length === 1 ? violations[0]! : null;
  const title = one
    ? one.rule === "overlap"
      ? `Horário indisponível — ${name(one.employeeId)}`
      : `${name(one.employeeId)} · ${one.workDate}`
    : `${s.total} ${kind === "blocked" ? "conflitos encontrados" : "avisos de restrições"}`;
  return (
    <AlertBanner
      tone={kind === "blocked" ? "danger" : "warning"}
      title={title}
      action={
        <span className="flex flex-wrap gap-1.5">
          {one?.conflict?.shiftId && (
            <Button size="sm" onClick={() => onOpenOther(one)}>
              Ver turno existente
            </Button>
          )}
          {!one && (
            <Button size="sm" onClick={onView}>
              Ver conflitos
            </Button>
          )}
          {onConfirm && (
            <Button size="sm" variant="primary" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          )}
          <Button size="sm" variant="tertiary" onClick={onDismiss}>
            {onConfirm ? "Cancelar" : "Fechar"}
          </Button>
        </span>
      }
    >
      {one ? (
        <p>{one.message}</p>
      ) : (
        <p>
          {s.employees} {s.employees === 1 ? "colaborador afetado" : "colaboradores afetados"}
          {s.weeks.length === 1 ? ` · ${weekLabel(s.weeks[0]!)}` : ` · ${s.weeks.length} semanas`}
        </p>
      )}
    </AlertBanner>
  );
}

/**
 * Escala (F-04.1) com o Design System Mezza: escala (local ou grupo), barra
 * única, grelha por colaborador e "Atribuir turnos". Mesmas ações de antes:
 * pintar dias com um modelo, alterar/remover (motivo se publicado), publicar
 * com versões e avisos, atribuir em massa e histórico.
 */
export function PlannerPanel({
  onOpenTemplates,
  onOpenSwaps,
  onOpenMine,
}: {
  onOpenTemplates: () => void;
  onOpenSwaps: () => void;
  onOpenMine: () => void;
}) {
  const { t } = useI18n();
  const { rosters, settings, structure, people } = useNovoRh();
  const qc = useQueryClient();
  const today = todayIn();
  // Escala e semana também na URL (?escala=&semana=): ao voltar da ficha de
  // um colaborador, o browser repõe o mesmo local e período.
  const [params, setParams] = useSearchParams();
  const [chosen, setChosen] = useState(() => params.get("escala") || load(ROSTER_KEY));
  const [from, setFrom] = useState(() => {
    const w = params.get("semana");
    return w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? weekOf(w).from : weekOf(today).from;
  });
  const [span, setSpan] = useState<7 | 14>(7);
  const to = plus(from, span - 1);
  const days = daysFrom(from, span);
  const [mode, setMode] = useState<BoardMode>(() => {
    const v = load(MODE_KEY);
    return v === "shifts" || v === "positions" ? v : "employees";
  });
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState("");
  const [paint, setPaint] = useState("");
  const [assignOpen, setAssignOpen] = useState(
    () =>
      typeof window === "undefined" ||
      !window.matchMedia ||
      window.matchMedia("(min-width: 1280px)").matches,
  );
  const [extraRows, setExtraRows] = useState<string[]>([]);
  const [selected, setSelected] = useState<RosterShift | null>(null);
  const [reason, setReason] = useState("");
  const [publishNote, setPublishNote] = useState("");
  // Conflitos/avisos da última operação: `retry` repete-a com confirmação (null = só informar).
  const [problem, setProblem] = useState<{
    kind: "confirm" | "blocked";
    violations: Violation[];
    retry: (() => void) | null;
    confirmLabel?: string;
  } | null>(null);
  // Painel «Ver conflitos»: da última operação ou da verificação da semana.
  const [conflictsOf, setConflictsOf] = useState<"problem" | "check" | null>(null);
  // Turno a abrir depois de navegar a partir de um conflito (escala/semana podem mudar primeiro).
  const [focus, setFocus] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<
    "new" | "bulk" | "history" | "add" | null
  >(null);

  const list = useQuery({
    queryKey: [...KEY, "list"],
    queryFn: () => rosters.listRosters(),
  });
  const active = (list.data ?? []).filter((r) => !r.archived);
  const rosterId = active.some((r) => r.id === chosen)
    ? chosen
    : (active[0]?.id ?? "");
  const roster = active.find((r) => r.id === rosterId);
  const templates = useQuery({
    queryKey: [...KEY, "templates"],
    queryFn: () => rosters.listTemplates(),
  });
  const employees = useQuery({
    queryKey: ["novo-rh", "settings", "employees"],
    queryFn: () => settings.listEmployees(),
  });
  const persons = useQuery({
    queryKey: ["novo-rh", "people", "active", ""],
    queryFn: () => people.list({ status: "active" }),
  });
  const positions = useQuery({
    queryKey: ["novo-rh", "catalog", "positions"],
    queryFn: () => people.listPositions(),
  });
  const shifts = useQuery({
    queryKey: [...KEY, "shifts", rosterId, from, span],
    queryFn: () => rosters.listShifts(rosterId, from, to),
    enabled: !!rosterId,
  });
  const history = useQuery({
    queryKey: [...KEY, "history", rosterId],
    queryFn: () => rosters.history(rosterId),
    enabled: !!rosterId && drawer === "history",
  });
  // Verificação do período visível (o mesmo que se publica); refaz-se a cada alteração.
  const check = useQuery({
    queryKey: [...KEY, "check", rosterId, from, span, shifts.dataUpdatedAt],
    queryFn: () => rosters.check(rosterId, { from, to }),
    enabled: !!rosterId && !!shifts.data,
  });
  const name = (id: string) =>
    employees.data?.find((e) => e.id === id)?.label ?? id;
  const tpls = (templates.data ?? []).filter((x) => !x.archived);
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });
  const positionName = (id: string | null) =>
    id ? (positions.data?.find((p) => p.id === id)?.name ?? null) : null;
  const peopleIndex = useMemo(
    () =>
      (employees.data ?? []).map((e) => ({
        id: e.id,
        label: e.label,
        photoUrl: e.photoUrl ?? null,
        positionId:
          persons.data?.find((p) => p.id === e.id)?.positionId ?? null,
      })),
    [employees.data, persons.data],
  );
  const rows = useMemo(
    () =>
      rosterRows(shifts.data?.shifts ?? [], extraRows, peopleIndex, tpls, {
        search,
        sort,
      }),
    [shifts.data, extraRows, peopleIndex, tpls, search, sort],
  );
  // Quem está na escala (sem o filtro da pesquisa): quem a pesquisa esconde não passa a «por adicionar».
  const inRoster = useMemo(
    () => new Set(rosterRows(shifts.data?.shifts ?? [], extraRows, peopleIndex, tpls, { search: "", sort }).map((r) => r.employeeId)),
    [shifts.data, extraRows, peopleIndex, tpls, sort],
  );
  const hidden = search.trim() ? inRoster.size - rows.length : 0;
  const locationOptions = useQuery({
    queryKey: ["novo-rh", "settings", "locations"],
    queryFn: () => settings.listLocations(),
  });
  const locationName = (id: string | null) => (id ? (locationOptions.data?.find((l) => l.id === id)?.label ?? null) : null);
  const pickerPeople = useMemo(
    () =>
      (employees.data ?? []).map((e) => ({
        id: e.id,
        name: e.label,
        photoUrl: e.photoUrl ?? null,
        primaryLocationId: persons.data?.find((p) => p.id === e.id)?.primaryLocationId ?? null,
      })),
    [employees.data, persons.data],
  );
  const addPeople = (ids: string[]) => setExtraRows((cur) => [...cur, ...ids.filter((id) => !cur.includes(id))]);
  const rosterLabel = roster ? (roster.targetType === "location" ? (locationName(roster.targetId) ?? roster.name) : roster.name) : "";
  const person = (id: string) => {
    const e = employees.data?.find((x) => x.id === id);
    return { name: e?.label ?? id, photoUrl: e?.photoUrl ?? null };
  };
  // Ordem das linhas como aparecem (em "Cargos", agrupadas por cargo).
  const order =
    mode === "positions"
      ? [...rows]
          .map((r, i) => ({ r, i, g: positionName(r.positionId) ?? "Sem cargo" }))
          .sort((a, b) => a.g.localeCompare(b.g, "pt") || a.i - b.i)
          .map((x) => x.r.employeeId)
      : rows.map((r) => r.employeeId);
  const occupied = useMemo(
    () =>
      new Set(
        (shifts.data?.shifts ?? [])
          .filter((s) => !s.deleted)
          .map(cellKey),
      ),
    [shifts.data],
  );
  const edits = useEditHistory({ rosterId, refresh });
  // Turnos «a guardar» (otimistas): entram já na grelha; o servidor responde depois.
  const shiftsKey = [...KEY, "shifts", rosterId, from, span];
  const optimistic = {
    add: (inputs: ShiftInput[]) => {
      const ids = inputs.map(() => `tmp-${crypto.randomUUID()}`);
      qc.setQueryData(shiftsKey, (old: Awaited<ReturnType<typeof rosters.listShifts>> | undefined) => {
        if (!old) return old;
        const temps: RosterShift[] = inputs.map((i, n) => ({
          id: ids[n]!,
          rosterId,
          employeeId: i.employeeId,
          workDate: i.workDate,
          kind: i.kind,
          segments: i.kind === "shift" ? (tpls.find((x) => x.id === i.templateId)?.segments ?? i.segments) : [],
          templateId: i.templateId,
          onCall: false,
          deleted: false,
          dirty: true,
          published: null,
          publishedVersion: null,
        }));
        return { ...old, pending: old.pending + temps.length, shifts: [...old.shifts, ...temps] };
      });
      return ids;
    },
    remove: (ids: string[]) =>
      qc.setQueryData(shiftsKey, (old: Awaited<ReturnType<typeof rosters.listShifts>> | undefined) => (old ? { ...old, shifts: old.shifts.filter((s) => !ids.includes(s.id)) } : old)),
  };
  const [waitSaving, setWaitSaving] = useState(false);
  const editing = useRosterEditing({
    rosterId,
    from,
    to,
    record: edits.record,
    enabled: !!rosterId && mode !== "shifts",
    people: order,
    days,
    occupied,
    paint,
    openShift: selected,
    shiftTitle: (s) =>
      `${name(s.employeeId)} · ${cellLabel(s, tpls)} · ${s.workDate}`,
    // Avisos de turnos já criados: só informam (não há nada a «publicar mesmo assim»).
    onWarnings: (v) => setProblem({ kind: "confirm", violations: v, retry: null }),
    onConfirm: (v, retry) => setProblem({ kind: "confirm", violations: v, retry, confirmLabel: "Confirmar" }),
    onBlocked: (v) => setProblem({ kind: "blocked", violations: v, retry: null }),
    optimistic,
    refresh,
  });
  const [moveReason, setMoveReason] = useState("");
  const [clearFor, setClearFor] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  /** Turnos pendentes (nunca publicados) de cada pessoa no período visível. */
  const pendingOf = (employeeId: string) =>
    (shifts.data?.shifts ?? []).filter(
      (s) => s.employeeId === employeeId && !s.deleted && s.published === null && s.workDate >= from && s.workDate <= to,
    );
  const clearWeek = async () => {
    if (!clearFor || clearing) return;
    setClearing(true);
    try {
      const { removed } = await rosters.clearPending(rosterId, { employeeId: clearFor, from, to });
      edits.record({ type: "CLEAR_EMPLOYEE_WEEK", affectedIds: removed.map((r) => r.id), inversePayload: { employeeId: clearFor, from, to } });
    } finally {
      setClearing(false);
      setClearFor(null);
      await refresh();
    }
  };

  useEffect(() => {
    if (waitSaving && editing.saving === 0) setWaitSaving(false);
  }, [waitSaving, editing.saving]);
  // Mudar de escala ou de período: nova sessão de edição (sem histórico nem modelo escolhido).
  useEffect(() => {
    edits.reset();
    setPaint("");
    // O aviso da última operação era desse período: não fica de pé noutra semana.
    setProblem(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterId, from, span]);
  // Depois de navegar a partir de um conflito: abre o turno quando a semana certa carregar.
  const [focusOpened, setFocusOpened] = useState(false);
  useEffect(() => {
    if (!focus || focusOpened || !shifts.data) return;
    const hit = shifts.data.shifts.find((s) => s.id === focus);
    if (hit) {
      setReason("");
      setSelected(hit);
      setFocusOpened(true);
    }
  }, [focus, focusOpened, shifts.data]);
  // Fechou a edição do turno aberto a partir do conflito: acaba o destaque.
  useEffect(() => {
    if (focusOpened && !selected) {
      setFocus(null);
      setFocusOpened(false);
    }
  }, [focusOpened, selected]);
  /** Abre um conflito: escala e semana certas, turno destacado e em edição. */
  const openConflict = (v: Violation, which: "self" | "other") => {
    const target = conflictTarget(v, which, rosterId);
    setConflictsOf(null);
    if (target.rosterId !== rosterId && active.some((r) => r.id === target.rosterId)) {
      setChosen(target.rosterId);
      save(ROSTER_KEY, target.rosterId);
      setExtraRows([]);
    }
    if (target.weekFrom < from || target.weekFrom > to) setFrom(target.weekFrom);
    setFocusOpened(false);
    setFocus(target.shiftId);
  };
  useEffect(() => {
    if (!rosterId) return;
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.set("escala", rosterId);
        next.set("semana", from);
        return next;
      },
      { replace: true },
    );
  }, [rosterId, from, setParams]);
  // Esc cancela o modo de atribuição.
  useEffect(() => {
    if (!paint) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPaint("");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paint]);

  /** Corre uma ação que pode devolver avisos (409) ou bloqueios (422); "Publicar mesmo assim" repete com confirmação. */
  const guarded = async (
    action: (opts: PublishOptions) => Promise<unknown>,
    opts: PublishOptions,
    confirmLabel = "Confirmar",
  ) => {
    setProblem(null);
    try {
      await action(opts);
      await refresh();
      return true;
    } catch (e) {
      const v = violationsOf(e);
      if (!v) throw e;
      setProblem({
        ...v,
        // Bloqueios não se confirmam: corrige-se e tenta-se de novo.
        retry: v.kind === "confirm" ? () => void guarded(action, { ...opts, confirm: true }, confirmLabel) : null,
        confirmLabel,
      });
      return false;
    }
  };

  const add = useMutation({
    mutationFn: (v: { employeeId: string; workDate: string }) =>
      rosters.addShift(rosterId, {
        employeeId: v.employeeId,
        workDate: v.workDate,
        kind: paint === "day_off" ? "day_off" : "shift",
        templateId: paint === "day_off" ? null : paint,
        segments: [],
      }),
    onMutate: () => setProblem(null),
    onSuccess: (r) => {
      if (r.warnings.length) setProblem({ kind: "confirm", violations: r.warnings, retry: null });
      return refresh();
    },
    // Sobreposição (ou outra regra obrigatória): aviso junto à operação, com o turno incompatível.
    onError: (e) => {
      const v = violationsOf(e);
      if (v) setProblem({ ...v, retry: null });
    },
  });
  const change = useMutation({
    mutationFn: (s: RosterShift) =>
      guarded(
        (o) =>
          rosters.updateShift(
            s.id,
            paint === "day_off"
              ? { kind: "day_off" }
              : { kind: "shift", templateId: paint },
            o,
          ),
        { reason: reason.trim() || null, confirm: false },
      ),
    onSuccess: (ok) => ok && (setSelected(null), setReason("")),
  });
  const remove = useMutation({
    mutationFn: (s: RosterShift) =>
      guarded((o) => rosters.deleteShift(s.id, o), {
        reason: reason.trim() || null,
        confirm: false,
      }),
    onSuccess: (ok) => ok && (setSelected(null), setReason("")),
  });
  const publish = useMutation({
    mutationFn: () =>
      // Publicação concluída = novo ponto de partida: o histórico de edição limpa-se.
      // Publica só o período visível: problemas de outras semanas não bloqueiam esta.
      guarded((o) => rosters.publish(rosterId, o).then((r) => (edits.reset(), r)), {
        reason: publishNote.trim() || null,
        confirm: false,
        from,
        to,
      }, t("ros.publish.confirm")),
  });

  // Pendentes do período visível (é o que «Publicar» publica).
  const pending = check.data?.pending ?? (shifts.data?.shifts ?? []).filter((s) => s.dirty && s.workDate >= from && s.workDate <= to).length;
  const warnings = useMemo(() => check.data?.violations ?? [], [check.data]);
  const conflictIds = useMemo(() => conflictShiftIds([...warnings, ...(problem?.violations ?? [])]), [warnings, problem]);
  const exportCsv = () => {
    const cell = (v: string) => (/^[=+\-@]/.test(v) ? `'${v}` : v);
    const lines = [
      ["Colaborador", ...days].join(";"),
      ...rows.map((r) =>
        [
          cell(r.name),
          ...days.map((d) =>
            (r.byDate.get(d) ?? []).map((s) => cellLabel(s, tpls)).join(" "),
          ),
        ].join(";"),
      ),
    ];
    downloadBlob(
      new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }),
      `escala-${roster?.name ?? "escala"}-${from}.csv`.replace(
        /[^\w.-]+/g,
        "_",
      ),
    );
  };
  const iconBtn = "h-8 w-7 rounded-lg";
  const painting = !!paint;
  const paintName =
    paint === "day_off"
      ? t("ros.dayOff")
      : tpls.find((x) => x.id === paint)?.name;

  const summary = (
    <>
      <span className="flex items-center gap-2">
        <IconUsers size={16} className="text-brand-600" />
        <span>{t("ros.board.assigned", { count: rows.length })}</span>
        {painting && (
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-600">
            {t("ros.board.painting", { name: paintName ?? "" })}
          </span>
        )}
      </span>
      {editing.saving > 0 && (
        <span role="status" className="inline-flex items-center gap-1.5 rounded-full bg-surface-soft px-3 py-1 text-xs font-medium text-ink-secondary">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand-500 motion-safe:animate-pulse" /> A guardar {editing.saving}…
        </span>
      )}
      {pending > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{" "}
          {t("ros.board.toPublish", { count: pending })}
        </span>
      ) : rows.length > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{" "}
          {t("ros.board.published")}
        </span>
      ) : null}
    </>
  );

  return (
    <div className="space-y-6">
      <div className="relative z-30 motion-safe:animate-motion-fade-up [animation-delay:30ms]">
        <SearchableSelect
          label={t("ros.roster")}
          icon={<IconStore size={20} />}
          value={rosterId}
          options={active.map((r) => ({ id: r.id, label: r.name }))}
          onChange={(id) => {
            setChosen(id);
            save(ROSTER_KEY, id);
            setExtraRows([]);
            setSelected(null);
          }}
          triggerClassName="h-12 min-w-[246px]"
        />
      </div>

      <Toolbar label={t("ros.toolbar")}>
        <SegmentedControl
          label={t("ros.board.groupBy")}
          value={mode}
          onChange={(m) => {
            setMode(m);
            save(MODE_KEY, m);
          }}
          items={[
            {
              key: "employees",
              label: (
                <span className={mode === "employees" ? "text-brand-600" : ""}>
                  {t("ros.board.employees")}
                </span>
              ),
            },
            {
              key: "shifts",
              label: (
                <span className={mode === "shifts" ? "text-brand-600" : ""}>
                  {t("ros.board.shifts")}
                </span>
              ),
            },
            {
              key: "positions",
              label: (
                <span className={mode === "positions" ? "text-brand-600" : ""}>
                  {t("ros.board.positions")}
                </span>
              ),
            },
          ]}
        />
        <Button
          className="ml-1 bg-surface-card"
          onClick={() => setFrom(weekOf(today).from)}
        >
          {t("ros.today")}
        </Button>
        <DateNavigator
          label={rangeLabel(from, to)}
          onPrev={() => setFrom(plus(from, -7))}
          onNext={() => setFrom(plus(from, 7))}
          prevLabel={t("ros.prevWeek")}
          nextLabel={t("ros.nextWeek")}
        />
        <ToolbarGroup>
          {searching ? (
            <div className="relative motion-safe:animate-motion-fade">
              <IconSearch
                size={16}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                autoFocus
                type="search"
                aria-label={t("ros.board.search")}
                placeholder={`${t("ros.board.search")}…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => !search && setSearching(false)}
                onKeyDown={(e) =>
                  e.key === "Escape" && (setSearch(""), setSearching(false))
                }
                className="h-9 w-48 rounded-lg bg-transparent pl-8 pr-2 text-sm text-ink outline-none placeholder:text-ink-muted"
              />
            </div>
          ) : (
            <IconButton
              label={t("ros.board.search")}
              className={iconBtn}
              onClick={() => setSearching(true)}
            >
              <IconSearch size={18} />
            </IconButton>
          )}
          <Popover
            label={t("ros.board.view")}
            width="w-64"
            trigger={({ open, toggle }) => (
              <IconButton
                label={t("ros.board.view")}
                className={`${iconBtn} ${open || span === 14 ? "text-brand-600" : ""}`}
                onClick={toggle}
                aria-expanded={open}
              >
                <IconSliders size={18} />
              </IconButton>
            )}
          >
            {() => (
              <div className="p-2.5">
                <span className={LABEL}>{t("ros.board.period")}</span>
                <SegmentedControl
                  label={t("ros.board.period")}
                  size="sm"
                  value={String(span) as "7" | "14"}
                  onChange={(v) => setSpan(v === "14" ? 14 : 7)}
                  items={[
                    { key: "7", label: t("ros.board.week") },
                    { key: "14", label: t("ros.board.twoWeeks") },
                  ]}
                />
              </div>
            )}
          </Popover>
        </ToolbarGroup>

        <div className="hidden items-center gap-0.5 lg:flex">
          <ToolbarDivider />
          <IconButton label={t("ros.board.undo")} className={iconBtn} disabled={!edits.canUndo} onClick={edits.undo}>
            <IconUndo size={18} />
          </IconButton>
          <IconButton label={t("ros.board.redo")} className={iconBtn} disabled={!edits.canRedo} onClick={edits.redo}>
            <IconRedo size={18} />
          </IconButton>
          <ToolbarDivider />
          <AddEmployeesPicker
            rosterId={rosterId}
            rosterLabel={rosterLabel}
            from={from}
            to={to}
            people={pickerPeople}
            inRoster={inRoster}
            locationName={locationName}
            onAdd={addPeople}
            trigger={({ open, toggle }) => (
              <IconButton
                label={t("ros.addEmployee")}
                className={`${iconBtn} text-navy-900`}
                onClick={toggle}
                aria-expanded={open}
                disabled={!rosterId}
              >
                <IconUserPlus size={18} />
              </IconButton>
            )}
          />
          <IconButton
            label={t("ros.board.export")}
            className={`${iconBtn} text-navy-900`}
            onClick={exportCsv}
            disabled={!rosterId}
          >
            <IconDownload size={18} />
          </IconButton>
          <IconButton
            label={t("ros.bulk")}
            className={`${iconBtn} text-navy-900`}
            onClick={() => setDrawer("bulk")}
            disabled={!rosterId}
          >
            <IconCopy size={18} />
          </IconButton>
          <IconButton
            label={t("ros.history")}
            className={`${iconBtn} text-navy-900`}
            onClick={() => setDrawer("history")}
            disabled={!rosterId}
          >
            <IconEye size={18} />
          </IconButton>
        </div>
        <Popover
          label={t("ros.warnings")}
          align="right"
          width="w-80"
          trigger={({ open, toggle }) => (
            <span className="relative inline-flex">
              <IconButton
                label={
                  warnings.length
                    ? t("ros.board.warningsCount", { count: warnings.length })
                    : t("ros.board.noWarnings")
                }
                className={`${iconBtn} ${warnings.length ? "text-red-600" : "text-navy-900"}`}
                onClick={toggle}
                aria-expanded={open}
              >
                <IconAlert size={18} />
              </IconButton>
              {warnings.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">
                  {warnings.length}
                </span>
              )}
            </span>
          )}
        >
          {(close) => {
            if (!warnings.length) return <p className="px-3 py-4 text-sm text-ink-secondary">{t("ros.board.noWarnings")}</p>;
            const s = conflictSummary(warnings);
            return (
              <div className="space-y-2 p-2.5 text-sm">
                <p className="font-semibold text-navy-900">
                  {s.total} {s.total === 1 ? "problema encontrado" : "problemas encontrados"}
                  {s.blocking > 0 && <span className="font-normal text-red-700"> · {s.blocking} {s.blocking === 1 ? "bloqueia" : "bloqueiam"} a publicação</span>}
                </p>
                <p className="text-xs text-ink-secondary">
                  {s.employees} {s.employees === 1 ? "colaborador afetado" : "colaboradores afetados"} · {weekLabel(from)}
                  {span === 14 && ` e seguinte`}
                </p>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    close();
                    setConflictsOf("check");
                  }}
                >
                  Ver conflitos
                </Button>
              </div>
            );
          }}
        </Popover>

        <div className="flex w-full items-center gap-1.5 sm:ml-auto sm:w-auto">
          <div className="flex-1 sm:flex-none">
            <DropdownMenu
              label={t("ros.board.add")}
              items={[
                {
                  label: t("ros.assign.title"),
                  icon: <IconLayers size={16} />,
                  onSelect: () => setAssignOpen(true),
                },
                {
                  label: t("ros.addEmployee"),
                  icon: <IconUserPlus size={16} />,
                  disabled: !rosterId,
                  onSelect: () => setDrawer("add"),
                },
                {
                  label: t("ros.bulk"),
                  icon: <IconCopy size={16} />,
                  disabled: !rosterId,
                  onSelect: () => setDrawer("bulk"),
                },
                {
                  label: t("ros.roster.new"),
                  icon: <IconPlus size={16} />,
                  onSelect: () => setDrawer("new"),
                },
                "separator",
                {
                  label: t("ros.tab.templates"),
                  icon: <IconLayers size={16} />,
                  onSelect: onOpenTemplates,
                },
                {
                  label: t("ros.tab.swaps"),
                  icon: <IconUsers size={16} />,
                  onSelect: onOpenSwaps,
                },
                {
                  label: t("ros.tab.mine"),
                  icon: <IconEye size={16} />,
                  onSelect: onOpenMine,
                },
                "separator",
                {
                  label: t("ros.board.export"),
                  icon: <IconDownload size={16} />,
                  disabled: !rosterId,
                  onSelect: exportCsv,
                },
                {
                  label: t("ros.history"),
                  icon: <IconEye size={16} />,
                  disabled: !rosterId,
                  onSelect: () => setDrawer("history"),
                },
              ]}
              trigger={({ open, toggle }) => (
                <Button
                  onClick={toggle}
                  aria-expanded={open}
                  aria-haspopup="menu"
                  className="w-full bg-surface-card sm:w-auto"
                >
                  {t("ros.board.add")}
                  <IconChevronDown
                    size={16}
                    className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                  />
                </Button>
              )}
            />
          </div>
          <Popover
            label={t("ros.publish")}
            align="right"
            width="w-80"
            trigger={({ open, toggle }) => (
              <Button
                id={PUBLISH_TRIGGER_ID}
                variant="primary"
                className="flex-1 px-5 sm:flex-none"
                onClick={toggle}
                aria-expanded={open}
                disabled={!rosterId}
              >
                {t("ros.publish")}
              </Button>
            )}
          >
            {(close) => (
              <div className="space-y-3 p-2.5">
                <p className="text-sm text-ink">
                  {t("ros.pending", { count: pending })}
                </p>
                <label className="block">
                  <span className={LABEL}>{t("ros.publish.reason")}</span>
                  <input
                    className={`${FIELD} w-full`}
                    value={publishNote}
                    onChange={(e) => setPublishNote(e.target.value)}
                  />
                </label>
                <Button
                  variant="primary"
                  className="w-full"
                  loading={publish.isPending}
                  disabled={pending === 0}
                  onClick={() => {
                    close();
                    // Ainda há turnos a guardar: publica-se quando terminarem (sem perder nenhum).
                    if (editing.saving > 0) {
                      setWaitSaving(true);
                      return;
                    }
                    publish.mutate();
                  }}
                >
                  {t("ros.publish.now")}
                </Button>
              </div>
            )}
          </Popover>
        </div>
      </Toolbar>

      {problem && (
        <ConflictNotice
          kind={problem.kind}
          violations={problem.violations}
          name={name}
          onView={() => setConflictsOf("problem")}
          onOpenOther={(v) => openConflict(v, "other")}
          onConfirm={problem.retry}
          confirmLabel={problem.confirmLabel ?? "Confirmar"}
          onDismiss={() => setProblem(null)}
        />
      )}
      {waitSaving && editing.saving > 0 && (
        <AlertBanner tone="info" title={`Aguarde: ${editing.saving === 1 ? "ainda há 1 turno" : `ainda há ${editing.saving} turnos`} a guardar.`}>
          <p>Pode continuar a trabalhar; publique quando terminar.</p>
        </AlertBanner>
      )}
      {publish.isError && (
        <AlertBanner
          tone="danger"
          title={message(publish.error, t("common.error"))}
        />
      )}
      {add.isError && !violationsOf(add.error) && (
        <AlertBanner
          tone="danger"
          title={message(add.error, t("common.error"))}
        />
      )}
      {edits.message && (
        <AlertBanner
          tone="warning"
          title={edits.message}
          action={
            <Button size="sm" variant="tertiary" onClick={edits.dismiss}>
              {t("ros.edit.ok")}
            </Button>
          }
        />
      )}
      {editing.failures.length > 0 && (
        <AlertBanner tone="danger" title={t("ros.edit.failed", { count: editing.failures.length })}>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {editing.failures.map((f, i) => (
              <li key={i}>
                {name(f.cell.employeeId)}, {f.cell.workDate}: {f.message}
              </li>
            ))}
          </ul>
        </AlertBanner>
      )}
      {rosterId && mode !== "shifts" && (editing.selectedCount > 0 || editing.notice || editing.busy) && createPortal(
        <div className="ds pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4 font-sans">
        <div
          role="status"
          className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface-card px-4 py-2.5 text-sm text-ink shadow-pop motion-safe:animate-motion-fade-up"
        >
          {editing.busy ? (
            <span className="text-ink-secondary">{t("ros.edit.working")}</span>
          ) : editing.selectedCount > 0 ? (
            <>
              <span className="font-medium text-navy-900">
                {t("ros.edit.selected", { count: editing.selectedCount })}
              </span>
              {editing.clipboard && (
                <Button size="sm" variant="primary" icon={<IconCopy size={14} />} onClick={() => void editing.paste()}>
                  {t("ros.edit.paste")}
                </Button>
              )}
              {paint && (
                <Button size="sm" onClick={() => void editing.paintSelection()}>
                  {t("ros.edit.assign", { name: paintName ?? "" })}
                </Button>
              )}
              {!editing.clipboard && !paint && (
                <span className="text-ink-secondary">{t("ros.edit.hint")}</span>
              )}
              <Button size="sm" variant="tertiary" onClick={editing.clearSelection}>
                {t("ros.edit.clear")}
              </Button>
            </>
          ) : (
            <>
              <span>{editing.notice}</span>
              <Button size="sm" variant="tertiary" onClick={editing.dismissNotice}>
                {t("ros.edit.ok")}
              </Button>
            </>
          )}
        </div>
        </div>,
        document.body,
      )}

      <div className="flex items-start">
        <div className="min-w-0 flex-1">
          {rosterId ? (
            <RosterBoard
              mode={mode}
              days={days}
              today={today}
              rows={rows}
              shifts={shifts.data?.shifts ?? []}
              templates={tpls}
              loading={shifts.isLoading}
              sort={sort}
              onToggleSort={() =>
                setSort((s) => (s === "asc" ? "desc" : "asc"))
              }
              positionName={positionName}
              person={person}
              hidden={hidden}
              painting={painting && !add.isPending}
              onOpen={(s) => {
                // Turno ainda a guardar: abre-se quando o servidor responder.
                if (s.id.startsWith("tmp-")) return;
                setReason("");
                setSelected(s);
              }}
              onPaint={(employeeId, workDate) =>
                add.mutate({ employeeId, workDate })
              }
              summary={summary}
              edit={mode !== "shifts" ? editing.edit : undefined}
              rowActions={{
                pending: (id) => pendingOf(id).length,
                onClearWeek: setClearFor,
                period: span === 7 ? "week" : "period",
              }}
              conflictIds={conflictIds}
              focusId={selected ? focus : null}
            />
          ) : list.isLoading ? (
            <div className="h-96 animate-pulse rounded-2.5xl bg-surface-card motion-reduce:animate-none" />
          ) : (
            <section
              aria-label="Escala"
              className="rounded-2.5xl border border-line bg-surface-card shadow-card motion-safe:animate-motion-fade-up"
            >
              {list.isError ? (
                <EmptyState
                  icon={<IconCalendar size={22} />}
                  title={t("ros.board.loadError")}
                  description={message(list.error, t("common.error"))}
                  action={
                    <Button onClick={() => void list.refetch()}>
                      {t("ros.board.retry")}
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<IconCalendar size={22} />}
                  title={t("ros.board.noRostersTitle")}
                  description={t("ros.board.noRostersText")}
                  action={
                    <Button
                      variant="primary"
                      icon={<IconPlus size={16} />}
                      onClick={() => setDrawer("new")}
                    >
                      {t("ros.roster.new")}
                    </Button>
                  }
                />
              )}
            </section>
          )}
        </div>
        {assignOpen && rosterId && (
          <AssignPanel
            templates={templates.data ?? []}
            loading={templates.isLoading}
            value={paint}
            onChange={setPaint}
            onCreate={onOpenTemplates}
            onSettings={onOpenTemplates}
            onClose={() => {
              setAssignOpen(false);
              setPaint("");
            }}
          />
        )}
      </div>

      {/* Limpar os turnos pendentes da semana de uma pessoa (uma só operação; pode desfazer-se). */}
      <Dialog
        open={!!clearFor}
        title={span === 7 ? t("ros.clear.titleWeek") : t("ros.clear.titlePeriod")}
        description={
          clearFor &&
          t("ros.clear.body", {
            count: pendingOf(clearFor).length,
            name: name(clearFor),
            from: `${from.slice(8, 10)}/${from.slice(5, 7)}`,
            to: `${to.slice(8, 10)}/${to.slice(5, 7)}`,
          })
        }
        onClose={() => setClearFor(null)}
        actions={
          <>
            <Button variant="tertiary" onClick={() => setClearFor(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" loading={clearing} disabled={clearing} onClick={() => void clearWeek()}>
              {t("ros.clear.confirm")}
            </Button>
          </>
        }
      />

      {paint && assignOpen && (
        <PlacementPreview
          tone={paint === "day_off" ? null : (tpls.find((x) => x.id === paint) ?? null)}
          label={paintName ?? ""}
        />
      )}

      {/* Mover um turno já publicado: o motivo é obrigatório (a escolha Mover/Copiar aparece na própria grelha). */}
      <Dialog
        open={editing.askReason && !!editing.prompt}
        title={
          editing.prompt
            ? t("ros.edit.dropTitle", {
                shift: cellLabel(editing.prompt.source, tpls),
                name: name(editing.prompt.source.employeeId),
              })
            : ""
        }
        description={
          editing.prompt?.targets[0] &&
          t("ros.edit.moveTo", {
            name: name(editing.prompt.targets[0].employeeId),
            date: editing.prompt.targets[0].workDate,
          })
        }
        onClose={() => {
          editing.closePrompt();
          setMoveReason("");
        }}
        actions={
          <>
            <Button
              variant="tertiary"
              onClick={() => {
                editing.closePrompt();
                setMoveReason("");
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              disabled={!moveReason.trim()}
              onClick={() => {
                void editing.movePrompt(moveReason.trim());
                setMoveReason("");
              }}
            >
              {t("ros.edit.move")}
            </Button>
          </>
        }
      >
        <label className="block">
          <span className={LABEL}>{t("ros.edit.moveReason")}</span>
          <input
            className={`${FIELD} w-full`}
            value={moveReason}
            onChange={(e) => setMoveReason(e.target.value)}
          />
        </label>
      </Dialog>

      {/* Turno escolhido: alterar para o modelo selecionado ou remover (motivo se já publicado). */}
      <Drawer
        open={!!selected}
        title={
          selected
            ? t("ros.selected", {
                name: name(selected.employeeId),
                date: selected.workDate,
              })
            : ""
        }
        description={
          selected?.published
            ? t("ros.board.publishedHint")
            : t("ros.board.draftHint")
        }
        onClose={() => setSelected(null)}
        footer={
          selected && (
            <>
              <Button
                variant="danger"
                disabled={
                  remove.isPending || (!!selected.published && !reason.trim())
                }
                onClick={() => remove.mutate(selected)}
              >
                {t("ros.remove")}
              </Button>
              <Button
                variant="primary"
                disabled={
                  !paint ||
                  change.isPending ||
                  (!!selected.published && !reason.trim())
                }
                onClick={() => change.mutate(selected)}
              >
                {t("ros.change")}
              </Button>
            </>
          )
        }
      >
        {selected && (
          <>
            <p className="text-sm text-ink">
              {t("ros.board.current")}:{" "}
              <strong>{cellLabel(selected, tpls)}</strong>
              {paint ? ` → ${paintName}` : ""}
            </p>
            {!paint && (
              <p className="text-sm text-ink-secondary">
                {t("ros.board.pickFirst")}
              </p>
            )}
            {selected.published && (
              <label className="block">
                <span className={LABEL}>{t("ros.reason")}</span>
                <input
                  className={`${FIELD} w-full`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}
            {(change.isError || remove.isError) && (
              <p className="text-sm text-red-700">
                {message(change.error ?? remove.error, t("common.error"))}
              </p>
            )}
          </>
        )}
      </Drawer>

      <NewRosterDrawer
        open={drawer === "new"}
        onClose={() => setDrawer(null)}
        onCreated={(id) => {
          setChosen(id);
          save(ROSTER_KEY, id);
          setDrawer(null);
        }}
        locations={settings}
        structure={structure}
      />

      <Drawer
        open={drawer === "add"}
        title={t("ros.addEmployee")}
        onClose={() => setDrawer(null)}
      >
        {drawer === "add" && (
          <AddEmployeesBody
            rosterId={rosterId}
            rosterLabel={rosterLabel}
            from={from}
            to={to}
            people={pickerPeople}
            inRoster={inRoster}
            locationName={locationName}
            onAdd={addPeople}
            onClose={() => setDrawer(null)}
          />
        )}
      </Drawer>

      <ConflictsDrawer
        open={!!conflictsOf}
        title={conflictsOf === "check" ? "Conflitos da escala" : problem?.kind === "blocked" ? "Conflitos encontrados" : "Avisos de restrições"}
        violations={conflictsOf === "check" ? warnings : (problem?.violations ?? [])}
        name={name}
        currentRosterName={roster?.name ?? ""}
        onClose={() => setConflictsOf(null)}
        onOpenShift={openConflict}
        confirm={
          conflictsOf === "problem" && problem?.retry
            ? { label: problem.confirmLabel ?? "Confirmar", onConfirm: () => (setConflictsOf(null), problem.retry!()) }
            : null
        }
      />

      <Drawer
        open={drawer === "bulk"}
        title={t("ros.bulk")}
        onClose={() => setDrawer(null)}
        width="max-w-lg"
      >
        {rosterId && (
          <BulkAssign rosterId={rosterId} defaultFrom={from} defaultTo={to} />
        )}
      </Drawer>

      <Drawer
        open={drawer === "history"}
        title={t("ros.history")}
        onClose={() => setDrawer(null)}
      >
        {history.data?.length === 0 && (
          <p className="text-sm text-ink-secondary">
            {t("ros.board.noHistory")}
          </p>
        )}
        <ul className="space-y-2 text-sm text-ink">
          {(history.data ?? []).map((h) => (
            <li key={h.id} className="rounded-xl border border-line-subtle p-3">
              {t("ros.history.row", {
                version: h.version,
                date: h.createdAt.slice(0, 10),
                by: h.publishedBy,
                count: h.changes.length,
              })}
              {h.reason && (
                <span className="block text-ink-secondary">{h.reason}</span>
              )}
            </li>
          ))}
        </ul>
      </Drawer>
      {rosterId && roster && (
        <MezzaAssistantButton
          context={{ rosterId, rosterName: roster.name, from, to, pending }}
          onApplied={(a) => {
            // O que a IA fez entra no mesmo Desfazer/Refazer das ações manuais.
            const op = aiBatchOp(a);
            if (op) edits.record(op);
            void refresh();
          }}
          onTemplatesChanged={() => void qc.invalidateQueries({ queryKey: [...KEY, "templates"] })}
          onPublishFlow={() => {
            // A IA nunca publica: abre o fluxo de publicação de sempre.
            const b = document.getElementById(PUBLISH_TRIGGER_ID);
            b?.scrollIntoView?.({ block: "center" });
            b?.click();
          }}
        />
      )}
    </div>
  );
}

export function NewRosterDrawer({
  open,
  onClose,
  onCreated,
  locations,
  structure,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  locations: ReturnType<typeof useNovoRh>["settings"];
  structure: ReturnType<typeof useNovoRh>["structure"];
}) {
  const { t } = useI18n();
  const { rosters } = useNovoRh();
  const qc = useQueryClient();
  const locs = useQuery({
    queryKey: ["novo-rh", "settings", "locations"],
    queryFn: () => locations.listLocations(),
    enabled: open,
  });
  const groups = useQuery({
    queryKey: ["novo-rh", "structure", "groups"],
    queryFn: () => structure.listGroups(),
    enabled: open,
  });
  const [v, setV] = useState({
    name: "",
    targetType: "location" as "location" | "group",
    targetId: "",
  });
  const create = useMutation({
    mutationFn: () => rosters.createRoster(v),
    onSuccess: async (r) => {
      setV({ ...v, name: "" });
      await qc.invalidateQueries({ queryKey: KEY });
      onCreated(r.id);
    },
  });
  const targets =
    v.targetType === "location"
      ? (locs.data ?? []).map((l) => ({ id: l.id, label: l.label }))
      : (groups.data ?? []).map((g) => ({ id: g.id, label: g.name }));
  return (
    <Drawer
      open={open}
      title={t("ros.roster.new")}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          disabled={!v.name.trim() || !v.targetId || create.isPending}
          onClick={() => create.mutate()}
        >
          {t("ros.roster.new")}
        </Button>
      }
    >
      <div role="group" aria-label={t("ros.roster.new")} className="space-y-4">
        <label className="block">
          <span className={LABEL}>{t("ros.field.name")}</span>
          <input
            className={`${FIELD} w-full`}
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
        </label>
        <label className="block">
          <span className={LABEL}>{t("ros.field.targetType")}</span>
          <select
            className={`${FIELD} w-full`}
            value={v.targetType}
            onChange={(e) =>
              setV({
                ...v,
                targetType: e.target.value as "location" | "group",
                targetId: "",
              })
            }
          >
            <option value="location">{t("ros.target.location")}</option>
            <option value="group">{t("ros.target.group")}</option>
          </select>
        </label>
        <label className="block">
          <span className={LABEL}>{t("ros.field.target")}</span>
          <select
            className={`${FIELD} w-full`}
            value={v.targetId}
            onChange={(e) => setV({ ...v, targetId: e.target.value })}
          >
            <option value="">{t("common.choose")}…</option>
            {targets.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        {create.isError && (
          <p className="text-sm text-red-700">
            {message(create.error, t("common.error"))}
          </p>
        )}
      </div>
    </Drawer>
  );
}

function BulkAssign({
  rosterId,
  defaultFrom,
  defaultTo,
}: {
  rosterId: string;
  defaultFrom: string;
  defaultTo: string;
}) {
  const { t } = useI18n();
  const { rosters, settings } = useNovoRh();
  const qc = useQueryClient();
  const employees = useQuery({
    queryKey: ["novo-rh", "settings", "employees"],
    queryFn: () => settings.listEmployees(),
  });
  const templates = useQuery({
    queryKey: [...KEY, "templates"],
    queryFn: () => rosters.listTemplates(),
  });
  const [v, setV] = useState({
    employeeIds: [] as string[],
    from: defaultFrom,
    to: defaultTo,
    weekdays: ["1", "2", "3", "4", "5"],
    templateId: "",
  });
  const m = useMutation({
    mutationFn: () =>
      rosters.assignBulk(rosterId, {
        employeeIds: v.employeeIds,
        from: v.from,
        to: v.to,
        weekdays: v.weekdays,
        kind: v.templateId === "day_off" ? "day_off" : "shift",
        templateId: v.templateId === "day_off" ? null : v.templateId,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
  // Tudo ou nada: com conflitos nada é gravado — resumo antes de tentar de novo.
  const blocked = m.isError ? violationsOf(m.error) : null;
  const nameOf = (id: string) => employees.data?.find((e) => e.id === id)?.label ?? id;
  const WD = ["1", "2", "3", "4", "5", "6", "7"];
  return (
    <div className="space-y-4">
      <label className="block">
        <span className={LABEL}>{t("ros.bulk.employees")}</span>
        <select
          multiple
          className={`${FIELD} h-40 w-full py-2`}
          value={v.employeeIds}
          onChange={(e) =>
            setV({
              ...v,
              employeeIds: [...e.target.selectedOptions].map((o) => o.value),
            })
          }
        >
          {(employees.data ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={LABEL}>{t("common.from")}</span>
          <input
            type="date"
            className={`${FIELD} w-full`}
            value={v.from}
            onChange={(e) => setV({ ...v, from: e.target.value })}
          />
        </label>
        <label>
          <span className={LABEL}>{t("common.to")}</span>
          <input
            type="date"
            className={`${FIELD} w-full`}
            value={v.to}
            onChange={(e) => setV({ ...v, to: e.target.value })}
          />
        </label>
      </div>
      <fieldset className="flex flex-wrap items-center gap-2 text-sm text-ink">
        <legend className={LABEL}>{t("ros.bulk.weekdays")}</legend>
        {WD.map((d) => (
          <label key={d} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={v.weekdays.includes(d)}
              onChange={(e) =>
                setV({
                  ...v,
                  weekdays: e.target.checked
                    ? [...v.weekdays, d]
                    : v.weekdays.filter((x) => x !== d),
                })
              }
            />
            {d}
          </label>
        ))}
      </fieldset>
      <label className="block">
        <span className={LABEL}>{t("ros.tab.templates")}</span>
        <select
          className={`${FIELD} w-full`}
          value={v.templateId}
          onChange={(e) => setV({ ...v, templateId: e.target.value })}
        >
          <option value="">{t("common.choose")}…</option>
          {(templates.data ?? [])
            .filter((x) => !x.archived)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.abbreviation} · {x.name}
              </option>
            ))}
          <option value="day_off">{t("ros.dayOff")}</option>
        </select>
      </label>
      <Button
        variant="primary"
        disabled={!v.employeeIds.length || !v.templateId || m.isPending}
        onClick={() => m.mutate()}
      >
        {t("ros.bulk")}
      </Button>
      {m.data && (
        <p className="text-sm text-ink-secondary">
          {t("ros.bulk.done", { count: m.data.created })}
          {m.data.warnings.length > 0 && ` · ${m.data.warnings.length} ${m.data.warnings.length === 1 ? "aviso" : "avisos"} de restrições (ver o alerta da barra)`}
        </p>
      )}
      {blocked ? (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 text-sm text-red-800" role="alert">
          <p className="font-semibold">
            {blocked.violations.length} {blocked.violations.length === 1 ? "conflito" : "conflitos"} — nada foi gravado.
          </p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {blocked.violations.slice(0, 5).map((x, i) => (
              <li key={i}>
                {nameOf(x.employeeId)} · {x.workDate}
                {x.overlap ? ` · ${x.conflict?.rosterName ?? "outra escala"} ${x.conflict?.hours ?? ""} (sobreposição ${x.overlap})` : ` · ${x.message}`}
              </li>
            ))}
            {blocked.violations.length > 5 && <li>e mais {blocked.violations.length - 5}…</li>}
          </ul>
        </div>
      ) : (
        m.isError && (
          <p className="text-sm text-red-700">
            {message(m.error, t("common.error"))}
          </p>
        )
      )}
    </div>
  );
}
