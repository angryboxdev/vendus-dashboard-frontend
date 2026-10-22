import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

interface Move {
  person: OrgPerson;
  /** Trocar de lugar: quem está abaixo sobe para o lugar da pessoa (com estes responsáveis) antes de ela lhe passar a reportar. */
  swap?: { id: string; bosses: string[] };
  /** Responsáveis diretos novos (vazio = sem chefia; vários = co-chefia). */
  managerIds: string[];
  /** «Descer»: só os colegas do mesmo nível. */
  among?: string[];
}

/**
 * Mais → Organograma: modelos prontos (por chefia, centro ou departamento) a
 * partir do que já está registado. Em «Por chefia», «Organizar» permite mudar
 * a chefia direta: arrastar um cartão para o novo responsável, ↑ Subir, ↓ Descer,
 * Mover (clicar no cartão e depois no destino) ou ⋯ (diálogo, com co-chefia).
 * Quem partilha os mesmos responsáveis (ex.: os sócios) aparece num cartão conjunto.
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
  /** «Mover»: escolhida a pessoa, o próximo clique num cartão (ou na empresa) define a nova chefia. */
  const [picking, setPicking] = useState<OrgPerson | null>(null);
  useEffect(() => {
    if (!picking) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPicking(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [picking]);
  const chartRef = useRef<HTMLDivElement>(null);

  const list = useQuery({ queryKey: ["novo-rh", "people", "active", "orgchart"], queryFn: () => people.list({ status: "active" }) });
  const positions = useQuery({ queryKey: ["novo-rh", "catalog", "positions"], queryFn: () => people.listPositions() });
  const locations = useQuery({ queryKey: ["novo-rh", "settings", "locations"], queryFn: () => settings.listLocations() });
  const links = useQuery({ queryKey: ["novo-rh", "org-chart", today], queryFn: () => people.orgChart(today) });
  const departments = useQuery({ queryKey: ["novo-rh", "structure", "departments"], queryFn: () => structure.listDepartments(), retry: false });
  const assignments = useQuery({ queryKey: ["novo-rh", "structure", "assignments", "all"], queryFn: () => structure.listAllAssignments(), retry: false, enabled: model === "department" });
  const save = useMutation({
    mutationFn: async (m: Move) => {
      if (m.swap) await people.setDirectManagers(m.swap.id, m.swap.bosses, moveDate);
      return people.setDirectManagers(m.person.id, m.managerIds, moveDate);
    },
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
  const nameOf = new Map(orgPeople.map((p) => [p.id, p.name]));
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
  const mgrs = managersOf(orgPeople, links.data ?? []);
  const bossesOf = (id: string) => mgrs.get(id) ?? [];
  const moving = dragging ?? picking?.id ?? null;
  // Só a própria pessoa fica bloqueada: largar em alguém abaixo dela = trocar de lugar.
  const blocked = moving ? new Set([moving]) : null;
  const below = moving ? descendants(tree, moving) : null;
  const siblings = new Map<string, string[]>();
  const walk = (n: OrgNode) => {
    const ids = n.children.flatMap((c) => (c.kind === "group" ? (c.members ?? []).map((m) => m.id) : c.kind === "person" ? [c.id] : []));
    for (const id of ids) siblings.set(id, ids);
    n.children.forEach(walk);
  };
  walk(tree);
  const byPerson = new Map(orgPeople.map((x) => [x.id, x]));
  const peers = (id: string) => (siblings.get(id) ?? []).filter((x) => x !== id).map((x) => byPerson.get(x)!).filter(Boolean);

  /** Abre o diálogo; ao largar um cartão na mesma chefia não há nada a mudar. */
  const startMove = (person: OrgPerson, managerIds: string[], fromDrop = true, among?: string[]) => {
    setPicking(null);
    setDragging(null);
    if (fromDrop && sameSet(bossesOf(person.id), managerIds)) return;
    save.reset();
    setMoveDate(today);
    setMove({ person, managerIds, among });
  };
  /** ↑ passa a reportar às chefias das suas chefias (ou fica no topo). */
  const moveUp = (person: OrgPerson) => {
    const bosses = bossesOf(person.id);
    if (bosses.length) startMove(person, [...new Set(bosses.flatMap((b) => bossesOf(b)))].filter((x) => x !== person.id).slice(0, MAX_DIRECT));
  };
  /** ↓ passa a reportar a um colega do mesmo nível (escolhido no diálogo). */
  const moveDown = (person: OrgPerson) => {
    const list = peers(person.id);
    if (list.length) startMove(person, [list[0]!.id], false, list.map((x) => x.id));
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
  /** Largar (arrastar) ou clicar (em «Mover») num destino: o que se move passa a reportar a `managerIds`. */
  const dropOn = (managerIds: string[]) => {
    const who = orgPeople.find((x) => x.id === moving);
    if (canEdit && who) startMove(who, managerIds);
  };

  const personCard = (p: OrgPerson, nodeId: string): ReactNode => {
    const hit = found?.hits.has(nodeId) || found?.hits.has(p.id);
    const dropOk = canEdit && !!moving && !blocked?.has(p.id);
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
        className={`group relative flex w-60 flex-wrap items-center gap-3 rounded-2xl border bg-surface-card p-3 text-left shadow-card transition ${hit ? "border-brand-600 ring-2 ring-brand-500/30" : "border-line"} ${dropOk ? "cursor-pointer border-dashed border-brand-500 bg-brand-50" : ""} ${canEdit && !moving ? "cursor-grab active:cursor-grabbing" : ""} ${moving === p.id ? "opacity-60 ring-2 ring-brand-500" : ""} ${dropOk && below?.has(p.id) ? "border-amber-500 bg-amber-50" : ""}`}
        title={dropOk && below?.has(p.id) ? "Está abaixo — largar aqui troca de lugar" : undefined}
      >
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
            <Button size="sm" variant="tertiary" disabled={!mine.length} title={mine.length ? "Passa a reportar a um colega do mesmo nível" : "Sem colegas no mesmo nível"} aria-label={`Descer ${p.name} um nível`} onClick={() => moveDown(p)}>
              ↓ Descer
            </Button>
            <Button size="sm" variant="tertiary" aria-label={`Mover ${p.name}`} onClick={() => setPicking(p)}>
              Mover
            </Button>
            <IconButton label={`Responsáveis de ${p.name}`} size="sm" className="ml-auto" onClick={() => startMove(p, bosses, false)}>
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
      const groupOk = canEdit && !!moving && !ids.some((id) => blocked?.has(id));
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

  const moveBelow = move ? descendants(tree, move.person.id) : new Set<string>();
  const options = move
    ? orgPeople
        .filter((p) => p.id !== move.person.id && !move.managerIds.includes(p.id) && (!move.among || move.among.includes(p.id)))
        .map((p) => ({ id: p.id, label: moveBelow.has(p.id) ? `${p.name} (troca de lugar)` : p.name }))
    : [];
  const addOptions = options.filter((o) => !moveBelow.has(o.id));
  const swap = move && move.managerIds.length === 1 && moveBelow.has(move.managerIds[0]!) ? move.managerIds[0]! : null;
  const placeOf = (id: string) => {
    const b = bossesOf(id);
    return b.length ? `a reportar a ${b.map((x) => nameOf.get(x) ?? "—").join(" e ")}` : "logo abaixo da empresa";
  };
  const unchanged = !move || sameSet(bossesOf(move.person.id), move.managerIds);

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
            <Button variant={editing ? "primary" : "secondary"} onClick={() => (setEditing(!editing), setPicking(null))}>
              {editing ? "Terminar" : "Organizar"}
            </Button>
          )}
          <Button variant="secondary" onClick={exportPdf}>
            Imprimir / PDF
          </Button>
        </div>
      </div>
      {model === "managers" && !editing && <p className="text-sm text-ink-secondary">Para mudar chefias (subir, descer, mover ou pôr duas pessoas a chefiar em conjunto), carregue em «Organizar».</p>}
      {canEdit && !picking && (
        <AlertBanner
          tone="info"
          title="Arraste um cartão para cima do novo responsável — ou use ↑ Subir, ↓ Descer, Mover e ⋯ em cada cartão. Largar num cartão de chefia partilhada põe a pessoa a reportar a todos; largar na empresa deixa-a sem chefia."
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
      {model === "department" && (departments.isError || assignments.isError) && <AlertBanner tone="warning" title="Sem acesso à estrutura (departamentos) — mostre por chefia ou por centro." />}
      {term && found && found.hits.size === 0 && <p className="text-sm text-ink-secondary">Ninguém corresponde à pesquisa.</p>}

      <div className={`${SURFACE} overflow-auto p-6`} style={{ maxHeight: "75vh" }}>
        <div ref={chartRef} className="inline-block min-w-full" style={{ zoom }}>
          <div className="flex justify-center">{branch(tree)}</div>
        </div>
      </div>

      <Dialog
        open={move !== null}
        title="Responsáveis diretos"
        description={move ? `${move.person.name} passa a reportar a ${move.managerIds.length ? move.managerIds.map((id) => nameOf.get(id) ?? "—").join(" e ") : "ninguém (fica sem chefia)"}.` : undefined}
        onClose={() => setMove(null)}
        actions={
          <>
            <Button variant="secondary" onClick={() => setMove(null)}>
              Cancelar
            </Button>
            <Button variant="primary" disabled={!moveDate || unchanged || save.isPending} onClick={() => move && save.mutate({ ...move, swap: swap ? { id: swap, bosses: bossesOf(move.person.id) } : undefined })}>
              {save.isPending ? "A guardar…" : "Confirmar"}
            </Button>
          </>
        }
      >
        {move && (
          <div className="space-y-3">
            <div>
              <span className={LABEL}>Responsáveis</span>
              {move.managerIds.length === 0 ? (
                <p className="text-sm text-ink-secondary">Sem chefia (fica logo abaixo da empresa).</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {move.managerIds.map((id) => (
                    <li key={id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-sm text-navy-900">
                      {nameOf.get(id) ?? "—"}
                      <IconButton label={`Tirar ${nameOf.get(id) ?? ""}`} size="sm" onClick={() => setMove({ ...move, managerIds: move.managerIds.filter((x) => x !== id), among: undefined })}>
                        <IconClose size={12} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <span className={LABEL}>{move.managerIds.length ? "Trocar por / acrescentar" : "Escolher responsável"}</span>
              <div className="flex flex-wrap gap-2">
                <SearchableSelect label="Responsável" value="" options={options} onChange={(id) => id && setMove({ ...move, managerIds: [id], among: undefined })} />
                {move.managerIds.length > 0 && move.managerIds.length < MAX_DIRECT && !move.among && !swap && (
                  <SearchableSelect label="Acrescentar (chefia partilhada)" value="" options={addOptions} onChange={(id) => id && setMove({ ...move, managerIds: [...move.managerIds, id] })} />
                )}
              </div>
              <p className="mt-1 text-xs text-ink-secondary">Até {MAX_DIRECT} responsáveis em simultâneo (ex.: os dois sócios).</p>
            </div>
            {swap && (
              <AlertBanner tone="warning" title="Trocar de lugar">
                {nameOf.get(swap)} está abaixo de {move.person.name}. Ao confirmar, {nameOf.get(swap)} passa para o lugar de {move.person.name} ({placeOf(move.person.id)}) e {move.person.name} passa a reportar a {nameOf.get(swap)}. As restantes equipas mantêm-se.
              </AlertBanner>
            )}
            <label className="block">
              <span className={LABEL}>Com efeito a partir de</span>
              <input type="date" className={`${FIELD} w-full`} value={moveDate} onChange={(e) => setMoveDate(e.target.value)} />
            </label>
            <p className="text-xs text-ink-secondary">As chefias que saem terminam na véspera; ficam no histórico do colaborador (separador Responsáveis).</p>
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
