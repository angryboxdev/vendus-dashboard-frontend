import { useEffect, useId, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "../../../../i18n/I18nProvider.tsx";
import { FIELD, IconSettings, PageShell, StatusBadge, TabNav } from "../../../../components/ui/index.ts";
import { MAIN_NAV, areaFor, areaTabs, screenFor, searchScreens } from "../../domain/services/screens.registry.ts";
import { InboxButton } from "./inbox/InboxButton.tsx";

/**
 * Moldura do Novo RH: título, pesquisa de ecrãs, navegação principal (6 áreas)
 * com Pedidos e Configurações à direita, e os separadores da área atual.
 */
export function NovoRhLayout({ children, extraActions }: { children: ReactNode; extraActions?: ReactNode }) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const current = screenFor(pathname);
  const area = areaFor(pathname);
  const sub = areaTabs(area);
  const currentLabel = current ? t(current.label) : null;
  useEffect(() => {
    document.title = currentLabel ? `${currentLabel} · ${t("novoRh.title")}` : t("novoRh.title");
  }, [currentLabel, t]);
  return (
    <PageShell
      title={t("novoRh.title")}
      description={t("novoRh.description")}
      actions={
        <>
          <ScreenSearch />
          {extraActions}
          <StatusBadge tone="warning">{t("common.inDevelopment")}</StatusBadge>
        </>
      }
      tabs={
        <div className="flex items-end justify-between gap-2">
          <TabNav label={t("novoRh.title")} items={MAIN_NAV.map((s) => ({ to: s.path, label: t(s.label), end: s.end }))} />
          <div className="flex shrink-0 items-center gap-1 pb-1">
            <InboxButton active={area === "inbox"} />
            <NavLink
              to="/hr/novo/configuracoes"
              aria-label={t("novoRh.tab.settings")}
              title={t("novoRh.tab.settings")}
              aria-current={area === "settings" ? "page" : undefined}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${area === "settings" ? "bg-brand-50 text-brand-600" : "text-ink-secondary hover:bg-surface-soft hover:text-ink"}`}
            >
              <IconSettings size={18} />
            </NavLink>
          </div>
        </div>
      }
    >
      {sub.length > 0 && (
        <div className="mb-4 border-b border-line-subtle">
          <TabNav label={t(MAIN_NAV.find((m) => m.area === area)?.label ?? "novoRh.tab.settings")} items={sub.map((s) => ({ to: s.path, label: t(s.label), end: s.end }))} />
        </div>
      )}
      {children}
    </PageShell>
  );
}

/** "Ir para…": pesquisa os ecrãs do registo pelo nome; Enter abre o primeiro resultado. */
function ScreenSearch() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const listId = useId();
  const [q, setQ] = useState("");
  const results = searchScreens(q, (s) => t(s.label));
  const go = (path: string) => {
    setQ("");
    navigate(path);
  };
  return (
    <div className="relative">
      <input
        type="search"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={listId}
        aria-label={t("novoRh.search")}
        placeholder={t("novoRh.search")}
        className={`${FIELD} w-44`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) go(results[0].path);
          if (e.key === "Escape") setQ("");
        }}
      />
      {results.length > 0 && (
        <ul id={listId} role="listbox" className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-[#F5C992]/60 bg-white py-1 shadow-lg">
          {results.map((s) => (
            <li key={s.path} role="option" aria-selected={false}>
              <button type="button" className="w-full px-3 py-1.5 text-left text-sm text-stone-700 hover:bg-[#FDF8F5]" onClick={() => go(s.path)}>
                {t(s.label)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
