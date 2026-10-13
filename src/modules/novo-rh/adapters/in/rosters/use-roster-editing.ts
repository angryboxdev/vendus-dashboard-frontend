import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from "react";
import type { RosterShift, ShiftInput, Violation } from "../../../domain/entities/rosters.ts";
import { cellKey, cellRect, copyInputs, paintInputs, parseCellKey, type CellRef } from "../../../domain/services/roster-edit.service.ts";
import { violationsOf } from "../../../domain/services/rosters.service.ts";
import { groupByEmployee, type EditOp } from "../../../domain/services/edit-history.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

/** Ligações da grelha à edição direta (seleção, arrastar, copiar/colar). */
export interface BoardEdit {
  selected: Set<string>;
  targets: Set<string>;
  clipboardId: string | null;
  draggingId: string | null;
  onCellPointerDown: (c: CellRef, e: PointerEvent) => void;
  onCellPointerEnter: (c: CellRef) => void;
  /** Enter/Espaço numa célula vazia (sem rato). */
  onCellKey: (c: CellRef) => void;
  onShiftHover: (s: RosterShift | null) => void;
  onShiftDragStart: (s: RosterShift, e: DragEvent) => void;
  onShiftDragEnd: () => void;
  onCellDragEnter: (c: CellRef) => void;
  onCellDragOver: (e: DragEvent) => void;
  onCellDrop: (c: CellRef, e: DragEvent) => void;
  /** Turno largado: a escolha "Mover / Copiar" aparece na célula onde se largou. */
  prompt: { dropKey: string; count: number; canMove: boolean } | null;
  onPromptMove: () => void;
  onPromptCopy: () => void;
  onPromptCancel: () => void;
  /** × num turno pendente (nunca publicado): retira-o sem confirmação (pode desfazer-se). */
  onRemove: (s: RosterShift) => void;
}

export interface DropPrompt {
  source: RosterShift;
  targets: CellRef[];
  /** Célula onde o turno foi largado (onde aparece a escolha). */
  drop: CellRef;
}

export interface EditFailure {
  cell: CellRef;
  message: string;
}

/** Atalhos não se aplicam enquanto se escreve num campo. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

const errorText = (e: unknown) => {
  const v = violationsOf(e);
  if (v?.violations[0]) return v.violations[0].message;
  return e instanceof Error ? e.message : "Erro";
};

/**
 * Edição direta da escala (Novo RH, real e demonstração):
 * - clicar/arrastar em células escolhe dias (com um modelo escolhido em
 *   "Atribuir turnos", os dias pintados recebem-no logo, em massa);
 * - arrastar um turno para outro dia pergunta "Mover" ou "Copiar"; arrastar
 *   por vários dias pinta-os e copia para todos;
 * - Ctrl+C copia o turno sob o rato (ou o aberto), Ctrl+V cola nos dias
 *   escolhidos; Esc limpa a escolha.
 * Cada turno criado passa pelas mesmas regras da API (avisos e bloqueios).
 */
export function useRosterEditing(o: {
  rosterId: string;
  enabled: boolean;
  people: string[];
  days: string[];
  /** Células que já têm turno (em massa, não se põe outro por cima). */
  occupied: Set<string>;
  paint: string;
  /** Turno aberto no painel lateral (também se copia com Ctrl+C). */
  openShift: RosterShift | null;
  shiftTitle: (s: RosterShift) => string;
  onWarnings: (v: Violation[]) => void;
  /** 409 numa remoção: confirmar avisos e repetir. */
  onConfirm: (v: Violation[], retry: () => void) => void;
  refresh: () => Promise<unknown>;
  /** Período visível (as operações inversas atuam só nele). */
  from: string;
  to: string;
  /** Regista a operação para Desfazer/Refazer. */
  record: (op: EditOp) => void;
}) {
  const { rosters } = useNovoRh();
  const [selected, setSelectedState] = useState<Set<string>>(new Set());
  // Espelho síncrono da seleção (o fim do arrasto lê-o sem esperar por um render).
  const sel = useRef<Set<string>>(new Set());
  const setSelected = useCallback((next: Set<string>) => {
    sel.current = next;
    setSelectedState(next);
  }, []);
  const [drag, setDrag] = useState<{ source: RosterShift; anchor: CellRef | null; targets: Set<string> } | null>(null);
  const [prompt, setPrompt] = useState<DropPrompt | null>(null);
  // Mover um turno já publicado pede o motivo (o ecrã mostra o diálogo).
  const [askReason, setAskReason] = useState(false);
  const promptOpen = useRef(false);
  useEffect(() => {
    promptOpen.current = !!prompt;
  }, [prompt]);
  const [clipboard, setClipboard] = useState<RosterShift | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failures, setFailures] = useState<EditFailure[]>([]);
  const [busy, setBusy] = useState(false);
  // Um lote de cada vez (repetir enquanto o anterior corre criaria duplicados).
  const running = useRef(false);
  const anchor = useRef<CellRef | null>(null);
  const selecting = useRef(false);
  const hover = useRef<RosterShift | null>(null);
  const latest = useRef(o);
  // Turnos a ser retirados (um clique repetido no mesmo × não faz nada).
  const removing = useRef(new Set<string>());
  // Ações da escolha "Mover / Copiar" (definidas mais abaixo; lidas só em eventos).
  const actions = useRef({ move: () => {}, copy: () => {} });
  // Opções mais recentes para os handlers (atualizadas depois de cada render).
  useLayoutEffect(() => {
    latest.current = o;
  });

  /** Cria os turnos um a um (cada um com as regras da API); junta avisos e recusas. */
  const createAll = useCallback(
    async (all: ShiftInput[], verb: string, skipOccupied = true): Promise<RosterShift[]> => {
      const { rosterId, occupied } = latest.current;
      if (!rosterId || all.length === 0 || running.current) return [];
      const inputs = skipOccupied ? all.filter((i) => !occupied.has(cellKey(i))) : all;
      const skipped = all.length - inputs.length;
      if (inputs.length === 0) {
        setNotice(`Os dias escolhidos já têm turno (${skipped} ignorado${skipped === 1 ? "" : "s"}).`);
        return [];
      }
      running.current = true;
      setBusy(true);
      setFailures([]);
      const warnings: Violation[] = [];
      const failed: EditFailure[] = [];
      const made: RosterShift[] = [];
      for (const input of inputs) {
        try {
          const r = await rosters.addShift(rosterId, input);
          warnings.push(...r.warnings);
          made.push(r.shift);
        } catch (e) {
          failed.push({ cell: { employeeId: input.employeeId, workDate: input.workDate }, message: errorText(e) });
        }
      }
      await latest.current.refresh();
      running.current = false;
      setBusy(false);
      setFailures(failed);
      const created = made.length;
      // Mover regista a sua própria operação (criar + retirar a origem).
      if (created && verb !== "movidos") {
        const { from, to } = latest.current;
        latest.current.record({ type: "ASSIGN_SHIFT", affectedIds: made.map((m) => m.id), inversePayload: { byEmployee: groupByEmployee(made), from, to } });
      }
      const ignored = skipped ? ` ${skipped} dia${skipped === 1 ? "" : "s"} com turno ignorado${skipped === 1 ? "" : "s"}.` : "";
      setNotice(created ? `${created} ${created === 1 ? "turno" : "turnos"} ${verb} (por publicar).${ignored}` : ignored.trim() || null);
      if (warnings.length) latest.current.onWarnings(warnings);
      return made;
    },
    [rosters],
  );

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    anchor.current = null;
  }, [setSelected]);

  const paintSelection = useCallback(
    async (keys: Set<string>) => {
      const { paint } = latest.current;
      if (!paint || keys.size === 0) return;
      clearSelection();
      await createAll(paintInputs(paint, [...keys].map(parseCellKey)), "atribuídos");
    },
    [clearSelection, createAll],
  );

  const paste = useCallback(async () => {
    if (!clipboard) return;
    if (selected.size === 0) {
      setNotice("Escolha primeiro os dias (clique ou arraste nas células) e prima Ctrl+V.");
      return;
    }
    const inputs = copyInputs(clipboard, [...selected].map(parseCellKey));
    clearSelection();
    await createAll(inputs, "colados");
  }, [clipboard, selected, clearSelection, createAll]);

  const copy = useCallback((s: RosterShift | null) => {
    if (!s) return;
    setClipboard(s);
    setNotice(`Turno copiado: ${latest.current.shiftTitle(s)}. Escolha os dias e prima Ctrl+V.`);
  }, []);

  // Seleção a arrastar acaba ao largar o rato (com um modelo escolhido, atribui-o logo).
  useEffect(() => {
    const up = () => {
      if (!selecting.current) return;
      selecting.current = false;
      if (latest.current.paint) void paintSelection(sel.current);
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [paintSelection]);

  // Ctrl+C / Ctrl+V / Esc.
  useEffect(() => {
    if (!o.enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      // Texto selecionado = cópia normal do browser; com o diálogo aberto, nada atrás dele.
      if (mod && (window.getSelection()?.toString() || promptOpen.current)) return;
      if (mod && e.key.toLowerCase() === "c") {
        const s = hover.current ?? latest.current.openShift;
        if (s) {
          e.preventDefault();
          copy(s);
        }
      } else if (mod && e.key.toLowerCase() === "v") {
        if (clipboard) {
          e.preventDefault();
          void paste();
        }
      } else if (e.key === "Escape") {
        clearSelection();
        setDrag(null);
        setPrompt(null);
        setAskReason(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [o.enabled, clipboard, copy, paste, clearSelection]);

  const edit: BoardEdit = useMemo(
    () => ({
      selected,
      targets: drag?.targets ?? new Set(),
      clipboardId: clipboard?.id ?? null,
      draggingId: drag?.source.id ?? null,
      onCellPointerDown: (c, e) => {
        if (e.button !== 0) return;
        selecting.current = true;
        const extend = e.ctrlKey || e.metaKey || e.shiftKey;
        if (e.shiftKey && anchor.current) {
          const rect = cellRect(latest.current.people, latest.current.days, anchor.current, c);
          setSelected(new Set(rect.map(cellKey)));
          return;
        }
        anchor.current = c;
        const next = extend ? new Set(sel.current) : new Set<string>();
        next.add(cellKey(c));
        setSelected(next);
      },
      onCellPointerEnter: (c) => {
        if (!selecting.current || !anchor.current) return;
        setSelected(new Set(cellRect(latest.current.people, latest.current.days, anchor.current, c).map(cellKey)));
      },
      onCellKey: (c) => {
        if (latest.current.paint) {
          void paintSelection(new Set([cellKey(c)]));
          return;
        }
        anchor.current = c;
        const next = new Set(sel.current);
        const k = cellKey(c);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        setSelected(next);
      },
      onShiftHover: (s) => {
        hover.current = s;
      },
      onShiftDragStart: (s, e) => {
        e.dataTransfer?.setData("text/plain", s.id);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "copyMove";
        clearSelection();
        setDrag({ source: s, anchor: null, targets: new Set() });
      },
      onShiftDragEnd: () => setDrag(null),
      onCellDragEnter: (c) => {
        setDrag((d) => {
          if (!d) return d;
          const own = cellKey(c) === cellKey(d.source);
          if (own && !d.anchor) return d;
          const a = d.anchor ?? c;
          const rect = cellRect(latest.current.people, latest.current.days, a, c)
            .map(cellKey)
            .filter((k) => k !== cellKey(d.source));
          return { ...d, anchor: a, targets: new Set(rect) };
        });
      },
      onCellDragOver: (e) => {
        if (!drag) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      },
      prompt: prompt ? { dropKey: cellKey(prompt.drop), count: prompt.targets.length, canMove: prompt.targets.length === 1 } : null,
      onPromptMove: () => actions.current.move(),
      onPromptCopy: () => actions.current.copy(),
      onRemove: (s) => {
        if (s.published !== null || removing.current.has(s.id)) return;
        removing.current.add(s.id);
        void (async () => {
          try {
            await rosters.deleteShift(s.id, { reason: null, confirm: false });
            const { from, to } = latest.current;
            latest.current.record({ type: "REMOVE_SHIFT", affectedIds: [s.id], inversePayload: { byEmployee: { [s.employeeId]: [s.id] }, from, to } });
          } catch (e) {
            setFailures([{ cell: s, message: errorText(e) }]);
          } finally {
            removing.current.delete(s.id);
            await latest.current.refresh();
          }
        })();
      },
      onPromptCancel: () => {
        setPrompt(null);
        setAskReason(false);
      },
      onCellDrop: (c, e) => {
        e.preventDefault();
        if (!drag) return;
        const keys = drag.targets.size ? [...drag.targets] : [cellKey(c)].filter((k) => k !== cellKey(drag.source));
        setDrag(null);
        if (keys.length) setPrompt({ source: drag.source, targets: keys.map(parseCellKey), drop: c });
      },
    }),
    [selected, drag, clipboard, prompt, clearSelection, paintSelection, setSelected, rosters],
  );

  const copyPrompt = async () => {
    if (!prompt) return;
    const p = prompt;
    setPrompt(null);
    setAskReason(false);
    // Um só dia largado à mão: cria mesmo que já tenha turno (a API decide); vários dias: só os livres.
    await createAll(copyInputs(p.source, p.targets), "copiados", p.targets.length > 1);
  };

  /** Mover = criar no novo dia e retirar o original (com motivo se já estava publicado). */
  const movePrompt = async (reason: string | null) => {
    if (!prompt || prompt.targets.length !== 1) return;
    const { source, targets } = prompt;
    setPrompt(null);
    setAskReason(false);
    const made = await createAll(copyInputs(source, targets), "movidos", false);
    if (!made.length) return;
    const remove = async (confirm: boolean): Promise<void> => {
      try {
        await rosters.deleteShift(source.id, { reason, confirm });
        await latest.current.refresh();
        // Só um turno pendente se pode desfazer (retirar um publicado publica logo).
        if (source.published === null) {
          const { from, to } = latest.current;
          latest.current.record({ type: "MOVE_SHIFT", affectedIds: made.map((m) => m.id), inversePayload: { removed: { [source.employeeId]: [source.id] }, byEmployee: groupByEmployee(made), from, to } });
        }
      } catch (e) {
        const v = violationsOf(e);
        if (v?.kind === "confirm") latest.current.onConfirm(v.violations, () => void remove(true));
        else {
          setNotice(null);
          setFailures([{ cell: source, message: `O turno foi copiado, mas não foi possível retirar o original: ${errorText(e)}` }]);
        }
      }
    };
    await remove(false);
  };

  useLayoutEffect(() => {
    actions.current = {
      move: () => {
        if (!prompt) return;
        if (prompt.source.published) setAskReason(true);
        else void movePrompt(null);
      },
      copy: () => void copyPrompt(),
    };
  });

  return {
    edit,
    askReason,
    selectedCount: selected.size,
    clipboard,
    prompt,
    closePrompt: () => {
      setPrompt(null);
      setAskReason(false);
    },
    copyPrompt,
    movePrompt,
    paste,
    paintSelection: () => paintSelection(selected),
    clearSelection,
    notice,
    dismissNotice: () => setNotice(null),
    failures,
    busy,
  };
}
