import { useEffect, useId, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useI18n } from "../../../../i18n/I18nProvider.tsx";
import { FIELD, PageShell, StatusBadge, TabNav } from "../../../../components/ui/index.ts";
import { SCREENS, screenFor, searchScreens } from "../../domain/services/screens.registry.ts";

/** Moldura do Novo RH: título, aviso "em desenvolvimento", pesquisa de ecrãs e separadores (FE-002). */
export function NovoRhLayout({ children, extraActions }: { children: ReactNode; extraActions?: ReactNode }) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const current = screenFor(pathname);
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
      tabs={<TabNav label={t("novoRh.title")} items={SCREENS.filter((s) => s.nav).map((s) => ({ to: s.path, label: t(s.label), end: s.end }))} />}
    >
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
