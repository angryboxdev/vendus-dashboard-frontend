import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconChevronDown, IconSearch } from "./icons.tsx";
import { FIELD, MENU_ITEM, POPOVER } from "./ui-classes.ts";

/**
 * Popover: abre por baixo do gatilho; fecha com Esc, clique fora ou ao
 * escolher. Entra com um "pop" curto (respeita movimento reduzido).
 */
export function Popover({
  trigger,
  children,
  align = "left",
  width = "w-64",
  label,
  className = "relative",
  portal = false,
}: {
  trigger: (props: { open: boolean; toggle: () => void; id: string }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  width?: string;
  label?: string;
  /** Contentor do gatilho (por omissão `relative`; ex.: `absolute inset-0` para ocupar uma célula). */
  className?: string;
  /**
   * Abre fora do contentor (no `body`, posição fixa junto ao gatilho): para
   * gatilhos dentro de tabelas com scroll ou colunas fixas, onde o painel
   * ficaria cortado ou por trás das células seguintes.
   */
  portal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const inside = (t: EventTarget | null) => !!t && ((ref.current?.contains(t as Node) ?? false) || (panel.current?.contains(t as Node) ?? false));
    const onDown = (e: MouseEvent) => !inside(e.target) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open || !portal) return;
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 8, left: r.left, right: window.innerWidth - r.right });
    };
    place();
    // Acompanha o gatilho ao fazer scroll (página ou tabela) e ao redimensionar.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, portal]);
  const content = (cls: string, style?: CSSProperties) => (
    <div ref={panel} id={id} role="dialog" aria-label={label} style={style} className={`${cls} ${width} ${POPOVER} motion-safe:animate-motion-pop-in`}>
      {children(() => setOpen(false))}
    </div>
  );
  return (
    <div ref={ref} className={className}>
      {trigger({ open, toggle: () => setOpen((o) => !o), id })}
      {open && !portal && content(`absolute top-full z-40 mt-2 ${align === "right" ? "right-0" : "left-0"}`)}
      {open &&
        portal &&
        pos &&
        createPortal(content("ds fixed z-[60] font-sans", align === "right" ? { top: pos.top, right: pos.right } : { top: pos.top, left: pos.left }), document.body)}
    </div>
  );
}

export interface MenuEntry {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  hint?: string;
  danger?: boolean;
}

/** Menu de ações (ex.: "Adicionar ▾"). Itens desativados mostram o motivo em `hint`. */
export function DropdownMenu({
  label,
  items,
  trigger,
  align = "right",
  className,
  portal,
}: {
  label: string;
  items: (MenuEntry | "separator")[];
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  align?: "left" | "right";
  className?: string;
  /** Abre por cima de tudo (ver `Popover`). */
  portal?: boolean;
}) {
  return (
    <Popover label={label} align={align} width="w-64" className={className} portal={portal} trigger={({ open, toggle }) => trigger({ open, toggle })}>
      {(close) => (
        <div role="menu" aria-label={label}>
          {items.map((i, n) =>
            i === "separator" ? (
              <div key={`s${n}`} className="my-1 border-t border-line-subtle" />
            ) : (
              <button
                key={i.label}
                type="button"
                role="menuitem"
                disabled={i.disabled}
                title={i.disabled ? i.hint : undefined}
                onClick={() => {
                  close();
                  i.onSelect();
                }}
                className={`${MENU_ITEM} ${i.danger ? "text-red-700 hover:bg-red-50" : ""}`}
              >
                {i.icon && <span className="text-ink-secondary">{i.icon}</span>}
                <span className="flex-1">
                  {i.label}
                  {i.disabled && i.hint && <span className="block text-xs text-ink-muted">{i.hint}</span>}
                </span>
              </button>
            ),
          )}
        </div>
      )}
    </Popover>
  );
}

/**
 * Seleção com pesquisa num popover (ex.: Local, Colaborador): a pesquisa
 * aparece quando há muitas opções. `value` vazio = opção "todos".
 */
export function SearchableSelect({
  label,
  value,
  options,
  onChange,
  allLabel,
  icon,
  disabled,
  triggerClassName = "",
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
  /** Rótulo da opção "todos" (sem ela, é obrigatório escolher). */
  allLabel?: string;
  icon?: ReactNode;
  disabled?: boolean;
  triggerClassName?: string;
}) {
  const [q, setQ] = useState("");
  const current = options.find((o) => o.id === value)?.label ?? allLabel ?? label;
  const all = allLabel ? [{ id: "", label: allLabel }, ...options] : options;
  const shown = q ? all.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : all;
  return (
    <Popover
      label={label}
      width="w-72"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`${label}: ${current}`}
          disabled={disabled}
          onClick={toggle}
          className={`inline-flex items-center gap-3 rounded-2xl border border-line bg-surface-card px-4 text-sm font-medium text-navy-900 shadow-card transition duration-150 hover:border-navy-900/25 disabled:cursor-default disabled:hover:border-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${triggerClassName || "h-12"}`}
        >
          {icon && <span className="text-brand-600">{icon}</span>}
          <span className="truncate">{current}</span>
          {!disabled && <IconChevronDown size={16} className={`ml-auto pl-0 text-ink-secondary transition-transform duration-150 ${open ? "rotate-180" : ""}`} />}
        </button>
      )}
    >
      {(close) => (
        <div>
          {all.length > 7 && (
            <div className="relative mb-1.5">
              <IconSearch size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input autoFocus aria-label={`Pesquisar ${label.toLowerCase()}`} placeholder="Pesquisar…" className={`${FIELD} h-9 w-full pl-8`} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}
          <ul role="listbox" aria-label={label} className="max-h-72 overflow-y-auto">
            {shown.map((o) => (
              <li key={o.id || "all"} role="option" aria-selected={o.id === value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.id);
                    setQ("");
                    close();
                  }}
                  className={`${MENU_ITEM} ${o.id === value ? "font-medium text-navy-900" : ""}`}
                >
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.id === value && <IconCheck size={14} className="text-brand-600" />}
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="px-3 py-2 text-sm text-ink-muted">Sem resultados.</li>}
          </ul>
        </div>
      )}
    </Popover>
  );
}
