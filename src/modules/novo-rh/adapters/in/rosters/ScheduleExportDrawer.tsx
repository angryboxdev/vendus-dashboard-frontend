import { useEffect, useMemo, useState } from "react";
import { AlertBanner, Button, Drawer, FIELD, LABEL } from "../../../../../components/ui/index.ts";
import type { RosterShift, ShiftTemplate, WorkArea } from "../../../domain/entities/rosters.ts";
import { buildScheduleExport, type ExportGroupBy, type ExportPerson, type ExportPresentation } from "../../../domain/services/schedule-export.service.ts";
import { chipLabel } from "../../../domain/services/roster-board.service.ts";
import { loadBrandLogo, renderSchedulePdf } from "../../out/schedule-pdf.renderer.ts";
import { downloadBlob } from "../download.ts";

const GROUPS: { key: ExportGroupBy; label: string; hint: string }[] = [
  { key: "employee", label: "Colaborador", hint: "Uma linha por pessoa, de segunda a domingo." },
  { key: "shift", label: "Turno", hint: "Secções por modelo de turno (Manhã, Tarde…)." },
  { key: "area", label: "Área de trabalho", hint: "Secções por área do centro, incluindo «Sem área»." },
  { key: "position", label: "Cargo", hint: "Secções por cargo/função." },
];
const PRESENTATIONS: { key: ExportPresentation; label: string; hint: string }[] = [
  { key: "full", label: "Horários completos", hint: "Nome do turno, entrada e saída em cada dia." },
  { key: "codes", label: "Siglas + legenda", hint: "Códigos e cores reais dos modelos, com legenda." },
];

type Option = { id: string; label: string };

/** Lista de escolha múltipla compacta (nenhuma escolhida = todas). */
function MultiPick({ label, options, value, onChange, searchable = false }: { label: string; options: Option[]; value: string[]; onChange: (v: string[]) => void; searchable?: boolean }) {
  const [q, setQ] = useState("");
  const norm = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const shown = options.filter((o) => !q || norm(o.label).includes(norm(q)));
  return (
    <details className="rounded-xl border border-line px-3 py-2">
      <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium text-navy-900">
        {label}
        <span className="text-xs font-normal text-ink-secondary">{value.length ? `${value.length} escolhido(s)` : "Todos"}</span>
      </summary>
      <div className="mt-2 space-y-1.5">
        {searchable && <input aria-label={`Pesquisar ${label.toLowerCase()}`} className={`${FIELD} h-9 w-full`} placeholder="Pesquisar…" value={q} onChange={(e) => setQ(e.target.value)} />}
        <ul className="max-h-48 space-y-1 overflow-y-auto text-sm" aria-label={label}>
          {shown.map((o) => (
            <li key={o.id}>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={value.includes(o.id)} onChange={(e) => onChange(e.target.checked ? [...value, o.id] : value.filter((x) => x !== o.id))} />
                <span className="truncate">{o.label}</span>
              </label>
            </li>
          ))}
        </ul>
        {value.length > 0 && (
          <button type="button" className="text-xs font-medium text-brand-600 hover:underline" onClick={() => onChange([])}>
            Limpar (todos)
          </button>
        )}
      </div>
    </details>
  );
}

/**
 * Exportar a escala em PDF: um só gerador com quatro formas de organizar e
 * duas apresentações; um colaborador escolhido → versão individual (A4
 * vertical). A pré-visualização é o próprio PDF. Sem horas nem dados pessoais.
 */
export function ScheduleExportDrawer(p: {
  open: boolean;
  onClose: () => void;
  /** Pedido a partir do menu de um colaborador: já vem escolhido (versão individual). */
  employeeId: string | null;
  people: ExportPerson[];
  shifts: RosterShift[];
  templates: ShiftTemplate[];
  areas: WorkArea[];
  positions: { id: string; name: string }[];
  days: string[];
  unit: string;
  version: number;
}) {
  const [groupBy, setGroupBy] = useState<ExportGroupBy>("employee");
  const [presentation, setPresentation] = useState<ExportPresentation>("full");
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [templateIds, setTemplateIds] = useState<string[]>([]);
  const [positionIds, setPositionIds] = useState<string[]>([]);
  const [logo, setLogo] = useState<string | null>(null);
  const [shareHint, setShareHint] = useState<string | null>(null);

  // Ao abrir: o colaborador pedido (ou todos) e filtros limpos.
  const [openedFor, setOpenedFor] = useState<string | null | undefined>(undefined);
  if (p.open && openedFor !== p.employeeId) {
    setOpenedFor(p.employeeId);
    setEmployeeIds(p.employeeId ? [p.employeeId] : []);
    setAreaIds([]);
    setTemplateIds([]);
    setPositionIds([]);
    setShareHint(null);
  }
  if (!p.open && openedFor !== undefined) setOpenedFor(undefined);

  useEffect(() => {
    if (p.open && logo === null) void loadBrandLogo().then((l) => l && setLogo(l));
  }, [p.open, logo]);

  const data = useMemo(
    () =>
      buildScheduleExport({
        days: p.days,
        people: p.people,
        shifts: p.shifts.filter((s) => !s.id.startsWith("tmp-") && !s.id.startsWith("rej-")),
        templates: p.templates,
        areas: p.areas,
        positions: p.positions,
        groupBy,
        filters: { employeeIds, areaIds, templateIds, positionIds },
      }),
    [p.days, p.people, p.shifts, p.templates, p.areas, p.positions, groupBy, employeeIds, areaIds, templateIds, positionIds],
  );
  const empty = data.assignments === 0;
  const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  const weekLabel = p.days.length ? `${dm(p.days[0]!)} – ${dm(p.days.at(-1)!)}` : "";
  const nameOf = (id: string) => p.people.find((x) => x.employeeId === id)?.name ?? "colaborador";
  const filtersLabel = [employeeIds.length && !data.individual ? `${employeeIds.length} colaborador(es)` : "", areaIds.length ? `${areaIds.length} área(s)` : "", templateIds.length ? `${templateIds.length} turno(s)` : "", positionIds.length ? `${positionIds.length} cargo(s)` : ""]
    .filter(Boolean)
    .join(" · ");
  const fileName = (data.individual ? `horario-${nameOf(employeeIds[0]!)}-${p.days[0]}` : `escala-${p.unit}-${p.days[0]}`).replace(/[^\w.-]+/g, "_") + ".pdf";

  const doc = useMemo(
    () =>
      empty || !p.open
        ? null
        : renderSchedulePdf(data, {
            unit: p.unit,
            weekLabel,
            organizedBy: GROUPS.find((g) => g.key === groupBy)!.label,
            presentation,
            filtersLabel,
            version: p.version,
            issuedAt: new Date(),
            logo,
          }),
    [data, empty, p.open, p.unit, weekLabel, groupBy, presentation, filtersLabel, p.version, logo],
  );
  // A pré-visualização é o próprio PDF (o mesmo ficheiro que se descarrega).
  const url = useMemo(() => (doc && typeof URL.createObjectURL === "function" ? URL.createObjectURL(doc.output("blob")) : null), [doc]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  const blob = () => doc!.output("blob");
  const download = () => downloadBlob(blob(), fileName);
  const share = async () => {
    const file = new File([blob()], fileName, { type: "application/pdf" });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      try {
        await nav.share({ files: [file], title: data.individual ? "Horário semanal" : "Escala semanal" });
        return;
      } catch {
        /* cancelado: nada a fazer */
      }
      return;
    }
    setShareHint("Este navegador não anexa ficheiros diretamente. Use WhatsApp ou e-mail: o PDF é descarregado e depois anexa-o na conversa.");
  };
  const via = (kind: "whatsapp" | "email") => {
    download();
    const text = `${data.individual ? "Horário" : "Escala"} da semana ${weekLabel} (${p.unit}) — segue em anexo o PDF ${fileName}.`;
    const href = kind === "whatsapp" ? `https://wa.me/?text=${encodeURIComponent(text)}` : `mailto:?subject=${encodeURIComponent(`${data.individual ? "Horário" : "Escala"} semanal ${weekLabel}`)}&body=${encodeURIComponent(text)}`;
    window.open(href, "_blank", "noopener");
    setShareHint(`PDF descarregado (${fileName}). Anexe-o na ${kind === "whatsapp" ? "conversa do WhatsApp" : "mensagem de e-mail"} — o envio não é automático.`);
  };

  const radios = <K extends string>(name: string, list: { key: K; label: string; hint: string }[], value: K, set: (k: K) => void) => (
    <fieldset className="space-y-1.5">
      <legend className={LABEL}>{name}</legend>
      {list.map((o) => (
        <label key={o.key} className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-sm ${value === o.key ? "border-brand-600 bg-brand-50/40" : "border-line"}`}>
          <input type="radio" name={name} className="mt-1" checked={value === o.key} onChange={() => set(o.key)} />
          <span>
            <span className="block font-medium text-navy-900">{o.label}</span>
            <span className="block text-xs text-ink-secondary">{o.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );

  return (
    <Drawer
      open={p.open}
      title={p.employeeId ? `Exportar horário de ${nameOf(p.employeeId)} em PDF` : "Exportar escala em PDF"}
      description={`${p.unit} · ${weekLabel}`}
      width="max-w-5xl"
      onClose={p.onClose}
      footer={
        <>
          <Button variant="tertiary" onClick={() => void share()} disabled={empty}>
            Partilhar…
          </Button>
          <Button variant="tertiary" onClick={() => via("whatsapp")} disabled={empty}>
            WhatsApp
          </Button>
          <Button variant="tertiary" onClick={() => via("email")} disabled={empty}>
            E-mail
          </Button>
          <Button variant="primary" onClick={download} disabled={empty}>
            Descarregar PDF
          </Button>
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          {radios("Organizar por", GROUPS, groupBy, setGroupBy)}
          {radios("Apresentação", PRESENTATIONS, presentation, setPresentation)}
          <div className="space-y-2">
            <p className={LABEL}>Filtros</p>
            <MultiPick label="Colaboradores" searchable options={p.people.map((x) => ({ id: x.employeeId, label: x.name }))} value={employeeIds} onChange={setEmployeeIds} />
            <MultiPick label="Áreas" options={[...p.areas.filter((a) => a.active).sort((a, b) => a.sortOrder - b.sortOrder).map((a) => ({ id: a.id, label: a.name })), { id: "none", label: "Sem área" }]} value={areaIds} onChange={setAreaIds} />
            <MultiPick label="Turnos" options={[...p.templates.filter((t) => !t.archived).map((t) => ({ id: t.id, label: `${chipLabel(t)} · ${t.name}` })), { id: "custom", label: "Horários sem modelo" }, { id: "day_off", label: "Folga" }]} value={templateIds} onChange={setTemplateIds} />
            <MultiPick label="Cargos" options={[...p.positions.map((x) => ({ id: x.id, label: x.name })), { id: "none", label: "Sem cargo" }]} value={positionIds} onChange={setPositionIds} />
          </div>
          <p className="text-xs text-ink-secondary">
            {data.individual ? "Um colaborador: versão individual (A4 vertical)." : "Vários colaboradores: A4 horizontal, ordem da escala."} Sem horas, totais nem dados pessoais.
          </p>
        </div>
        <div className="min-w-0 space-y-2">
          {data.hasDraft && !empty && (
            <AlertBanner tone="warning" title="Inclui turnos por publicar">
              O PDF sai marcado como «Rascunho — não publicar». Publique a escala antes de enviar aos colaboradores.
            </AlertBanner>
          )}
          {shareHint && (
            <p role="status" className="rounded-xl bg-surface-soft px-3 py-2 text-xs text-ink-secondary">
              {shareHint}
            </p>
          )}
          {empty ? (
            <div role="status" className="flex h-[480px] items-center justify-center rounded-xl border border-dashed border-line text-sm text-ink-secondary">
              Nenhum turno corresponde aos filtros — não há nada para exportar.
            </div>
          ) : url ? (
            <iframe title="Pré-visualização do PDF" src={url} className="h-[70vh] min-h-[480px] w-full rounded-xl border border-line bg-white" />
          ) : (
            <p role="status" className="text-sm text-ink-secondary">
              {data.groups.flatMap((g) => g.rows).length} colaborador(es) · {data.assignments} atribuição(ões) — a preparar a pré-visualização…
            </p>
          )}
        </div>
      </div>
    </Drawer>
  );
}
