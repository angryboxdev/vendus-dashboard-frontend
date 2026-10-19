import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, Button, IconChevronDown, Popover, SearchInput, Skeleton } from "../../../../../components/ui/index.ts";
import { busyLabel, pickerGroups, type PickerItem, type PickerPerson } from "../../../domain/services/roster-conflicts.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

type Section = "center" | "others" | "scheduled";

/**
 * «Adicionar colaboradores» (mesmo botão de sempre): três secções — do centro
 * da escala (aberta), de outros centros e já escalados noutros centros
 * (recolhidas) —, pesquisa em todos, seleção de vários. Adicionar à escala
 * não atribui horário: a sobreposição só se decide ao atribuir um turno.
 * Pesquisa e secções abertas mantêm-se ao mudar de semana.
 */
export interface PickerProps {
  rosterId: string;
  /** Nome do centro/grupo da escala (título da primeira secção). */
  rosterLabel: string;
  from: string;
  to: string;
  people: PickerPerson[];
  inRoster: Set<string>;
  locationName: (id: string | null) => string | null;
  onAdd: (ids: string[]) => void;
}

/** No botão da barra (popover por cima da grelha). */
export function AddEmployeesPicker({ trigger, ...props }: PickerProps & { trigger: (props: { open: boolean; toggle: () => void }) => ReactNode }) {
  return (
    <Popover label="Adicionar colaboradores" width="w-80" align="right" portal trigger={trigger}>
      {(close) => <AddEmployeesBody {...props} onClose={close} />}
    </Popover>
  );
}

/** Conteúdo do seletor (também usado no painel «Adicionar» em ecrãs pequenos). */
export function AddEmployeesBody({ rosterId, rosterLabel, from, to, people, inRoster, locationName, onAdd, onClose }: PickerProps & { onClose: () => void }) {
  const { rosters } = useNovoRh();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Record<Section, boolean>>({ center: true, others: false, scheduled: false });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const candidates = useQuery({
    queryKey: ["novo-rh", "rosters", "candidates", rosterId, from, to],
    queryFn: () => rosters.candidates(rosterId, from, to),
    enabled: !!rosterId,
    staleTime: 30_000,
  });
  const groups = pickerGroups({ people, inRoster, candidates: candidates.data, locationName, search });
  const searching = search.trim().length > 0;
  const total = groups.center.length + groups.others.length + groups.scheduled.length;
  const toggle = (id: string) => setPicked((p) => (p.has(id) ? new Set([...p].filter((x) => x !== id)) : new Set([...p, id])));

  const row = (x: PickerItem, showCenter: boolean) => (
    <li key={x.id}>
      <label className={`flex items-start gap-2.5 rounded-xl px-2 py-1.5 text-sm ${x.inRoster ? "opacity-60" : "cursor-pointer hover:bg-surface-soft"}`}>
        <input type="checkbox" className="mt-2" checked={x.inRoster || picked.has(x.id)} disabled={x.inRoster} onChange={() => toggle(x.id)} aria-label={x.name} />
        <Avatar name={x.name} photoUrl={x.photoUrl} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-navy-900">{x.name}</span>
          <span className="block truncate text-xs text-ink-secondary">
            {x.inRoster ? "Já está na escala" : showCenter ? (x.locationName ?? "Sem centro") : x.busy.length ? "" : "Sem turnos noutras escalas nesta semana"}
          </span>
          {x.busy.length > 0 && (
            <span className="mt-0.5 block text-xs text-amber-800" title={x.busy.map(busyLabel).join("\n")}>
              {x.busy.slice(0, 2).map(busyLabel).join(" · ")}
              {x.busy.length > 2 && ` · +${x.busy.length - 2}`}
            </span>
          )}
        </span>
      </label>
    </li>
  );

  const section = (key: Section, title: string, items: PickerItem[], showCenter: boolean) => {
    const expanded = searching || open[key];
    return (
      <section key={key} aria-label={title}>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}
          className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-secondary hover:bg-surface-soft"
        >
          <span className="truncate">
            {title} <span className="font-normal normal-case tracking-normal text-ink-muted">— {items.length}</span>
          </span>
          <IconChevronDown size={14} className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
        {expanded && (items.length ? <ul className="space-y-0.5">{items.map((x) => row(x, showCenter))}</ul> : <p className="px-2 pb-1 text-xs text-ink-muted">Ninguém nesta secção.</p>)}
      </section>
    );
  };

  return (
    <div className="space-y-2 p-1.5">
      <p className="px-1 text-sm font-semibold text-navy-900">Adicionar colaboradores</p>
      <SearchInput label="Pesquisar colaborador ou centro..." value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="max-h-80 space-y-1 overflow-y-auto pr-0.5">
        {candidates.isLoading ? (
          <div className="space-y-2 p-2" aria-hidden="true">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : candidates.isError ? (
          <p className="p-2 text-sm text-red-700">Não foi possível carregar os colaboradores.</p>
        ) : searching && total === 0 ? (
          <p className="p-2 text-sm text-ink-secondary">Sem resultados para «{search.trim()}».</p>
        ) : people.length === 0 ? (
          <p className="p-2 text-sm text-ink-secondary">Não há colaboradores ativos.</p>
        ) : (
          <>
            {section("center", rosterLabel, groups.center, false)}
            {section("others", "Outros centros", groups.others, true)}
            {section("scheduled", "Já escalados noutros centros", groups.scheduled, true)}
          </>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-line-subtle pt-2">
        <Button size="sm" variant="tertiary" onClick={() => (setPicked(new Set()), onClose())}>
          Cancelar
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={picked.size === 0}
          onClick={() => {
            onAdd([...picked]);
            setPicked(new Set());
            onClose();
          }}
        >
          {picked.size ? `Adicionar (${picked.size})` : "Adicionar"}
        </Button>
      </div>
    </div>
  );
}
