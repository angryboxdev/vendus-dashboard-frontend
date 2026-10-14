import { useEffect, useId, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "../../../../i18n/I18nProvider.tsx";
import { IconSearch, IconSettings, TabNav } from "../../../../components/ui/index.ts";
import { MAIN_NAV, areaFor, areaTabs, screenFor, searchScreens } from "../../domain/services/screens.registry.ts";
import { InboxButton } from "./inbox/InboxButton.tsx";

/**
 * Moldura do RH: uma só barra de topo operacional (pesquisa à esquerda; à
 * direita o ponto, o sino com pedidos e notificações, Configurações e a
 * conta). A navegação entre áreas é a barra lateral da aplicação; aqui só
 * ficam os separadores dentro da área atual (ex.: Assiduidade → Fecho).
 */
export function NovoRhLayout({ children, extraActions, userMenu }: { children: ReactNode; extraActions?: ReactNode; userMenu?: ReactNode }) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const current = screenFor(pathname);
  const area = areaFor(pathname);
  const sub = areaTabs(area);
  const currentLabel = current ? t(current.label) : null;
  useEffect(() => {
    document.title = currentLabel ? `${currentLabel} · Mezza ERP` : "Mezza ERP";
  }, [currentLabel]);
  return (
    <div className="flex min-h-full flex-col bg-surface-app">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <ScreenSearch />
          <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
            {extraActions}
            <InboxButton active={area === "inbox"} />
            <NavLink
              to="/hr/novo/configuracoes"
              aria-label={t("novoRh.tab.settings")}
              title={t("novoRh.tab.settings")}
              aria-current={area === "settings" ? "page" : undefined}
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${area === "settings" ? "bg-brand-50 text-brand-600" : "text-ink-secondary hover:bg-surface-soft hover:text-ink"}`}
            >
              <IconSettings size={18} />
            </NavLink>
            {userMenu}
          </div>
        </div>
      </header>
      <div className="flex-1 space-y-4 p-4 sm:p-6">
        {sub.length > 0 && (
          <div className="border-b border-line-subtle">
            <TabNav label={t(MAIN_NAV.find((m) => m.area === area)?.label ?? "novoRh.tab.settings")} items={sub.map((s) => ({ to: s.path, label: t(s.label), end: s.end }))} />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Pesquisa no Mezza: encontra os ecrãs pelo nome (sem acentos); Enter abre o primeiro resultado. */
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
    <div className="relative min-w-0 flex-1 sm:max-w-sm">
      <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
      <input
        type="search"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={listId}
        aria-label={t("novoRh.search")}
        placeholder={t("novoRh.search")}
        className="h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) go(results[0].path);
          if (e.key === "Escape") setQ("");
        }}
      />
      {results.length > 0 && (
        <ul id={listId} role="listbox" className="absolute left-0 z-30 mt-1 w-full min-w-56 rounded-xl border border-line bg-white py-1 shadow-pop">
          {results.map((s) => (
            <li key={s.path} role="option" aria-selected={false}>
              <button type="button" className="w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-surface-soft" onClick={() => go(s.path)}>
                {t(s.label)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
