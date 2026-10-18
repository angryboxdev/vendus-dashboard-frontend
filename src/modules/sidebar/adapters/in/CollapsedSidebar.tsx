import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AppIcon } from "../../../../components/ui/app-icons.tsx";
import type { NavGroup, NavItem, SidebarNavEntry } from "../../domain/entities/nav-item.ts";
import { isItemActive } from "../../domain/services/nav-state.service.ts";
import type { UseSidebarResult } from "./use-sidebar.ts";

const ICON_BTN = "relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ED5C32]";
const iconClass = (active: boolean) => `${ICON_BTN} ${active ? "bg-[#24324F] text-white shadow-[inset_3px_0_0_#C9643A]" : "text-slate-300 hover:bg-white/5 hover:text-white"}`;

/** Rótulo ao passar o rato ou focar com o teclado (o nome acessível vem do `aria-label`). */
function Tip({ text }: { text: string }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block group-focus-within:block">
      {text}
    </span>
  );
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="absolute -right-1 -top-1 rounded-full bg-[#ED5C32] px-1 text-[10px] font-semibold leading-4 text-white">{count}</span>;
}

function ItemIcon({ item, badge }: { item: NavItem; badge: number }) {
  const { pathname } = useLocation();
  return (
    <div className="group relative">
      <NavLink
        to={item.path}
        end={item.end}
        aria-label={badge > 0 ? `${item.label} (${badge} por decidir)` : item.label}
        className={({ isActive }) => iconClass(isActive || !!item.match?.some((p) => isItemActive(p, pathname)))}
      >
        {item.icon ? <AppIcon name={item.icon} /> : <span className="text-xs font-semibold">{item.label.slice(0, 2)}</span>}
        <Badge count={badge} />
      </NavLink>
      <Tip text={item.label} />
    </div>
  );
}

/** Grupo: ícone que abre um menu flutuante com os sub-itens (nenhuma rota fica inacessível). */
function GroupIcon({ group, active, badges }: { group: NavGroup; active: boolean; badges: UseSidebarResult["badges"] }) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const total = group.items.reduce((s, i) => s + (i.badgeKey ? (badges[i.badgeKey] ?? 0) : 0), 0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    panel.current?.querySelector<HTMLElement>("a")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div className="group relative">
      <button
        ref={btn}
        type="button"
        aria-label={group.label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={iconClass(active)}
        onClick={() => {
          setTop(btn.current?.getBoundingClientRect().top ?? 0);
          setOpen((o) => !o);
        }}
      >
        {group.icon ? <AppIcon name={group.icon} /> : <span className="text-xs font-semibold">{group.label.slice(0, 2)}</span>}
        <Badge count={total} />
      </button>
      {!open && <Tip text={group.label} />}
      {open && (
        <div ref={panel} role="menu" aria-label={group.label} className="fixed left-[76px] z-50 w-56 rounded-xl border border-white/10 bg-[#1B2438] p-2 shadow-2xl" style={{ top }}>
          <p className="px-3 pb-1.5 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.label}</p>
          {group.items.map((i) => {
            const b = i.badgeKey ? (badges[i.badgeKey] ?? 0) : 0;
            return (
              <NavLink
                key={i.path}
                role="menuitem"
                to={i.path}
                end={i.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ED5C32] ${
                    isActive || i.match?.some((p) => isItemActive(p, pathname)) ? "bg-[#24324F] font-semibold text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <span className="flex items-center gap-2.5">
                  {i.icon && <AppIcon name={i.icon} size={18} className="opacity-90" />}
                  {i.label}
                </span>
                {b > 0 && <span className="rounded-full bg-[#ED5C32] px-1.5 text-[10px] font-semibold leading-4 text-white">{b}</span>}
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Barra lateral recolhida (desktop, 72 px): só ícones, tooltips e menus flutuantes. */
export function CollapsedSidebarBody({
  tree,
  isGroupActive,
  badges,
  onExpand,
  onSignOut,
}: {
  tree: SidebarNavEntry[];
  isGroupActive: (id: string) => boolean;
  badges: UseSidebarResult["badges"];
  onExpand: () => void;
  onSignOut: () => void;
}) {
  return (
    <>
      <div className="flex flex-col items-center gap-3 pb-3 pt-4">
        <div className="h-2 w-2 rounded-full bg-gradient-to-br from-[#ED5C32] to-[#EF8935]" aria-hidden="true" />
        <div className="group relative">
          <button type="button" aria-label="Expandir barra lateral" aria-expanded={false} onClick={onExpand} className={`${ICON_BTN} text-slate-300 hover:bg-white/5 hover:text-white`}>
            <AppIcon name="expand" />
          </button>
          <Tip text="Expandir" />
        </div>
      </div>
      <nav aria-label="Navegação principal" className="flex flex-1 flex-col items-center gap-1 pb-4">
        {tree.map((e) =>
          e.kind === "item" ? (
            <ItemIcon key={e.path} item={e} badge={e.badgeKey ? (badges[e.badgeKey] ?? 0) : 0} />
          ) : (
            <GroupIcon key={e.id} group={e} active={isGroupActive(e.id)} badges={badges} />
          ),
        )}
      </nav>
      <div className="flex flex-col items-center border-t border-white/10 py-3">
        <div className="group relative">
          <button type="button" aria-label="Sair" onClick={onSignOut} className={`${ICON_BTN} text-slate-300 hover:bg-white/5 hover:text-white`}>
            <AppIcon name="logout" />
          </button>
          <Tip text="Sair" />
        </div>
      </div>
    </>
  );
}
