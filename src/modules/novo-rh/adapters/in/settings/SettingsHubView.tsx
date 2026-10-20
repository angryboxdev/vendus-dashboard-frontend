import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../../i18n/i18n.ts";
import { AlertBanner, Button, SECTION_TITLE, SURFACE } from "../../../../../components/ui/index.ts";
import { TOPICS, topicDefinitions, type Topic, type TopicKey } from "../../../domain/services/settings-topics.service.ts";
import { useDataMode, useNovoRh } from "../../../novo-rh.module.tsx";
import { ProfilePanel } from "./ProfilePanel.tsx";
import { FeaturesPage } from "./FeaturesPage.tsx";
import { SettingsView } from "./SettingsView.tsx";

type Section = TopicKey | "catalogs" | "company" | "advanced";

/** Catálogos do Novo RH: geridos nas áreas respetivas. */
const CATALOGS: { key: MessageKey; hint: MessageKey; to: string }[] = [
  { key: "cfg.catalog.absenceTypes", hint: "cfg.catalog.absenceTypes.hint", to: "/hr/novo/ausencias" },
  { key: "cfg.catalog.flows", hint: "cfg.catalog.flows.hint", to: "/hr/novo/ausencias" },
  { key: "cfg.catalog.schedules", hint: "cfg.catalog.schedules.hint", to: "/hr/novo/assiduidade/registos" },
  { key: "cfg.catalog.breaks", hint: "cfg.catalog.breaks.hint", to: "/hr/novo/assiduidade" },
  { key: "cfg.catalog.clockTypes", hint: "cfg.catalog.clockTypes.hint", to: "/hr/novo/assiduidade" },
  { key: "cfg.catalog.holidays", hint: "cfg.catalog.holidays.hint", to: "/hr/novo/assiduidade/registos" },
  { key: "cfg.catalog.shiftTemplates", hint: "cfg.catalog.shiftTemplates.hint", to: "/hr/novo/escalas" },
  { key: "cfg.catalog.structure", hint: "cfg.catalog.structure.hint", to: "/hr/novo/estrutura" },
  { key: "cfg.catalog.categories", hint: "cfg.catalog.categories.hint", to: "/hr/novo/assiduidade/banco-de-horas" },
  { key: "cfg.catalog.forms", hint: "cfg.catalog.forms.hint", to: "/hr/novo/tarefas" },
];

/** Empresa, Locais e Papéis: dados da organização real, geridos nos ecrãs da empresa. */
const COMPANY: { key: MessageKey; hint: MessageKey; to: string }[] = [
  { key: "cfg.company.profile", hint: "cfg.company.profile.hint", to: "/empresa" },
  { key: "cfg.company.locations", hint: "cfg.company.locations.hint", to: "/empresa/locais" },
  { key: "cfg.company.roles", hint: "cfg.company.roles.hint", to: "/admin/access-profiles" },
  { key: "cfg.company.users", hint: "cfg.company.users.hint", to: "/admin/users" },
];

/**
 * Novo RH → Configurações (FE-090): menu por tema. Cada tema mostra as regras
 * do perfil geral (data de efeito, motivo, impacto se retroativo); as exceções
 * por centro, grupo ou pessoa e o histórico estão em "Perfis e exceções".
 */
export function SettingsHubView() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const raw = params.get("tema") as Section | null;
  const section: Section = raw && (TOPICS.some((x) => x.key === raw) || ["catalogs", "company", "advanced"].includes(raw)) ? raw : "features";
  const go = (s: Section) => setParams({ tema: s }, { replace: true });
  const item = (s: Section, label: string) => (
    <li key={s}>
      <button
        type="button"
        aria-current={section === s ? "page" : undefined}
        onClick={() => go(s)}
        className={`w-full rounded-md px-3 py-2 text-left text-sm ${section === s ? "bg-[#FDF8F5] font-medium text-[#C2410C]" : "text-stone-700 hover:bg-stone-50"}`}
      >
        {label}
      </button>
    </li>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <nav aria-label={t("cfg.nav")} className={`${SURFACE} h-fit space-y-3 p-2`}>
        <div>
          <p className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">{t("cfg.group.rules")}</p>
          <ul>{TOPICS.map((x) => item(x.key, t(`cfg.topic.${x.key}` as MessageKey)))}</ul>
        </div>
        <div>
          <p className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">{t("cfg.group.other")}</p>
          <ul>
            {item("catalogs", t("cfg.catalogs"))}
            {item("company", t("cfg.company"))}
            {item("advanced", t("cfg.advanced"))}
          </ul>
        </div>
      </nav>

      <div className="min-w-0">
        {section === "features" && <FeaturesPage />}
        {section !== "features" && TOPICS.some((x) => x.key === section) && <TopicPage topic={TOPICS.find((x) => x.key === section)!} onAdvanced={() => go("advanced")} />}
        {section === "catalogs" && <LinkCards title={t("cfg.catalogs")} intro={t("cfg.catalogs.intro")} items={CATALOGS} />}
        {section === "company" && <CompanyPage />}
        {section === "advanced" && <SettingsView />}
      </div>
      </div>
    </div>
  );
}

/** Regras de um tema no perfil geral do domínio (cria-o se ainda não existir). */
function TopicPage({ topic, onAdvanced }: { topic: Topic; onAdvanced: () => void }) {
  const { t } = useI18n();
  const { settings } = useNovoRh();
  const qc = useQueryClient();
  const definitions = useQuery({ queryKey: ["novo-rh", "settings", "definitions"], queryFn: () => settings.listDefinitions() });
  const profiles = useQuery({ queryKey: ["novo-rh", "settings", "profiles"], queryFn: () => settings.listProfiles() });
  const create = useMutation({
    mutationFn: () => settings.createProfile({ domain: topic.domain, name: t("cfg.globalName"), kind: "global" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["novo-rh", "settings"] }),
  });
  if (definitions.isLoading || profiles.isLoading) return <p className="text-sm text-stone-400">{t("common.loading")}</p>;
  if (definitions.isError || profiles.isError) return <p className="text-sm text-red-700">{t("common.loadError")}</p>;
  const defs = topicDefinitions(topic, definitions.data ?? []);
  const active = (profiles.data ?? []).filter((p) => p.domain === topic.domain && !p.archived);
  const global = active.find((p) => p.kind === "global");
  const exceptions = active.filter((p) => p.kind !== "global").length;

  return (
    <div className="space-y-3">
      <div className={`${SURFACE} p-4`}>
        <h2 className="text-base font-semibold text-stone-900">{t(`cfg.topic.${topic.key}` as MessageKey)}</h2>
        <p className="mt-1 text-sm text-stone-600">{t(`cfg.topic.${topic.key}.intro` as MessageKey)}</p>
        <p className="mt-2 text-xs text-stone-500">
          {t("cfg.exceptions", { count: exceptions })}{" "}
          <button type="button" className="font-medium text-[#C2410C] hover:underline" onClick={onAdvanced}>
            {t("cfg.openAdvanced")}
          </button>
        </p>
      </div>
      {topic.key === "notifications" && <RunReminders />}
      {global ? (
        <ProfilePanel profileId={global.id} definitions={defs} />
      ) : (
        <AlertBanner
          tone="info"
          title={t("cfg.noGlobal.title")}
          action={
            <Button size="sm" variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>
              {t("cfg.noGlobal.create")}
            </Button>
          }
        >
          {t("cfg.noGlobal.body")}
        </AlertBanner>
      )}
      {create.isError && <p className="text-sm text-red-700">{create.error.message}</p>}
    </div>
  );
}

/** Notificações: verificar já os avisos devidos (o servidor faz o mesmo de 10 em 10 minutos). */
function RunReminders() {
  const { t } = useI18n();
  const { reminders } = useNovoRh();
  const run = useMutation({ mutationFn: () => reminders.run() });
  return (
    <div className={`${SURFACE} flex flex-wrap items-center gap-3 p-4`}>
      <p className="flex-1 text-sm text-stone-600">{t("cfg.reminders.hint")}</p>
      <Button size="sm" disabled={run.isPending} onClick={() => run.mutate()}>
        {t("cfg.reminders.run")}
      </Button>
      {run.data && <span className="text-xs text-stone-600">{t("cfg.reminders.done", { count: run.data.notices })}</span>}
      {run.isError && <span className="text-xs text-red-700">{run.error.message}</span>}
    </div>
  );
}

function CompanyPage() {
  const { t } = useI18n();
  const { mode } = useDataMode();
  return (
    <div className="space-y-3">
      {mode === "demo" && (
        <AlertBanner tone="info" title={t("cfg.company.demo.title")}>
          {t("cfg.company.demo.body")}
        </AlertBanner>
      )}
      <LinkCards title={t("cfg.company")} intro={t("cfg.company.intro")} items={COMPANY} />
    </div>
  );
}

function LinkCards({ title, intro, items }: { title: string; intro: string; items: { key: MessageKey; hint: MessageKey; to: string }[] }) {
  const { t } = useI18n();
  return (
    <section className={`${SURFACE} space-y-3 p-4`}>
      <h2 className={SECTION_TITLE}>{title}</h2>
      <p className="text-sm text-stone-600">{intro}</p>
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((c) => (
          <li key={c.key}>
            <Link to={c.to} className="block rounded-lg border border-[#F5C992]/60 p-3 hover:border-[#ED5C32]/60 hover:bg-[#FDF8F5]">
              <span className="text-sm font-medium text-stone-900">{t(c.key)} →</span>
              <span className="mt-0.5 block text-xs text-stone-500">{t(c.hint)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
