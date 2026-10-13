import { useMemo, useState } from "react";
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
import { cellKey } from "../../../domain/services/roster-edit.service.ts";

const KEY = ["novo-rh", "rosters"];
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

/** Avisos (pedem confirmação) ou bloqueios devolvidos pela API (RE-16). */
function ViolationsBox({
  kind,
  violations,
  name,
  onConfirm,
}: {
  kind: "confirm" | "blocked";
  violations: Violation[];
  name: (id: string) => string;
  onConfirm?: () => void;
}) {
  const { t } = useI18n();
  return (
    <AlertBanner
      tone={kind === "blocked" ? "danger" : "warning"}
      title={kind === "blocked" ? t("ros.blocked") : t("ros.warnings")}
      action={
        kind === "confirm" && onConfirm ? (
          <Button size="sm" onClick={onConfirm}>
            {t("ros.publish.confirm")}
          </Button>
        ) : undefined
      }
    >
      <ul className="list-disc pl-4">
        {violations.map((v, i) => (
          <li key={i}>
            {name(v.employeeId)}: {v.message}
          </li>
        ))}
      </ul>
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
  const [chosen, setChosen] = useState(() => load(ROSTER_KEY));
  const [from, setFrom] = useState(() => weekOf(today).from);
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
  const [problem, setProblem] = useState<{
    kind: "confirm" | "blocked";
    violations: Violation[];
    retry: () => void;
  } | null>(null);
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
  const check = useQuery({
    queryKey: [...KEY, "check", rosterId, shifts.dataUpdatedAt],
    queryFn: () => rosters.check(rosterId),
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
  const hidden = useMemo(
    () =>
      search.trim()
        ? rosterRows(shifts.data?.shifts ?? [], extraRows, peopleIndex, tpls, {
            search: "",
            sort,
          }).length - rows.length
        : 0,
    [shifts.data, extraRows, peopleIndex, tpls, search, sort, rows.length],
  );
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
  const editing = useRosterEditing({
    rosterId,
    enabled: !!rosterId && mode !== "shifts",
    people: order,
    days,
    occupied,
    paint,
    openShift: selected,
    shiftTitle: (s) =>
      `${name(s.employeeId)} · ${cellLabel(s, tpls)} · ${s.workDate}`,
    onWarnings: (v) =>
      setProblem({ kind: "confirm", violations: v, retry: () => setProblem(null) }),
    onConfirm: (v, retry) => setProblem({ kind: "confirm", violations: v, retry }),
    refresh,
  });
  const [moveReason, setMoveReason] = useState("");

  /** Corre uma ação que pode devolver avisos (409) ou bloqueios (422); "Publicar mesmo assim" repete com confirmação. */
  const guarded = async (
    action: (opts: PublishOptions) => Promise<unknown>,
    opts: PublishOptions,
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
        retry: () => void guarded(action, { ...opts, confirm: true }),
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
    onSuccess: (r) => {
      if (r.warnings.length)
        setProblem({
          kind: "confirm",
          violations: r.warnings,
          retry: () => setProblem(null),
        });
      return refresh();
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
      guarded((o) => rosters.publish(rosterId, o), {
        reason: publishNote.trim() || null,
        confirm: false,
      }),
  });

  const pending = shifts.data?.pending ?? 0;
  const warnings = check.data?.violations ?? [];
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
          <IconButton label={t("ros.board.undo")} className={iconBtn} disabled>
            <IconUndo size={18} />
          </IconButton>
          <IconButton label={t("ros.board.redo")} className={iconBtn} disabled>
            <IconRedo size={18} />
          </IconButton>
          <ToolbarDivider />
          <Popover
            label={t("ros.addEmployee")}
            width="w-72"
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
          >
            {(close) => (
              <ul
                className="max-h-72 overflow-y-auto"
                aria-label={t("ros.addEmployee")}
              >
                {(employees.data ?? [])
                  .filter((e) => !rows.some((r) => r.employeeId === e.id))
                  .map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-ink hover:bg-surface-soft"
                        onClick={() => {
                          setExtraRows([...extraRows, e.id]);
                          close();
                        }}
                      >
                        {e.label}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </Popover>
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
          {() =>
            warnings.length ? (
              <ul className="max-h-80 space-y-2 overflow-y-auto p-1.5 text-sm">
                {warnings.map((v, i) => (
                  <li
                    key={i}
                    className={`rounded-xl border p-2.5 text-xs ${v.severity === "block" ? "border-red-100 bg-red-50/50" : "border-amber-100 bg-amber-50/50"}`}
                  >
                    <p className="font-semibold text-navy-900">
                      {name(v.employeeId)} · {v.workDate}
                    </p>
                    <p className="text-ink">{v.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-4 text-sm text-ink-secondary">
                {t("ros.board.noWarnings")}
              </p>
            )
          }
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
        <ViolationsBox
          kind={problem.kind}
          violations={problem.violations}
          name={name}
          onConfirm={problem.retry}
        />
      )}
      {publish.isError && (
        <AlertBanner
          tone="danger"
          title={message(publish.error, t("common.error"))}
        />
      )}
      {add.isError && (
        <AlertBanner
          tone="danger"
          title={message(add.error, t("common.error"))}
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
                setReason("");
                setSelected(s);
              }}
              onPaint={(employeeId, workDate) =>
                add.mutate({ employeeId, workDate })
              }
              summary={summary}
              edit={mode !== "shifts" ? editing.edit : undefined}
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
            onClose={() => setAssignOpen(false)}
          />
        )}
      </div>

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
        <ul className="space-y-1">
          {(employees.data ?? [])
            .filter((e) => !rows.some((r) => r.employeeId === e.id))
            .map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm text-ink hover:bg-surface-soft"
                  onClick={() => {
                    setExtraRows([...extraRows, e.id]);
                    setDrawer(null);
                  }}
                >
                  {e.label}
                </button>
              </li>
            ))}
        </ul>
      </Drawer>

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
        </p>
      )}
      {m.isError && (
        <p className="text-sm text-red-700">
          {message(m.error, t("common.error"))}
        </p>
      )}
    </div>
  );
}
