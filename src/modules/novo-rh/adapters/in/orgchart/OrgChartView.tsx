import { useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertBanner, Avatar, Button, Dialog, FIELD, IconButton, IconChevronDown, IconMore, LABEL, SearchableSelect, SegmentedControl, SURFACE } from "../../../../../components/ui/index.ts";
import { descendants, managersTree, pathsTo, teamSize, unitsTree, type OrgModel, type OrgNode, type OrgPerson } from "../../../domain/services/org-chart.service.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { useNovoRhSlots } from "../slots.ts";

const MODELS: { key: OrgModel; label: string }[] = [
  { key: "managers", label: "Por chefia" },
  { key: "location", label: "Por centro" },
  { key: "department", label: "Por departamento" },
];
/** Mais de tantos subordinados sem equipa própria: ficam numa coluna (a árvore não cresce para os lados). */
const STACK_FROM = 5;
const norm = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .join("");

interface Move {
  person: OrgPerson;
  managerId: string | null;
}

/**
 * Mais → Organograma: modelos prontos (por chefia, centro ou departamento) a
 * partir do que já está registado. Em «Por chefia», «Editar» permite arrastar
 * um cartão para cima de outro (ou usar o menu do cartão) para mudar a chefia
 * direta — a mudança é a mesma do separador Responsáveis, com data de efeito.
 */
export function OrgChartView() {
  const { people, settings, structure } = useNovoRh();
  const slots = useNovoRhSlots();
  const qc = useQueryClient();
  const today = todayIn();
  const [model, setModel] = useState<OrgModel>("managers");
  const [editing, setEditing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [q, setQ] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [move, setMove] = useState<Move | null>(null);
  const [moveDate, setMoveDate] = useState(today);
  const [dragging, setDragging] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const list = useQuery({ queryKey: ["novo-rh", "people", "active", "orgchart"], queryFn: () => people.list({ status: "active" }) });
  const positions = useQuery({ queryKey: ["novo-rh", "catalog", "positions"], queryFn: () => people.listPositions() });
  const locations = useQuery({ queryKey: ["novo-rh", "settings", "locations"], queryFn: () => settings.listLocations() });
  const links = useQuery({ queryKey: ["novo-rh", "org-chart", today], queryFn: () => people.orgChart(today) });
  const departments = useQuery({ queryKey: ["novo-rh", "structure", "departments"], queryFn: () => structure.listDepartments(), retry: false });
  const assignments = useQuery({ queryKey: ["novo-rh", "structure", "assignments", "all"], queryFn: () => structure.listAllAssignments(), retry: false, enabled: model === "department" });
  const save = useMutation({
    mutationFn: (m: Move) => people.setDirectManager(m.person.id, m.managerId, moveDate),
    onSuccess: () => {
      setMove(null);
      void qc.invalidateQueries({ queryKey: ["novo-rh", "org-chart"] });
    },
  });

  if (list.isLoading || links.isLoading) return <p className="text-sm text-stone-400">A carregar…</p>;
  if (list.isError) return <p className="text-sm text-red-700">Não foi possível carregar os colaboradores.</p>;

  const posName = new Map((positions.data ?? []).map((p) => [p.id, p.name]));
  const locName = new Map((locations.data ?? []).map((l) => [l.id, l.label]));
  const depName = new Map((departments.data ?? []).map((d) => [d.id, d.name]));
  const orgPeople: OrgPerson[] = (list.data ?? []).map((p) => ({
    id: p.id,
    name: p.fullName,
    position: p.positionId ? (posName.get(p.positionId) ?? null) : null,
    location: p.primaryLocationId ? (locName.get(p.primaryLocationId) ?? null) : null,
    photoUrl: p.photoUrl,
  }));
  const tree =
    model === "managers"
      ? managersTree("Empresa", orgPeople, links.data ?? [])
      : model === "location"
        ? unitsTree("Empresa", orgPeople, (p) => (p.location ? [p.location] : []), "Sem centro")
        : unitsTree(
            "Empresa",
            orgPeople,
            (p) => (assignments.data ?? []).filter((a) => a.employeeId === p.id && a.unitType === "department" && a.validFrom <= today && (a.validTo === null || a.validTo >= today)).map((a) => depName.get(a.unitId) ?? "Departamento"),
            "Sem departamento",
          );
  const term = q.trim() ? norm(q.trim()) : "";
  const found = term ? pathsTo(tree, (n) => norm(`${n.label} ${n.sub ?? ""}`).includes(term)) : null;
  const isOpen = (n: OrgNode) => (found?.open.has(n.id) ? true : !collapsed.has(n.id));
  const toggle = (id: string) => setCollapsed((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  const canEdit = editing && model === "managers";
  const managerOf = new Map((links.data ?? []).map((l) => [l.employeeId, l.managerEmployeeId]));
  const blocked = dragging ? new Set([dragging, ...descendants(tree, dragging)]) : null;

  const same = (person: OrgPerson, managerId: string | null) => (managerOf.get(person.id) ?? null) === managerId;
  /** Abre o diálogo; ao largar um cartão na mesma chefia não há nada a mudar. */
  const startMove = (person: OrgPerson, managerId: string | null, fromDrop = true) => {
    if (fromDrop && same(person, managerId)) return;
    save.reset();
    setMoveDate(today);
    setMove({ person, managerId });
  };
  const exportPdf = () => {
    const el = chartRef.current;
    if (!el) return;
    const w = window.open("", "_blank", "noopener=no,width=1200,height=800");
    if (!w) return;
    const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((n) => n.outerHTML).join("");
    w.document.write(`<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>Organograma</title>${styles}<style>@page{size:A4 landscape;margin:10mm}body{background:#fff}</style></head><body><div style="padding:16px">${el.innerHTML}</div></body></html>`);
    w.document.close();
    w.addEventListener("load", () => w.print());
    setTimeout(() => w.print(), 600);
  };

  const card = (n: OrgNode): ReactNode => {
    if (n.kind === "company")
      return (
        <div
          className={`rounded-2xl border-2 bg-surface-card px-6 py-4 text-center shadow-card ${canEdit && dragging ? "border-dashed border-brand-500" : "border-brand-500/40"}`}
          onDragOver={(e) => canEdit && dragging && e.preventDefault()}
          onDrop={() => {
            const p = orgPeople.find((x) => x.id === dragging);
            setDragging(null);
            if (canEdit && p) startMove(p, null);
          }}
        >
          <p className="text-base font-semibold text-navy-900">{slots.companyName ? slots.companyName() : "Empresa"}</p>
          <p className="text-xs text-ink-secondary">{teamSize(n)} colaboradores</p>
        </div>
      );
    if (n.kind === "unit")
      return (
        <div className="rounded-2xl border border-line bg-brand-50 px-5 py-3 text-center shadow-card">
          <p className="text-sm font-semibold text-navy-900">{n.label}</p>
          <p className="text-xs text-ink-secondary">{n.sub}</p>
        </div>
      );
    const p = n.person!;
    const hit = found?.hits.has(n.id);
    const dropOk = canEdit && dragging && !blocked?.has(n.id);
    return (
      <div
        draggable={canEdit}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          setDragging(p.id);
        }}
        onDragEnd={() => setDragging(null)}
        onDragOver={(e) => dropOk && e.preventDefault()}
        onDrop={() => {
          const from = orgPeople.find((x) => x.id === dragging);
          setDragging(null);
          if (dropOk && from) startMove(from, p.id);
        }}
        className={`group relative flex w-56 items-center gap-3 rounded-2xl border bg-surface-card p-3 text-left shadow-card transition ${hit ? "border-brand-600 ring-2 ring-brand-500/30" : "border-line"} ${dropOk ? "border-dashed border-brand-500 bg-brand-50" : ""} ${canEdit ? "cursor-grab" : ""} ${dragging === p.id ? "opacity-50" : ""}`}
      >
        {p.photoUrl ? (
          <Avatar name={p.name} photoUrl={p.photoUrl} size="md" />
        ) : (
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ED5C32] to-[#F08A4B] text-sm font-semibold text-white">
            {initials(p.name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Link to={`/hr/novo/pessoas/${encodeURIComponent(p.id)}`} className="block truncate text-sm font-semibold text-navy-900 hover:text-brand-600 hover:underline" draggable={false}>
            {p.name}
          </Link>
          <p className="truncate text-xs text-ink-secondary">{p.position ?? "Sem cargo"}</p>
          {p.location && <span className="mt-1 inline-block max-w-full truncate rounded-full bg-surface-soft px-2 py-0.5 text-[11px] text-ink-secondary">{p.location}</span>}
        </div>
        {canEdit && (
          <IconButton label={`Mudar a chefia de ${p.name}`} size="sm" onClick={() => startMove(p, managerOf.get(p.id) ?? null, false)} className="absolute right-1 top-1 opacity-60 group-hover:opacity-100">
            <IconMore size={14} />
          </IconButton>
        )}
      </div>
    );
  };

  const branch = (n: OrgNode): ReactNode => {
    const open = isOpen(n);
    const size = teamSize(n);
    const leaves = n.children.every((c) => c.children.length === 0);
    const stack = leaves && n.children.length >= STACK_FROM;
    return (
      <div className="flex flex-col items-center">
        {card(n)}
        {n.children.length > 0 && (
          <>
            <div className="h-4 w-px bg-line" />
            <button
              type="button"
              onClick={() => toggle(n.id)}
              aria-expanded={open}
              aria-label={`${open ? "Recolher" : "Expandir"} ${n.kind === "company" ? "a empresa" : n.label} (${size})`}
              className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-brand-500"
            >
              <IconChevronDown size={12} className={open ? "rotate-180" : ""} />
              {size}
            </button>
            {open &&
              (stack ? (
                <>
                  <div className="h-4 w-px bg-line" />
                  <ul className="flex flex-col gap-2 border-l-2 border-line pl-4">
                    {n.children.map((c) => (
                      <li key={c.id}>{card(c)}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <div className="h-4 w-px bg-line" />
                  <ul className="flex">
                    {n.children.map((c) => (
                      <li
                        key={c.id}
                        className="relative px-2 pt-4 before:absolute before:left-0 before:right-0 before:top-0 before:border-t before:border-line first:before:left-1/2 last:before:right-1/2 only:before:hidden after:absolute after:left-1/2 after:top-0 after:h-4 after:border-l after:border-line"
                      >
                        {branch(c)}
                      </li>
                    ))}
                  </ul>
                </>
              ))}
          </>
        )}
      </div>
    );
  };

  const target = move ? (move.managerId ? orgPeople.find((p) => p.id === move.managerId) : null) : null;
  const options = move ? orgPeople.filter((p) => p.id !== move.person.id && !descendants(tree, move.person.id).has(p.id)).map((p) => ({ id: p.id, label: p.name })) : [];

  return (
    <div className="space-y-4">
      <div className={`${SURFACE} flex flex-wrap items-center gap-3 p-3`}>
        <SegmentedControl<OrgModel> label="Modelo do organograma" value={model} onChange={(m) => (setModel(m), setCollapsed(new Set()), m !== "managers" && setEditing(false))} items={MODELS} />
        <input type="search" aria-label="Procurar no organograma" placeholder="Procurar pessoa, cargo ou centro" className={`${FIELD} w-full sm:w-64`} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex items-center gap-1" role="group" aria-label="Zoom">
          <Button size="sm" variant="secondary" onClick={() => setZoom((z) => Math.max(0.4, Math.round((z - 0.1) * 10) / 10))}>
            −
          </Button>
          <span className="w-12 text-center text-sm tabular-nums text-ink-secondary">{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="secondary" onClick={() => setZoom((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))}>
            +
          </Button>
        </div>
        <Button size="sm" variant="tertiary" onClick={() => setCollapsed(new Set())}>
          Expandir tudo
        </Button>
        <Button size="sm" variant="tertiary" onClick={() => setCollapsed(new Set(tree.children.map((c) => c.id)))}>
          Recolher
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {model === "managers" && (
            <Button variant={editing ? "primary" : "secondary"} onClick={() => setEditing(!editing)}>
              {editing ? "Terminar edição" : "Editar chefias"}
            </Button>
          )}
          <Button variant="secondary" onClick={exportPdf}>
            Imprimir / PDF
          </Button>
        </div>
      </div>
      {canEdit && <AlertBanner tone="info" title="Arraste um cartão para cima do novo responsável (ou para a empresa, para ficar sem chefia). Também pode usar o botão ⋯ de cada cartão." />}
      {model === "department" && (departments.isError || assignments.isError) && <AlertBanner tone="warning" title="Sem acesso à estrutura (departamentos) — mostre por chefia ou por centro." />}
      {term && found && found.hits.size === 0 && <p className="text-sm text-ink-secondary">Ninguém corresponde à pesquisa.</p>}

      <div className={`${SURFACE} overflow-auto p-6`} style={{ maxHeight: "75vh" }}>
        <div ref={chartRef} className="inline-block min-w-full" style={{ zoom }}>
          <div className="flex justify-center">{branch(tree)}</div>
        </div>
      </div>

      <Dialog
        open={move !== null}
        title="Mudar a chefia direta"
        description={move ? `${move.person.name} passa a reportar a ${target ? target.name : "ninguém (fica sem chefia)"}.` : undefined}
        onClose={() => setMove(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setMove(null)}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={!move || !moveDate || same(move.person, move.managerId) || save.isPending} onClick={() => move && save.mutate(move)}>
              {save.isPending ? "A guardar…" : "Confirmar"}
            </Button>
          </>
        }
      >
        {move && (
          <div className="space-y-3">
            <div>
              <span className={LABEL}>Novo responsável</span>
              <SearchableSelect label="Novo responsável" value={move.managerId ?? ""} options={options} allLabel="Sem chefia" onChange={(id) => setMove({ ...move, managerId: id || null })} />
            </div>
            <label className="block">
              <span className={LABEL}>Com efeito a partir de</span>
              <input type="date" className={`${FIELD} w-full`} value={moveDate} onChange={(e) => setMoveDate(e.target.value)} />
            </label>
            <p className="text-xs text-ink-secondary">A chefia atual termina na véspera; fica no histórico do colaborador (separador Responsáveis).</p>
            {save.isError && (
              <p role="alert" className="text-sm text-red-700">
                {save.error instanceof Error ? save.error.message : "Erro ao guardar."}
              </p>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
