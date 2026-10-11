import type { ReactNode } from "react";
import { useI18n } from "../../../../i18n/I18nProvider.tsx";
import { PageShell, StatusBadge, TabNav } from "../../../../components/ui/index.ts";

/** Moldura do Novo RH: título, aviso "em desenvolvimento" e separadores. */
export function NovoRhLayout({ children, extraActions }: { children: ReactNode; extraActions?: ReactNode }) {
  const { t } = useI18n();
  return (
    <PageShell
      title={t("novoRh.title")}
      description={t("novoRh.description")}
      actions={
        <>
          {extraActions}
          <StatusBadge tone="warning">{t("common.inDevelopment")}</StatusBadge>
        </>
      }
      tabs={
        <TabNav
          label={t("novoRh.title")}
          items={[
            { to: "/hr/novo", label: t("novoRh.tab.overview"), end: true },
            { to: "/hr/novo/pessoas", label: t("novoRh.tab.people") },
            { to: "/hr/novo/tempo", label: t("novoRh.tab.time") },
            { to: "/hr/novo/assiduidade", label: t("novoRh.tab.attendance") },
            { to: "/hr/novo/configuracoes", label: t("novoRh.tab.settings") },
            { to: "/hr/novo/estrutura", label: t("novoRh.tab.structure") },
            { to: "/hr/novo/acessos", label: t("novoRh.tab.access") },
            { to: "/hr/novo/auditoria", label: t("novoRh.tab.audit") },
          ]}
        />
      }
    >
      {children}
    </PageShell>
  );
}
