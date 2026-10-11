import type { ReactNode } from "react";
import { useI18n } from "../../../../i18n/I18nProvider.tsx";
import { PageShell, StatusBadge, TabNav } from "../../../../components/ui/index.ts";

/** Moldura do Novo RH: título, aviso "em desenvolvimento" e separadores. */
export function NovoRhLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <PageShell
      title={t("novoRh.title")}
      description={t("novoRh.description")}
      actions={<StatusBadge tone="warning">{t("common.inDevelopment")}</StatusBadge>}
      tabs={
        <TabNav
          label={t("novoRh.title")}
          items={[
            { to: "/hr/novo", label: t("novoRh.tab.overview"), end: true },
            { to: "/hr/novo/configuracoes", label: t("novoRh.tab.settings") },
          ]}
        />
      }
    >
      {children}
    </PageShell>
  );
}
