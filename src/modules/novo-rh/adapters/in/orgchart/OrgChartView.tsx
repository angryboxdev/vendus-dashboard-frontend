import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertBanner, Avatar, Button, Dialog, FIELD, IconButton, IconChevronDown, IconClose, IconMore, LABEL, SearchableSelect, SegmentedControl, SURFACE } from "../../../../../components/ui/index.ts";
import { descendants, managersOf, managersTree, pathsTo, teamSize, unitsTree, type OrgModel, type OrgNode, type OrgPerson } from "../../../domain/services/org-chart.service.ts";
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
/** Responsáveis diretos em simultâneo (co-chefia) — o mesmo limite do servidor. */
const MAX_DIRECT = 3;
const norm = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .filter((_, i, a) => i === 0 || i === a.length - 1)
    .join("");
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);
type Drafts = Map<string, string[]>;

/**
 * Mais → Organograma: modelos prontos (por chefia, centro ou departamento) a
 * partir do que já está registado. Em «Por chefia», «Organizar» abre um
 * rascunho: arrastar, ↑ Subir, ↓ Descer, Mover (clicar e depois clicar no
 * destino) e ⋯ (co-chefia) mudam só o desenho, à vontade, com «Desfazer».
 * «Guardar» grava tudo de uma vez, com data de efeito, pela ordem de cima para
 * baixo (assim nunca há ciclos a meio). Escolher alguém que está abaixo troca
 * de lugar. Quem partilha os mesmos responsáveis aparece num cartão conjunto.
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
  const [drafts, setDrafts] = useState<Drafts>(new Map());
  const [history, setHistory] = useState<Drafts[]>([]);
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(0);
  const [dragging, setDragging] = useState<string | null>(null);
  /** «Mover»: escolhida a pessoa, o próximo clique num cartão (ou na empresa) define a nova chefia. */
  const [picking, setPicking] = useState<OrgPerson | null>(null);
  /** ⋯: editar a lista de responsáveis (co-chefia) de uma pessoa. */
  const [editingOf, setEditingOf] = useState<{ person: OrgPerson; managerIds: string[] } | null>(null);
  /** ↓ Descer com vários colegas: escolher qual. */
  const [downOf, setDownOf] = useState<{ person: OrgPerson; peers: OrgPerson[] } | null>(null);
  useEffect(() => {
    if (!picking) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPicking(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [picking]);
  // Sair da página com alterações por guardar pede confirmação ao navegador.
  useEffect(() => {
    if (!drafts.size) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [drafts]);
  const chartRef = useRef<HTMLDivElement>(null);

  const list = useQuery({ queryKey: ["novo-rh", "people", "active", "orgchart"], queryFn: () => people.list({ status: "active" }) });
  const positions = useQuery({ queryKey: ["novo-rh", "catalog", "positions"], queryFn: () => people.listPositions() });
  const locations = useQuery({ queryKey: ["novo-rh", "settings", "locations"], queryFn: () => settings.listLocations() });
  const links = useQuery({ queryKey: ["novo-rh", "org-chart", today], queryFn: () => people.orgChart(today) });
  const departments = useQuery({ queryKey: ["novo-rh", "structure", "departments"], queryFn: () => structure.listDepartments(), retry: false });
  const assignments = useQuery({ queryKey: ["novo-rh", "structure", "assignments", "all"], queryFn: () => structure.listAllAssignments(), retry: false, enabled: model === "department" });

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
  const byPerson = new Map(orgPeople.map((p) => [p.id, p]));
  const nameOf = (id: string) => byPerson.get(id)?.name ?? "—";
  // O desenho usa o rascunho por cima do que está gravado.
  const serverLinks = links.data ?? [];
  const serverMgrs = managersOf(orgPeople, serverLinks);
  const shownLinks = [...serverLinks.filter((l) => !drafts.has(l.employeeId)), ...[...drafts].flatMap(([employeeId, ms]) => ms.map((managerEmployeeId) => ({ employeeId, managerEmployeeId })))];
  const tree =
    model === "managers"
      ? managersTree("Empresa", orgPeople, shownLinks)
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
  const mgrs = managersOf(orgPeople, shownLinks);
  const bossesOf = (id: string) => mgrs.get(id) ?? [];
  const moving = dragging ?? picking?.id ?? null;
  const below = moving ? descendants(tree, moving) : null;
  // Colegas = quem está lado a lado na árvore (por baixo do mesmo cartão).
  const siblings = new Map<string, string[]>();
  const walk = (n: OrgNode) => {
    const ids = n.children.flatMap((c) => (c.kind === "group" ? (c.members ?? []).map((m) => m.id) : c.kind === "person" ? [c.id] : []));
    for (const id of ids) siblings.set(id, ids);
    n.children.forEach(walk);
  };
  walk(tree);
  const peers = (id: string) => (siblings.get(id) ?? []).filter((x) => x !== id).map((x) => byPerson.get(x)!).filter(Boolean);
  const changed = (id: string) => drafts.has(id);

  /**
   * Muda o rascunho: `person` passa a reportar a `managerIds`. Se o novo
   * (único) responsável está abaixo, troca de lugar: esse sobe primeiro para o
   * lugar da pessoa. Voltar ao que está gravado tira a pessoa do rascunho.
   */
  const apply = (person: OrgPerson, managerIds: string[]) => {
    setPicking(null);
    setDragging(null);
    if (sameSet(bossesOf(person.id), managerIds)) return;
    const next: Drafts = new Map(drafts);
    const set = (id: string, ms: string[]) => (sameSet(serverMgrs.get(id) ?? [], ms) ? next.delete(id) : next.set(id, [...ms]));
    const target = managerIds.length === 1 ? managerIds[0]! : null;
    const under = descendants(tree, person.id);
    if (target && under.has(target)) set(target, bossesOf(person.id));
    else if (managerIds.some((m) => under.has(m))) return; // co-chefia com alguém de baixo: não
    set(person.id, managerIds);
    setHistory([...history, drafts]);
    setDrafts(next);
    setSaved(0);
    setSaveError(null);
  };
  const undo = () => {
    if (!history.length) return;
    setDrafts(history.at(-1)!);
    setHistory(history.slice(0, -1));
  };
  const discard = () => (setDrafts(new Map()), setHistory([]), setSaveError(null));
  /** ↑ passa a reportar às chefias das suas chefias (ou fica no topo). */
  const moveUp = (person: OrgPerson) => {
    const bosses = bossesOf(person.id);
    if (bosses.length) apply(person, [...new Set(bosses.flatMap((b) => bossesOf(b)))].filter((x) => x !== person.id).slice(0, MAX_DIRECT));
  };
  /** ↓ passa a reportar a um colega do lado (escolhe-se se houver vários). */
  const moveDown = (person: OrgPerson) => {
    const list = peers(person.id);
    if (list.length === 1) apply(person, [list[0]!.id]);
    else if (list.length > 1) setDownOf({ person, peers: list });
  };
  /** Largar (arrastar) ou clicar (em «Mover») num destino. */
  const dropOn = (managerIds: string[]) => {
    const who = moving ? byPerson.get(moving) : null;
    if (canEdit && who) apply(who, managerIds);
  };
  /** Guarda o rascunho de cima para baixo (a ordem da árvore final): nunca há ciclos a meio. */
  const save = async () => {
    setSaving(true);
    setSaveError(null);
    const order: string[] = [];
    const visit = (n: OrgNode) => {
      if (n.kind === "person") order.push(n.id);
      if (n.kind === "group") order.push(...(n.members ?? []).map((m) => m.id));
      n.children.forEach(visit);
    };
    visit(tree);
    const pending = order.filter((id) => drafts.has(id));
    const left: Drafts = new Map(drafts);
    try {
      for (const id of pending) {
        await people.setDirectManagers(id, drafts.get(id)!, effectiveDate);
        left.delete(id);
      }
      setSaved(pending.length);
    } catch (e) {
      setSaveError(`${e instanceof Error ? e.message : "Erro ao guardar."} (ficaram ${left.size} por guardar)`);
    } finally {
      setDrafts(left);
      setHistory([]);
      setSaving(false);
      await qc.invalidateQueries({ queryKey: ["novo-rh", "org-chart"] });
    }
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

  const personCard = (p: OrgPerson, nodeId: string): ReactNode => {
    const hit = found?.hits.has(nodeId) || found?.hits.has(p.id);
    const dropOk = canEdit && !!moving && moving !== p.id;
    const swap = dropOk && below?.has(p.id);
    const bosses = bossesOf(p.id);
    const mine = peers(p.id);
    return (
      <div
        key={p.id}
        draggable={canEdit}
        onDragStart={(e) => {
          e.stopPropagation();
          // Sem dados, alguns navegadores (Firefox) não começam a arrastar.
          e.dataTransfer.setData("text/plain", p.id);
          e.dataTransfer.effectAllowed = "move";
          setDragging(p.id);
        }}
        onDragEnd={() => setDragging(null)}
        onDragOver={(e) => dropOk && (e.preventDefault(), e.stopPropagation())}
        onDrop={(e) => {
          e.stopPropagation();
          if (dropOk) dropOn([p.id]);
        }}
        onClick={(e) => {
          if (!picking) return;
          e.stopPropagation();
          if (dropOk) dropOn([p.id]);
        }}
        title={swap ? "Está abaixo — largar aqui troca de lugar" : undefined}
        className={`group relative flex w-60 flex-wrap items-center gap-3 rounded-2xl border bg-surface-card p-3 text-left shadow-card transition ${hit ? "border-brand-600 ring-2 ring-brand-500/30" : "border-line"} ${dropOk ? (swap ? "cursor-pointer border-dashed border-amber-500 bg-amber-50" : "cursor-pointer border-dashed border-brand-500 bg-brand-50") : ""} ${canEdit && !moving ? "cursor-grab active:cursor-grabbing" : ""} ${moving === p.id ? "opacity-60 ring-2 ring-brand-500" : ""}`}
      >
        {changed(p.id) && <span className="absolute -top-2 right-3 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">Alterado</span>}
        {p.photoUrl ? (
          <Avatar name={p.name} photoUrl={p.photoUrl} size="md" />
        ) : (
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ED5C32] to-[#F08A4B] text-sm font-semibold text-white">
            {initials(p.name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {/* A organizar, o nome não é ligação: clicar no cartão nunca abre a ficha. */}
          {canEdit ? (
            <p className="truncate text-sm font-semibold text-navy-900">{p.name}</p>
          ) : (
            <Link to={`/hr/novo/pessoas/${encodeURIComponent(p.id)}`} className="block truncate text-sm font-semibold text-navy-900 hover:text-brand-600 hover:underline" draggable={false}>
              {p.name}
            </Link>
          )}
          <p className="truncate text-xs text-ink-secondary">{p.position ?? "Sem cargo"}</p>
          {p.location && <span className="mt-1 inline-block max-w-full truncate rounded-full bg-surface-soft px-2 py-0.5 text-[11px] text-ink-secondary">{p.location}</span>}
        </div>
        {canEdit && !moving && (
          <div className="flex w-full items-center gap-1 border-t border-line-subtle pt-2" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
            <Button size="sm" variant="tertiary" disabled={!bosses.length} title={bosses.length ? "Passa a reportar à chefia acima" : "Já está no topo"} aria-label={`Subir ${p.name} um nível`} onClick={() => moveUp(p)}>
              ↑ Subir
            </Button>
            <Button size="sm" variant="tertiary" disabled={!mine.length} title={mine.length ? "Passa a reportar a um colega do lado" : "Sem colegas ao lado"} aria-label={`Descer ${p.name} um nível`} onClick={() => moveDown(p)}>
              ↓ Descer
            </Button>
            <Button size="sm" variant="tertiary" aria-label={`Mover ${p.name}`} onClick={() => setPicking(p)}>
              Mover
            </Button>
            <IconButton label={`Responsáveis de ${p.name}`} size="sm" className="ml-auto" onClick={() => setEditingOf({ person: p, managerIds: bosses })}>
              <IconMore size={14} />
            </IconButton>
          </div>
        )}
      </div>
    );
  };

  const card = (n: OrgNode): ReactNode => {
    if (n.kind === "company")
      return (
        <div
          className={`rounded-2xl border-2 bg-surface-card px-6 py-4 text-center shadow-card ${canEdit && moving ? "cursor-pointer border-dashed border-brand-500" : "border-brand-500/40"}`}
          onClick={() => canEdit && picking && dropOn([])}
          onDragOver={(e) => canEdit && dragging && e.preventDefault()}
          onDrop={() => dropOn([])}
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
    if (n.kind === "group") {
      // Co-chefia: largar/clicar no cartão conjunto (fora das pessoas) = reporta a todos.
      const ids = (n.members ?? []).map((m) => m.id);
      const groupOk = canEdit && !!moving && !ids.includes(moving) && !ids.some((id) => below?.has(id));
      return (
        <div
          role="group"
          aria-label={`Chefia partilhada: ${n.label}`}
          onDragOver={(e) => groupOk && e.preventDefault()}
          onDrop={() => groupOk && dropOn(ids)}
          onClick={() => picking && groupOk && dropOn(ids)}
          className={`rounded-3xl border-2 p-2 ${groupOk ? "cursor-pointer border-dashed border-brand-500 bg-brand-50" : "border-brand-500/30 bg-brand-50/50"}`}
        >
          <p className="pb-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-brand-600">Chefia partilhada</p>
          <div className="flex gap-2">{(n.members ?? []).map((m) => personCard(m, n.id))}</div>
        </div>
      );
    }
    return personCard(n.person!, n.id);
  };

  const branch = (n: OrgNode): ReactNode => {
    const open = isOpen(n);
    const size = teamSize(n);
    const leaves = n.children.every((c) => c.children.length === 0 && c.kind === "person");
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

  const editBelow = editingOf ? descendants(tree, editingOf.person.id) : new Set<string>();
  const editOptions = editingOf
    ? orgPeople.filter((p) => p.id !== editingOf.person.id && !editingOf.managerIds.includes(p.id)).map((p) => ({ id: p.id, label: editBelow.has(p.id) ? `${p.name} (troca de lugar)` : p.name }))
    : [];
  const addOptions = editOptions.filter((o) => !editBelow.has(o.id));

  return (
    <div className="space-y-4">
      <div className={`${SURFACE} flex flex-wrap items-center gap-3 p-3`}>
        <SegmentedControl<OrgModel> label="Modelo do organograma" value={model} onChange={(m) => (setModel(m), setCollapsed(new Set()), m !== "managers" && !drafts.size && setEditing(false))} items={MODELS} />
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
            <Button
              variant={editing ? "primary" : "secondary"}
              disabled={editing && drafts.size > 0}
              title={editing && drafts.size > 0 ? "Guarde ou descarte as alterações primeiro" : undefined}
              onClick={() => (setEditing(!editing), setPicking(null))}
            >
              {editing ? "Terminar" : "Organizar"}
            </Button>
          )}
          <Button variant="secondary" onClick={exportPdf}>
            Imprimir / PDF
          </Button>
        </div>
      </div>
      {model === "managers" && !editing && <p className="text-sm text-ink-secondary">Para mudar chefias à vontade (subir, descer, mover, trocar ou pôr duas pessoas a chefiar em conjunto), carregue em «Organizar» — nada fica gravado até carregar em «Guardar».</p>}
      {saved > 0 && !drafts.size && <AlertBanner tone="success" title={`${saved} alteração(ões) guardada(s) com efeito a partir de ${effectiveDate.split("-").reverse().join("/")}.`} />}
      {canEdit && !picking && (
        <AlertBanner
          tone="info"
          title="Rascunho: arraste os cartões ou use ↑ Subir, ↓ Descer, Mover e ⋯ — à vontade. Largar em alguém que está abaixo troca de lugar; no cartão de chefia partilhada, reporta a todos; na empresa, fica sem chefia. Nada é gravado até «Guardar»."
        />
      )}
      {canEdit && picking && (
        <AlertBanner
          tone="warning"
          title={`A mover ${picking.name}: clique no novo responsável (ou na empresa, para ficar sem chefia).`}
          action={
            <Button size="sm" variant="secondary" onClick={() => setPicking(null)}>
              Cancelar (Esc)
            </Button>
          }
        />
      )}
      {(drafts.size > 0 || saveError) && (
        <div className={`${SURFACE} sticky top-16 z-10 flex flex-wrap items-center gap-3 border-amber-300 bg-amber-50 p-3`} role="region" aria-label="Alterações por guardar">
          <p className="text-sm font-medium text-amber-900">{drafts.size} alteração(ões) por guardar</p>
          <label className="flex items-center gap-2 text-sm text-amber-900">
            Com efeito a partir de
            <input type="date" className={`${FIELD} h-9`} value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </label>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="tertiary" disabled={!history.length || saving} onClick={undo}>
              Desfazer
            </Button>
            <Button size="sm" variant="secondary" disabled={!drafts.size || saving} onClick={discard}>
              Descartar
            </Button>
            <Button size="sm" variant="primary" disabled={!drafts.size || !effectiveDate || saving} onClick={() => void save()}>
              {saving ? "A guardar…" : "Guardar"}
            </Button>
          </div>
          {saveError && (
            <p role="alert" className="w-full text-sm text-red-700">
              {saveError}
            </p>
          )}
        </div>
      )}
      {model === "department" && (departments.isError || assignments.isError) && <AlertBanner tone="warning" title="Sem acesso à estrutura (departamentos) — mostre por chefia ou por centro." />}
      {term && found && found.hits.size === 0 && <p className="text-sm text-ink-secondary">Ninguém corresponde à pesquisa.</p>}

      <div className={`${SURFACE} overflow-auto p-6`} style={{ maxHeight: "75vh" }}>
        <div ref={chartRef} className="inline-block min-w-full" style={{ zoom }}>
          <div className="flex justify-center">{branch(tree)}</div>
        </div>
      </div>

      <Dialog
        open={downOf !== null}
        title="Descer — para baixo de quem?"
        description={downOf ? `${downOf.person.name} passa a reportar a um colega do lado.` : undefined}
        onClose={() => setDownOf(null)}
        actions={
          <Button variant="secondary" onClick={() => setDownOf(null)}>
            Cancelar
          </Button>
        }
      >
        <ul className="space-y-1">
          {(downOf?.peers ?? []).map((p) => (
            <li key={p.id}>
              <Button variant="tertiary" className="w-full justify-start" onClick={() => (apply(downOf!.person, [p.id]), setDownOf(null))}>
                {p.name}
              </Button>
            </li>
          ))}
        </ul>
      </Dialog>

      <Dialog
        open={editingOf !== null}
        title="Responsáveis diretos"
        description={editingOf ? `${editingOf.person.name} passa a reportar a ${editingOf.managerIds.length ? editingOf.managerIds.map(nameOf).join(" e ") : "ninguém (fica sem chefia)"}.` : undefined}
        onClose={() => setEditingOf(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditingOf(null)}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={!editingOf || sameSet(bossesOf(editingOf.person.id), editingOf.managerIds)} onClick={() => editingOf && (apply(editingOf.person, editingOf.managerIds), setEditingOf(null))}>
              Aplicar
            </Button>
          </>
        }
      >
        {editingOf && (
          <div className="space-y-3">
            <div>
              <span className={LABEL}>Responsáveis</span>
              {editingOf.managerIds.length === 0 ? (
                <p className="text-sm text-ink-secondary">Sem chefia (fica logo abaixo da empresa).</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {editingOf.managerIds.map((id) => (
                    <li key={id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-sm text-navy-900">
                      {nameOf(id)}
                      <IconButton label={`Tirar ${nameOf(id)}`} size="sm" onClick={() => setEditingOf({ ...editingOf, managerIds: editingOf.managerIds.filter((x) => x !== id) })}>
                        <IconClose size={12} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <span className={LABEL}>{editingOf.managerIds.length ? "Trocar por / acrescentar" : "Escolher responsável"}</span>
              <div className="flex flex-wrap gap-2">
                <SearchableSelect label="Responsável" value="" options={editOptions} onChange={(id) => id && setEditingOf({ ...editingOf, managerIds: [id] })} />
                {editingOf.managerIds.length > 0 && editingOf.managerIds.length < MAX_DIRECT && !editingOf.managerIds.some((m) => editBelow.has(m)) && (
                  <SearchableSelect label="Acrescentar (chefia partilhada)" value="" options={addOptions} onChange={(id) => id && setEditingOf({ ...editingOf, managerIds: [...editingOf.managerIds, id] })} />
                )}
              </div>
              <p className="mt-1 text-xs text-ink-secondary">Até {MAX_DIRECT} responsáveis em simultâneo (ex.: os dois sócios). Escolher alguém que está abaixo troca de lugar.</p>
            </div>
            <p className="text-xs text-ink-secondary">Fica no rascunho; grava-se com «Guardar».</p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
