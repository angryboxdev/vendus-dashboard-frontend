import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  IconActivity,
  IconBox,
  IconBriefcase,
  IconBuilding,
  IconCalendar,
  IconCash,
  IconChart,
  IconChevronDown,
  IconClock,
  IconHeart,
  IconHistory,
  IconInbox,
  IconKey,
  IconLogout,
  IconMenu,
  IconReceipt,
  IconSettings,
  IconSparkle,
  IconStore,
  IconSun,
  IconUser,
  IconUsers,
  IconUtensils,
  IconWallet,
} from "../../../../components/ui/index.ts";
import { useSidebar } from "./use-sidebar.ts";
import type { NavGroup, NavItem, SidebarNavEntry } from "../../domain/entities/nav-item.ts";
import type { UseSidebarResult } from "./use-sidebar.ts";

// ── aspeto (Design System Mezza) ─────────────────────────────────────────────

/** Barra lateral navy; o item ativo em cobre preenchido, como no mockup. */
const SIDEBAR_BG = "bg-navy-900";

/** Ícone de cada entrada (só aspeto — os itens e as rotas não mudam). */
const GROUP_ICON: Record<string, ReactNode> = {
  dre: <IconChart size={20} />,
  stock: <IconBox size={20} />,
  hr: <IconBriefcase size={20} />,
  crm: <IconHeart size={20} />,
  financial: <IconWallet size={20} />,
};
const ITEM_ICON: [RegExp, ReactNode][] = [
  [/^\/cash-closings/, <IconCash size={20} />],
  [/^\/air-menu/, <IconUtensils size={20} />],
  [/^\/vendus/, <IconReceipt size={20} />],
  [/^\/empresa/, <IconBuilding size={20} />],
  [/^\/admin\/users/, <IconSettings size={20} />],
  [/^\/admin\/location-tokens/, <IconKey size={20} />],
  // Sub-itens (ícone mais pequeno).
  [/^\/hr\/overview/, <IconActivity size={17} />],
  [/^\/hr\/people/, <IconUser size={17} />],
  [/^\/hr\/schedules/, <IconCalendar size={17} />],
  [/^\/hr\/ferias/, <IconSun size={17} />],
  [/^\/hr\/assiduidade/, <IconClock size={17} />],
  [/^\/hr\/pedidos/, <IconInbox size={17} />],
  [/^\/hr\/historico/, <IconHistory size={17} />],
  [/^\/hr\/novo/, <IconSparkle size={17} />],
  [/^\/crm\/customers/, <IconUsers size={17} />],
];
const iconFor = (path: string) => ITEM_ICON.find(([re]) => re.test(path))?.[1] ?? null;

const ROLE_LABEL: Record<string, string> = { admin: "Administrador", manager: "Gestor", hr_viewer: "RH (consulta)", employee: "Colaborador" };

function navLinkClass(sub: boolean) {
  return ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 ${
      sub ? "px-3 py-2 text-[13px]" : "px-3 py-2.5 text-sm"
    } ${isActive ? "bg-brand-600 font-medium text-white shadow-card" : "font-medium text-white/75 hover:bg-white/5 hover:text-white"}`;
}

function initials(email: string): string {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase() || "?";
}

// ── NavItemLink ───────────────────────────────────────────────────────────────

function NavItemLink({ item, onClick, badge = 0, sub = false }: { item: NavItem; onClick: () => void; badge?: number; sub?: boolean }) {
  const icon = iconFor(item.path);
  return (
    <NavLink to={item.path} end={item.end} className={navLinkClass(sub)} onClick={onClick}>
      <span className={`flex shrink-0 items-center justify-center ${sub ? "w-[18px]" : "w-5"}`}>{icon ?? (sub ? <span className="h-1 w-1 rounded-full bg-current opacity-60" /> : null)}</span>
      <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
      {badge > 0 && (
        <span className="rounded-full bg-brand-500 px-1.5 text-[10px] font-semibold leading-4 text-white" aria-label={`${badge} por decidir`}>
          {badge}
        </span>
      )}
    </NavLink>
  );
}

// ── NavGroupSection ───────────────────────────────────────────────────────────

function NavGroupSection({
  group,
  expanded,
  active,
  onToggle,
  onNavClick,
  badges,
}: {
  badges: UseSidebarResult["badges"];
  group: NavGroup;
  expanded: boolean;
  active: boolean;
  onToggle: () => void;
  onNavClick: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 ${
          active ? "bg-white/5 text-white" : "text-white/75 hover:bg-white/5 hover:text-white"
        }`}
      >
        <span className={`flex w-5 shrink-0 items-center justify-center ${active ? "text-brand-500" : ""}`}>{GROUP_ICON[group.id]}</span>
        <span className="min-w-0 flex-1 leading-snug">{group.label}</span>
        <IconChevronDown size={16} className={`shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""} ${active ? "text-white/80" : "text-white/40"}`} />
      </button>
      {expanded && (
        <div className="mt-1 flex flex-col gap-0.5 pl-3 motion-safe:animate-motion-fade">
          {group.items.map((item) => (
            <NavItemLink key={item.path} item={item} onClick={onNavClick} badge={item.badgeKey ? badges[item.badgeKey] : 0} sub />
          ))}
        </div>
      )}
    </div>
  );
}

// ── SidebarBody ───────────────────────────────────────────────────────────────

interface SidebarBodyProps {
  tree: SidebarNavEntry[];
  isGroupExpanded: (id: string) => boolean;
  isGroupActive: (id: string) => boolean;
  toggleGroup: (id: string) => void;
  userEmail: string;
  userRole: string;
  onNavClick: () => void;
  onSignOut: () => void;
  badges: UseSidebarResult["badges"];
}

function SidebarBody({ tree, isGroupExpanded, isGroupActive, toggleGroup, userEmail, userRole, onNavClick, onSignOut, badges }: SidebarBodyProps) {
  return (
    <>
      {/* Marca */}
      <div className="px-6 pb-6 pt-7">
        <img src="/mezza-erp.png" alt="Mezza ERP" className="h-9 w-auto" />
      </div>

      {/* Navegação */}
      <nav aria-label="Principal" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
        {tree.map((entry) => {
          if (entry.kind === "item") {
            return <NavItemLink key={entry.path} item={entry} onClick={onNavClick} badge={entry.badgeKey ? badges[entry.badgeKey] : 0} />;
          }
          return (
            <NavGroupSection
              key={entry.id}
              group={entry}
              expanded={isGroupExpanded(entry.id)}
              active={isGroupActive(entry.id)}
              onToggle={() => toggleGroup(entry.id)}
              onNavClick={onNavClick}
              badges={badges}
            />
          );
        })}
      </nav>

      {/* Organização e utilizador */}
      <div className="space-y-3 px-3 pb-4">
        <div className="flex items-center gap-2.5 rounded-xl border border-white/10 px-3 py-2.5 text-[13px] font-medium text-white/85">
          <IconStore size={18} className="shrink-0 text-brand-500" />
          <span className="truncate">Angry Box Hub</span>
        </div>
        <div className="flex items-center gap-3 border-t border-white/10 px-1 pt-4">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-600">
            {initials(userEmail)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-white">{userEmail}</span>
            <span className="block truncate text-xs text-white/55">{ROLE_LABEL[userRole] ?? userRole}</span>
          </span>
          <button type="button" onClick={onSignOut} aria-label="Sair" title="Sair" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/60 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60">
            <IconLogout size={18} />
          </button>
        </div>
      </div>
    </>
  );
}

// ── Sidebar (public export) ───────────────────────────────────────────────────

export function Sidebar() {
  const { tree, isGroupExpanded, isGroupActive, toggleGroup, userEmail, userRole, mobileOpen, openMobile, closeMobile, signOut, badges }: UseSidebarResult = useSidebar();

  const bodyProps: SidebarBodyProps = {
    tree,
    isGroupExpanded,
    isGroupActive,
    toggleGroup,
    userEmail,
    userRole,
    onNavClick: closeMobile,
    onSignOut: signOut,
    badges,
  };

  return (
    <>
      {/* Desktop */}
      <aside className={`sticky top-0 hidden h-screen w-[208px] flex-shrink-0 flex-col ${SIDEBAR_BG} md:flex`}>
        <SidebarBody {...bodyProps} onNavClick={() => {}} />
      </aside>

      {/* Telemóvel: barra de topo */}
      <div className={`fixed inset-x-0 top-0 z-30 flex h-12 items-center gap-3 ${SIDEBAR_BG} px-4 md:hidden`}>
        <button type="button" onClick={openMobile} className="rounded-lg p-1 text-white/90 transition-colors hover:bg-white/10" aria-label="Abrir menu">
          <IconMenu size={20} />
        </button>
        <img src="/mezza-erp.png" alt="Mezza ERP" className="h-6 w-auto" />
      </div>

      {/* Telemóvel: fundo */}
      {mobileOpen && <div className="fixed inset-0 z-40 bg-navy-950/40 motion-safe:animate-motion-fade md:hidden" onClick={closeMobile} aria-hidden="true" />}

      {/* Telemóvel: gaveta */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col ${SIDEBAR_BG} shadow-pop transition-transform duration-200 md:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <SidebarBody {...bodyProps} />
      </aside>
    </>
  );
}
