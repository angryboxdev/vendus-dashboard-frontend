import { useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import {
  Button,
  Dialog,
  DropdownMenu,
  FIELD,
  iconButtonClass,
  IconMore,
  IconPlus,
  IconTrash,
  LABEL,
  Popover,
  SECTION_TITLE,
  StatusBadge,
  ShiftTypeChip,
  SURFACE,
  TABLE,
  TD,
  TH,
  THEAD,
  TimePicker,
  TR,
} from "../../../../../components/ui/index.ts";
import type { Segment, ShiftTemplate } from "../../../domain/entities/rosters.ts";
import {
  daysFrom,
  formatSegments,
} from "../../../domain/services/rosters.service.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import {
  templateTone,
  TONE_COLOR,
  TONE_LABEL,
  TONES,
  toneOfColor,
  type RosterTone,
} from "../../../domain/services/roster-board.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const KEY = ["novo-rh", "rosters"];
const message = (e: unknown, fallback: string) =>
  e instanceof Error ? e.message : fallback;

const SWATCH: Record<RosterTone, string> = {
  morning: "bg-shift-morning-bg border-shift-morning-line",
  afternoon: "bg-shift-afternoon-bg border-shift-afternoon-line",
  night: "bg-shift-night-bg border-shift-night-line",
  split: "bg-shift-split-bg border-shift-split-line",
  other: "bg-shift-other-bg border-shift-other-line",
};

/** Cores da escala (os mesmos pastéis); «Automática» = pelo nome/horário. */
function TonePicker({
  value,
  onChange,
  label,
  disabled = false,
}: {
  value: string | null;
  onChange: (color: string | null) => void;
  label: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const current = toneOfColor(value);
  const swatch =
    "h-6 w-6 rounded-full border-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50";
  const ring = (on: boolean) => (on ? "ring-2 ring-navy-900 ring-offset-2" : "");
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1.5">
      <button
        type="button"
        title={t("ros.template.colorAuto")}
        aria-label={t("ros.template.colorAuto")}
        aria-pressed={current === null}
        disabled={disabled}
        onClick={() => onChange(null)}
        className={`${swatch} border-dashed border-line bg-surface-card ${ring(current === null)}`}
      />
      {TONES.map((tone) => (
        <button
          key={tone}
          type="button"
          title={TONE_LABEL[tone]}
          aria-label={TONE_LABEL[tone]}
          aria-pressed={current === tone}
          disabled={disabled}
          onClick={() => onChange(TONE_COLOR[tone])}
          className={`${swatch} ${SWATCH[tone]} ${ring(current === tone)}`}
        />
      ))}
    </div>
  );
}

/** Faixas do modelo: uma por linha visual, com «+1» quando acaba no dia seguinte. */
function SegmentsCell({ segments }: { segments: Segment[] }) {
  const { t } = useI18n();
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {segments.map((s, i) => (
        <span key={i} className="inline-flex items-center gap-1 rounded-md bg-surface-soft px-2 py-0.5 tabular-nums text-ink">
          {s.start}–{s.end}
          {s.end <= s.start && (
            <span className="text-xs text-ink-muted" title={t("ros.template.nextDay")} aria-label={t("ros.template.nextDay")}>
              +1
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

/** Abreviatura no quadrado da cor. Nunca usado: abre a paleta. Já usado: cor bloqueada (com explicação acessível). */
function AbbreviationCell({
  template,
  disabled,
  onColor,
}: {
  template: ShiftTemplate;
  disabled: boolean;
  onColor: (color: string | null) => void;
}) {
  const { t } = useI18n();
  const tipId = useId();
  const chip = <ShiftTypeChip tone={templateTone(template)}>{template.abbreviation}</ShiftTypeChip>;
  if (template.used) {
    return (
      <span className="group relative inline-flex">
        <span tabIndex={0} aria-describedby={tipId} className="inline-flex cursor-not-allowed rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
          {chip}
        </span>
        <span
          id={tipId}
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-56 rounded-lg bg-navy-900 px-2.5 py-1.5 text-xs text-white shadow-pop group-hover:block group-focus-within:block"
        >
          {t("ros.template.colorLocked")}
        </span>
      </span>
    );
  }
  return (
    <Popover
      label={t("ros.template.colorOf", { name: template.name })}
      width="w-auto"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={t("ros.template.colorChange", { name: template.name })}
          disabled={disabled}
          onClick={toggle}
          className="inline-flex rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50"
        >
          {chip}
        </button>
      )}
    >
      {(close) => (
        <div className="p-2">
          <TonePicker
            label={t("ros.template.colorOf", { name: template.name })}
            value={template.color}
            onChange={(color) => {
              close();
              onColor(color);
            }}
          />
        </div>
      )}
    </Popover>
  );
}

const DEFAULT_SEGMENTS: Segment[] = [{ start: "09:00", end: "17:00" }];
const EMPTY_FORM = { name: "", abbreviation: "", color: null as string | null, onCall: false };

/**
 * Modelos de turno (RE-15): tabela «Abreviatura | Nome do turno | Horário(s) |
 * Ações» e um bloco à parte para criar ou editar. Editar um modelo já usado
 * cria uma nova versão — o que já está feito (rascunho ou publicado) mantém o
 * modelo anterior; só as atribuições novas usam o editado. A cor muda no
 * quadrado da abreviatura, só em modelos nunca usados.
 */
export function TemplatesPanel() {
  const { t } = useI18n();
  const { rosters } = useNovoRh();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: [...KEY, "templates"],
    queryFn: () => rosters.listTemplates(),
  });
  const formRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<ShiftTemplate | null>(null);
  const [v, setV] = useState(EMPTY_FORM);
  // Faixas escolhidas no relógio (sem escrever); até 3 por modelo.
  const [segments, setSegments] = useState<Segment[]>(DEFAULT_SEGMENTS);
  const [notice, setNotice] = useState<string | null>(null);
  const [toDeactivate, setToDeactivate] = useState<ShiftTemplate | null>(null);
  const valid = segments.every((s) => s.start !== s.end);
  const setSegment = (i: number, patch: Partial<Segment>) =>
    setSegments(segments.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const resetForm = () => {
    setEditing(null);
    setV(EMPTY_FORM);
    setSegments(DEFAULT_SEGMENTS);
  };
  const startEdit = (x: ShiftTemplate) => {
    setNotice(null);
    save.reset();
    setEditing(x);
    setV({ name: x.name, abbreviation: x.abbreviation, color: x.color, onCall: x.onCall });
    setSegments(x.segments.map((s) => ({ ...s })));
    formRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  };
  const input = () => ({ name: v.name, abbreviation: v.abbreviation, color: v.color, onCall: v.onCall, segments });
  const save = useMutation({
    mutationFn: async () => {
      if (!editing) {
        await rosters.createTemplate(input());
        return null;
      }
      return rosters.updateTemplate(editing.id, input());
    },
    onSuccess: async (out) => {
      setNotice(out ? t(out.versioned ? "ros.template.versioned" : "ros.template.saved") : null);
      resetForm();
      await qc.invalidateQueries({ queryKey: KEY });
    },
    // Os campos ficam como estão; a lista atualiza (ex.: o modelo acabou de ser usado).
    onError: () => void qc.invalidateQueries({ queryKey: [...KEY, "templates"] }),
  });
  const recolor = useMutation({
    mutationFn: (x: { id: string; color: string | null }) =>
      rosters.setTemplateColor(x.id, x.color),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: () => void qc.invalidateQueries({ queryKey: [...KEY, "templates"] }),
  });
  const archive = useMutation({
    mutationFn: (id: string) => rosters.archiveTemplate(id),
    onSuccess: async (_r, id) => {
      setToDeactivate(null);
      if (editing?.id === id) resetForm();
      await qc.invalidateQueries({ queryKey: KEY });
    },
  });
  const list = (q.data ?? []).filter((x) => !x.archived);
  const groupLabel = editing ? t("ros.template.editTitle") : t("ros.template.create");
  return (
    <section className={`${SURFACE} space-y-4 p-4`}>
      {q.data && list.length === 0 && (
        <p className="text-sm text-stone-500">{t("ros.templates.none")}</p>
      )}
      {list.length > 0 && (
        <div className="overflow-x-auto">
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th scope="col" className={`${TH} w-28`}>{t("ros.template.col.abbr")}</th>
                <th scope="col" className={TH}>{t("ros.template.col.name")}</th>
                <th scope="col" className={TH}>{t("ros.template.col.hours")}</th>
                <th scope="col" className={`${TH} w-20 text-right`}>{t("ros.template.col.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.id} className={TR}>
                  <td className={TD}>
                    <AbbreviationCell template={x} disabled={recolor.isPending} onColor={(color) => recolor.mutate({ id: x.id, color })} />
                  </td>
                  <td className={TD}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium text-navy-900" title={x.name.length > 32 ? x.name : undefined}>
                        {x.name}
                      </span>
                      {x.onCall && <StatusBadge tone="neutral">{t("ros.template.onCall")}</StatusBadge>}
                    </span>
                  </td>
                  <td className={TD}>
                    <SegmentsCell segments={x.segments} />
                  </td>
                  <td className={`${TD} text-right`}>
                    <DropdownMenu
                      label={t("ros.template.actions", { name: x.name })}
                      portal
                      items={[
                        { label: t("ros.template.edit"), onSelect: () => startEdit(x) },
                        { label: t("ros.template.deactivate"), danger: true, onSelect: () => setToDeactivate(x) },
                      ]}
                      trigger={({ open, toggle }) => (
                        <button
                          type="button"
                          aria-haspopup="menu"
                          aria-expanded={open}
                          aria-label={t("ros.template.actions", { name: x.name })}
                          onClick={toggle}
                          className={iconButtonClass("sm")}
                        >
                          <IconMore size={18} />
                        </button>
                      )}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {recolor.isError && (
        <p className="text-sm text-red-700">{message(recolor.error, t("common.error"))}</p>
      )}
      {archive.isError && !toDeactivate && (
        <p className="text-sm text-red-700">{message(archive.error, t("common.error"))}</p>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-700">
          {notice}
        </p>
      )}

      <div ref={formRef} className="space-y-3 rounded-2xl border border-line-subtle bg-surface-soft/50 p-4">
        <h3 className={SECTION_TITLE}>{editing ? t("ros.template.editTitle") : t("ros.template.newTitle")}</h3>
        {editing?.used && <p className="text-sm text-ink-secondary">{t("ros.template.usedNote")}</p>}
        <div className="flex flex-wrap items-end gap-2" role="group" aria-label={groupLabel}>
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
                      onClick={() => setSegments(segments.filter((_, j) => j !== i))}
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
          <div>
            <span className={LABEL}>{t("ros.template.color")}</span>
            <div className="flex h-10 items-center">
              <TonePicker
                label={t("ros.template.color")}
                value={v.color}
                onChange={(color) => setV({ ...v, color })}
              />
            </div>
          </div>
          <label className="flex items-center gap-1 pb-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={v.onCall}
              onChange={(e) => setV({ ...v, onCall: e.target.checked })}
            />
            {t("ros.template.onCall")}
          </label>
          <Button variant="primary" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            {editing ? t("ros.template.save") : t("ros.template.create")}
          </Button>
          {editing && (
            <Button variant="secondary" disabled={save.isPending} onClick={() => { save.reset(); resetForm(); }}>
              {t("common.cancel")}
            </Button>
          )}
        </div>
        {!valid && (
          <p className="text-sm text-red-700">{t("ros.template.invalidSegments")}</p>
        )}
        {save.isError && (
          <p role="alert" className="text-sm text-red-700">{message(save.error, t("common.error"))}</p>
        )}
      </div>

      <Dialog
        open={toDeactivate !== null}
        title={t("ros.template.deactivateTitle", { name: toDeactivate?.name ?? "" })}
        description={t("ros.template.deactivateBody")}
        onClose={() => {
          setToDeactivate(null);
          archive.reset();
        }}
        actions={
          <>
            <Button variant="secondary" onClick={() => { setToDeactivate(null); archive.reset(); }}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" disabled={archive.isPending} onClick={() => toDeactivate && archive.mutate(toDeactivate.id)}>
              {t("ros.template.deactivate")}
            </Button>
          </>
        }
      >
        {archive.isError && <p role="alert" className="text-sm text-red-700">{message(archive.error, t("common.error"))}</p>}
      </Dialog>
    </section>
  );
}

/** Trocas à espera da gestão (o colega já aceitou). */
/**
 * Áreas de trabalho por centro (Sala, Caixa, Cozinha…): criar, mudar o nome,
 * ordenar e desativar. Opcionais: escolhem-se em cada turno; uma área
 * desativada deixa de se poder escolher mas fica nos turnos antigos.
 */
export function AreasPanel() {
  const { t } = useI18n();
  const { rosters, settings } = useNovoRh();
  const qc = useQueryClient();
  const locations = useQuery({
    queryKey: ["novo-rh", "settings", "locations"],
    queryFn: () => settings.listLocations(),
  });
  const [chosen, setChosen] = useState("");
  const locationId = chosen || locations.data?.[0]?.id || "";
  const q = useQuery({
    queryKey: [...KEY, "areas", locationId],
    queryFn: () => rosters.listAreas(locationId),
    enabled: !!locationId,
  });
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const done = () => qc.invalidateQueries({ queryKey: [...KEY, "areas"] });
  const create = useMutation({
    mutationFn: () => rosters.createArea({ locationId, name }),
    onSuccess: async () => {
      setName("");
      await done();
    },
  });
  const update = useMutation({
    mutationFn: (x: { id: string; patch: { name?: string; sortOrder?: number; active?: boolean } }) =>
      rosters.updateArea(x.id, x.patch),
    onSuccess: async () => {
      setRenaming(null);
      await done();
    },
  });
  const list = [...(q.data ?? [])].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt"),
  );
  const activeList = list.filter((a) => a.active);
  // Trocar de lugar com a vizinha: as duas ficam com ordens distintas (mesmo que antes fossem iguais).
  const move = async (i: number, dir: -1 | 1) => {
    const a = activeList[i]!;
    const b = activeList[i + dir]!;
    const lo = Math.min(a.sortOrder, b.sortOrder);
    const hi = Math.max(lo + 1, Math.max(a.sortOrder, b.sortOrder));
    await update.mutateAsync({ id: a.id, patch: { sortOrder: dir === -1 ? lo : hi } });
    await update.mutateAsync({ id: b.id, patch: { sortOrder: dir === -1 ? hi : lo } });
  };
  const error = create.error ?? update.error;
  return (
    <section className={`${SURFACE} space-y-4 p-4`}>
      <p className="text-sm text-ink-secondary">{t("ros.areas.hint")}</p>
      <label className="block max-w-sm">
        <span className={LABEL}>{t("ros.areas.location")}</span>
        <select
          className={`${FIELD} w-full`}
          value={locationId}
          onChange={(e) => {
            setChosen(e.target.value);
            setRenaming(null);
          }}
        >
          {(locations.data ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      {q.data && list.length === 0 && (
        <p className="text-sm text-ink-secondary">{t("ros.areas.empty")}</p>
      )}
      <ul className="divide-y divide-line-subtle rounded-xl border border-line text-sm" aria-label={t("ros.tab.areas")}>
        {list.map((a) => {
          const i = activeList.findIndex((x) => x.id === a.id);
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              {renaming?.id === a.id ? (
                <form
                  className="flex flex-1 flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    update.mutate({ id: a.id, patch: { name: renaming.name } });
                  }}
                >
                  <input
                    className={FIELD}
                    aria-label={t("ros.areas.name")}
                    maxLength={60}
                    autoFocus
                    value={renaming.name}
                    onChange={(e) => setRenaming({ id: a.id, name: e.target.value })}
                  />
                  <Button size="sm" variant="primary" type="submit" disabled={!renaming.name.trim() || update.isPending}>
                    {t("ros.areas.save")}
                  </Button>
                  <Button size="sm" variant="tertiary" onClick={() => setRenaming(null)}>
                    {t("common.cancel")}
                  </Button>
                </form>
              ) : (
                <>
                  <span className={`flex-1 font-medium ${a.active ? "text-navy-900" : "text-ink-muted"}`}>{a.name}</span>
                  {!a.active && <StatusBadge tone="neutral">{t("ros.areas.inactive")}</StatusBadge>}
                  {a.active && (
                    <>
                      <Button size="sm" variant="tertiary" aria-label={`${t("ros.areas.up")} ${a.name}`} disabled={i <= 0 || update.isPending} onClick={() => void move(i, -1)}>
                        ↑
                      </Button>
                      <Button size="sm" variant="tertiary" aria-label={`${t("ros.areas.down")} ${a.name}`} disabled={i < 0 || i >= activeList.length - 1 || update.isPending} onClick={() => void move(i, 1)}>
                        ↓
                      </Button>
                      <Button size="sm" variant="tertiary" aria-label={`${t("ros.areas.rename")} ${a.name}`} onClick={() => setRenaming({ id: a.id, name: a.name })}>
                        {t("ros.areas.rename")}
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="tertiary"
                    aria-label={`${a.active ? t("ros.areas.deactivate") : t("ros.areas.activate")} ${a.name}`}
                    disabled={update.isPending}
                    onClick={() => update.mutate({ id: a.id, patch: { active: !a.active } })}
                  >
                    {a.active ? t("ros.areas.deactivate") : t("ros.areas.activate")}
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <form
        className="flex flex-wrap items-end gap-2"
        aria-label={t("ros.areas.add")}
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <label>
          <span className={LABEL}>{t("ros.areas.name")}</span>
          <input className={FIELD} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <Button variant="primary" type="submit" icon={<IconPlus size={16} />} disabled={!locationId || !name.trim() || create.isPending}>
          {t("ros.areas.add")}
        </Button>
      </form>
      {error && <p className="text-sm text-red-700" role="alert">{message(error, t("common.error"))}</p>}
    </section>
  );
}

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
