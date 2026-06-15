import { NavLink } from "react-router-dom";
import { useSidebar } from "./use-sidebar.ts";
import type { NavGroup, NavItem, SidebarNavEntry } from "../../domain/entities/nav-item.ts";
import type { UseSidebarResult } from "./use-sidebar.ts";

// ── helpers ───────────────────────────────────────────────────────────────────

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `block rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive
      ? "bg-[#FEF3EC] font-semibold text-[#9B2B1F]"
      : "font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-800"
  }`;
}

// ── icons ─────────────────────────────────────────────────────────────────────

function ChevronIcon({ open, active }: { open: boolean; active: boolean }) {
  return (
    <svg
      className={`h-4 w-4 transition-all duration-200 ${open ? "rotate-180" : ""} ${
        active ? "text-[#ED5C32]" : "text-stone-400"
      }`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg
      className="h-5 w-5 text-stone-600"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 5A.75.75 0 012.75 9h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 9.75zm0 5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ── NavItemLink ───────────────────────────────────────────────────────────────

function NavItemLink({ item, onClick }: { item: NavItem; onClick: () => void }) {
  return (
    <NavLink to={item.path} end={item.end} className={navLinkClass} onClick={onClick}>
      {item.label}
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
}: {
  group: NavGroup;
  expanded: boolean;
  active: boolean;
  onToggle: () => void;
  onNavClick: () => void;
}) {
  return (
    <div className="mt-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
          active
            ? "bg-[#FEF3EC] font-semibold text-[#9B2B1F]"
            : "font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-800"
        }`}
      >
        <span>{group.label}</span>
        <ChevronIcon open={expanded} active={active} />
      </button>
      {expanded && (
        <div className="mt-0.5 flex flex-col gap-0.5 pl-1">
          {group.items.map((item) => (
            <NavItemLink key={item.path} item={item} onClick={onNavClick} />
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
  onNavClick: () => void;
  onSignOut: () => void;
}

function SidebarBody({
  tree,
  isGroupExpanded,
  isGroupActive,
  toggleGroup,
  userEmail,
  onNavClick,
  onSignOut,
}: SidebarBodyProps) {
  return (
    <>
      {/* Brand */}
      <div className="px-4 pb-3 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 flex-shrink-0 rounded-full bg-gradient-to-br from-[#ED5C32] to-[#EF8935]" />
          <h1 className="text-base font-bold tracking-tight text-stone-900">
            Angry Box Hub
          </h1>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 px-3 pb-4">
        {tree.map((entry) => {
          if (entry.kind === "item") {
            return (
              <NavItemLink key={entry.path} item={entry} onClick={onNavClick} />
            );
          }
          return (
            <NavGroupSection
              key={entry.id}
              group={entry}
              expanded={isGroupExpanded(entry.id)}
              active={isGroupActive(entry.id)}
              onToggle={() => toggleGroup(entry.id)}
              onNavClick={onNavClick}
            />
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[#F5C992]/40 px-3 py-3">
        <p className="truncate px-3 text-xs text-stone-400">{userEmail}</p>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-1 w-full rounded-lg px-3 py-1.5 text-left text-sm font-medium text-stone-600 transition-colors hover:bg-[#FAF6F3] hover:text-stone-800"
        >
          Sair
        </button>
      </div>
    </>
  );
}

// ── Sidebar (public export) ───────────────────────────────────────────────────

export function Sidebar() {
  const {
    tree,
    isGroupExpanded,
    isGroupActive,
    toggleGroup,
    userEmail,
    mobileOpen,
    openMobile,
    closeMobile,
    signOut,
  }: UseSidebarResult = useSidebar();

  const bodyProps: SidebarBodyProps = {
    tree,
    isGroupExpanded,
    isGroupActive,
    toggleGroup,
    userEmail,
    onNavClick: closeMobile,
    onSignOut: signOut,
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-56 flex-shrink-0 flex-col border-r border-[#F5C992]/40 bg-white md:flex">
        <SidebarBody {...bodyProps} onNavClick={() => {}} />
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-12 items-center gap-3 border-b border-[#F5C992]/40 bg-white px-4 md:hidden">
        <button
          type="button"
          onClick={openMobile}
          className="rounded-lg p-1 transition-colors hover:bg-stone-100"
          aria-label="Abrir menu"
        >
          <HamburgerIcon />
        </button>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-[#ED5C32] to-[#EF8935]" />
          <span className="text-sm font-bold tracking-tight text-stone-900">
            Angry Box Hub
          </span>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm md:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-[#F5C992]/40 bg-white shadow-xl transition-transform duration-200 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarBody {...bodyProps} />
      </aside>
    </>
  );
}
