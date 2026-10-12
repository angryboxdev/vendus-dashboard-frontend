import { useState, type ReactNode } from "react";
import {
  Button,
  DateNavigator,
  DropdownMenu,
  IconAlert,
  IconButton,
  IconChevronDown,
  IconCopy,
  IconDownload,
  IconEye,
  IconEyeOff,
  IconMore,
  IconRedo,
  IconSearch,
  IconSliders,
  IconUndo,
  IconUserPlus,
  LABEL,
  Popover,
  SearchableSelect,
  SegmentedControl,
  Toolbar,
  ToolbarDivider,
  ToolbarGroup,
  type MenuEntry,
} from "../../../../../components/ui/index.ts";
import type { BoardMode } from "./WeekBoard.tsx";

export type ViewMode = "month" | "week";
export type VisualMode = "detailed" | "compact";

/** Ícone da barra com indicador (ex.: n.º de alertas). */
function Badge({ n }: { n: number }) {
  return n > 0 ? (
    <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">
      {n}
    </span>
  ) : null;
}

export interface ScheduleToolbarProps {
  mode: BoardMode;
  onMode: (m: BoardMode) => void;
  viewMode: ViewMode;
  onViewMode: (v: ViewMode) => void;
  visualMode: VisualMode;
  onVisualMode: (v: VisualMode) => void;
  periodLabel: string;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  search: string;
  onSearch: (q: string) => void;
  employees: { id: string; label: string }[];
  employeeFilter: string;
  onEmployeeFilter: (id: string) => void;
  canUndo: boolean;
  undoing: boolean;
  onUndo: () => void;
  onApplyTemplate: () => void;
  onExportPdf: () => void;
  weekActions: MenuEntry[];
  showUnassigned: boolean;
  onToggleUnassigned: () => void;
  alertsCount: number;
  alerts: ReactNode;
  addItems: (MenuEntry | "separator")[];
  onPublish: () => void;
}

/**
 * Barra da escala (um só contentor suave): agrupamento, hoje + período,
 * pesquisa e filtros, ações auxiliares, "Adicionar ▾" e "Publicar escala".
 */
export function ScheduleToolbar(p: ScheduleToolbarProps) {
  const [searching, setSearching] = useState(p.search !== "");
  const iconBtn = "h-8 w-8 rounded-lg";
  return (
    <Toolbar label="Ações da escala">
      <SegmentedControl
        label="Agrupar por"
        value={p.mode}
        onChange={p.onMode}
        items={[
          {
            key: "employees",
            label: (
              <span className={p.mode === "employees" ? "text-brand-600" : ""}>
                Funcionários
              </span>
            ),
          },
          {
            key: "shifts",
            label: (
              <span className={p.mode === "shifts" ? "text-brand-600" : ""}>
                Turnos
              </span>
            ),
          },
          {
            key: "positions",
            label: (
              <span className={p.mode === "positions" ? "text-brand-600" : ""}>
                Cargos
              </span>
            ),
          },
        ]}
      />
      <Button onClick={p.onToday} className="ml-1 bg-surface-card">
        Hoje
      </Button>
      <DateNavigator
        label={p.periodLabel}
        onPrev={p.onPrev}
        onNext={p.onNext}
        prevLabel={p.viewMode === "week" ? "Semana anterior" : "Mês anterior"}
        nextLabel={p.viewMode === "week" ? "Semana seguinte" : "Mês seguinte"}
      />

      <ToolbarGroup>
        {searching ? (
          <div className="relative motion-safe:animate-motion-fade">
            <IconSearch
              size={16}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              autoFocus
              type="search"
              aria-label="Pesquisar colaborador"
              placeholder="Pesquisar colaborador…"
              value={p.search}
              onChange={(e) => p.onSearch(e.target.value)}
              onBlur={() => !p.search && setSearching(false)}
              onKeyDown={(e) =>
                e.key === "Escape" && (p.onSearch(""), setSearching(false))
              }
              className="h-9 w-48 rounded-lg bg-transparent pl-8 pr-2 text-sm text-ink outline-none placeholder:text-ink-muted"
            />
          </div>
        ) : (
          <IconButton
            label="Pesquisar colaborador"
            className={iconBtn}
            onClick={() => setSearching(true)}
          >
            <IconSearch size={18} />
          </IconButton>
        )}
        <Popover
          label="Filtros"
          width="w-72"
          trigger={({ open, toggle }) => (
            <IconButton
              label="Filtros e vista"
              className={`${iconBtn} ${open || p.employeeFilter || p.viewMode === "month" ? "text-brand-600" : ""}`}
              onClick={toggle}
              aria-expanded={open}
            >
              <IconSliders size={18} />
            </IconButton>
          )}
        >
          {() => (
            <div className="space-y-4 p-2.5">
              <div>
                <span className={LABEL}>Vista</span>
                <SegmentedControl
                  label="Vista"
                  size="sm"
                  value={p.viewMode}
                  onChange={p.onViewMode}
                  items={[
                    { key: "week", label: "Semana" },
                    { key: "month", label: "Mês" },
                  ]}
                />
              </div>
              {p.viewMode === "month" && (
                <div>
                  <span className={LABEL}>Visualização</span>
                  <SegmentedControl
                    label="Visualização"
                    size="sm"
                    value={p.visualMode}
                    onChange={p.onVisualMode}
                    items={[
                      { key: "detailed", label: "Detalhada" },
                      { key: "compact", label: "Compacta" },
                    ]}
                  />
                </div>
              )}
              <div>
                <span className={LABEL}>Colaborador</span>
                <SearchableSelect
                  label="Colaborador"
                  value={p.employeeFilter}
                  options={p.employees}
                  onChange={p.onEmployeeFilter}
                  allLabel="Todos"
                  triggerClassName="h-10 w-full justify-between rounded-xl shadow-none"
                />
              </div>
            </div>
          )}
        </Popover>
      </ToolbarGroup>

      {/* Ecrãs largos: todas as ações à vista (como no mockup). Ecrãs pequenos: menu "Mais ações". */}
      <div className="hidden items-center gap-1.5 lg:flex">
        <ToolbarDivider />
        <IconButton
          label={p.canUndo ? "Desfazer a última remoção" : "Nada para desfazer"}
          className={iconBtn}
          disabled={!p.canUndo || p.undoing}
          onClick={p.onUndo}
        >
          <IconUndo size={18} />
        </IconButton>
        <IconButton
          label="Refazer (não disponível)"
          className={iconBtn}
          disabled
        >
          <IconRedo size={18} />
        </IconButton>
        <ToolbarDivider />

        <IconButton
          label="Aplicar modelo a vários colaboradores"
          className={`${iconBtn} text-navy-900`}
          onClick={p.onApplyTemplate}
        >
          <IconUserPlus size={18} />
        </IconButton>
        <IconButton
          label="Exportar PDF"
          className={`${iconBtn} text-navy-900`}
          onClick={p.onExportPdf}
        >
          <IconDownload size={18} />
        </IconButton>
        <DropdownMenu
          label="Ações da semana"
          align="left"
          items={p.weekActions}
          trigger={({ open, toggle }) => (
            <IconButton
              label="Copiar, repetir ou limpar a semana"
              className={`${iconBtn} text-navy-900`}
              onClick={toggle}
              aria-expanded={open}
            >
              <IconCopy size={18} />
            </IconButton>
          )}
        />
        <IconButton
          label={
            p.showUnassigned
              ? "Esconder quem não tem turnos"
              : "Mostrar quem não tem turnos"
          }
          className={`${iconBtn} text-navy-900`}
          onClick={p.onToggleUnassigned}
          aria-pressed={p.showUnassigned}
        >
          {p.showUnassigned ? <IconEyeOff size={18} /> : <IconEye size={18} />}
        </IconButton>
      </div>
      <div className="lg:hidden">
        <DropdownMenu
          label="Mais ações"
          align="left"
          items={[
            {
              label: "Desfazer a última remoção",
              icon: <IconUndo size={16} />,
              disabled: !p.canUndo || p.undoing,
              hint: "Nada para desfazer",
              onSelect: p.onUndo,
            },
            {
              label: "Aplicar modelo a vários colaboradores",
              icon: <IconUserPlus size={16} />,
              onSelect: p.onApplyTemplate,
            },
            {
              label: "Exportar PDF",
              icon: <IconDownload size={16} />,
              onSelect: p.onExportPdf,
            },
            "separator",
            ...p.weekActions,
            "separator",
            {
              label: p.showUnassigned
                ? "Esconder quem não tem turnos"
                : "Mostrar quem não tem turnos",
              icon: p.showUnassigned ? (
                <IconEyeOff size={16} />
              ) : (
                <IconEye size={16} />
              ),
              onSelect: p.onToggleUnassigned,
            },
          ]}
          trigger={({ open, toggle }) => (
            <IconButton
              label="Mais ações"
              className={`${iconBtn} text-navy-900`}
              onClick={toggle}
              aria-expanded={open}
            >
              <IconMore size={18} />
            </IconButton>
          )}
        />
      </div>
      <Popover
        label="Alertas da escala"
        align="right"
        width="w-80"
        trigger={({ open, toggle }) => (
          <span className="relative inline-flex">
            <IconButton
              label={
                p.alertsCount
                  ? `${p.alertsCount} alertas na escala`
                  : "Sem alertas na escala"
              }
              className={`${iconBtn} ${p.alertsCount ? "text-red-600 hover:text-red-700" : "text-navy-900"}`}
              onClick={toggle}
              aria-expanded={open}
            >
              <IconAlert size={18} />
            </IconButton>
            <Badge n={p.alertsCount} />
          </span>
        )}
      >
        {() => p.alerts}
      </Popover>

      <div className="flex w-full items-center gap-1.5 sm:ml-auto sm:w-auto">
        <div className="flex-1 sm:flex-none">
          <DropdownMenu
            label="Adicionar"
            items={p.addItems}
            trigger={({ open, toggle }) => (
              <Button
                onClick={toggle}
                aria-expanded={open}
                aria-haspopup="menu"
                className="w-full bg-surface-card sm:w-auto"
              >
                Adicionar
                <IconChevronDown
                  size={16}
                  className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                />
              </Button>
            )}
          />
        </div>
        <Button
          variant="primary"
          onClick={p.onPublish}
          className="flex-1 px-5 sm:flex-none"
        >
          Publicar escala
        </Button>
      </div>
    </Toolbar>
  );
}
