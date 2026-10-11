import { useI18n } from "../../../../i18n/I18nProvider.tsx";
import type { MessageKey } from "../../../../i18n/i18n.ts";
import { AlertBanner, PageShell, StatusBadge, SURFACE, type StatusTone } from "../../../../components/ui/index.ts";
import type { PhaseStatus } from "../../domain/entities/roadmap.ts";
import { ROADMAP, roadmapProgress } from "../../domain/services/roadmap.service.ts";

const STATUS: Record<PhaseStatus, { tone: StatusTone; key: MessageKey }> = {
  done: { tone: "success", key: "common.done" },
  in_progress: { tone: "warning", key: "common.inProgress" },
  planned: { tone: "neutral", key: "common.planned" },
};

/**
 * Entrada do "Novo RH" (RH → Novo RH): área separada do RH atual onde se vê
 * o novo modelo a ser construído, fase a fase. Por agora só o Admin a vê.
 */
export function NovoRhHomeView() {
  const { t } = useI18n();
  const progress = roadmapProgress(ROADMAP);

  return (
    <PageShell title={t("novoRh.title")} description={t("novoRh.description")} actions={<StatusBadge tone="warning">{t("common.inDevelopment")}</StatusBadge>}>
      <AlertBanner tone="info" title={t("novoRh.banner.title")}>
        {t("novoRh.banner.body")}
      </AlertBanner>

      <section className={`${SURFACE} p-4`} aria-labelledby="novo-rh-mode">
        <h2 id="novo-rh-mode" className="text-sm font-semibold text-stone-800">
          {t("novoRh.mode.label")}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2" role="radiogroup" aria-labelledby="novo-rh-mode">
          <span role="radio" aria-checked="true" className="rounded-full border border-[#ED5C32] bg-[#FDF8F5] px-3 py-1 text-sm font-medium text-[#C2410C]">
            {t("novoRh.mode.real")}
          </span>
          <span role="radio" aria-checked="false" aria-disabled="true" className="rounded-full border border-stone-200 px-3 py-1 text-sm text-stone-400">
            {t("novoRh.mode.demo")}
          </span>
          <p className="text-xs text-stone-500">{t("novoRh.mode.demoHint")}</p>
        </div>
      </section>

      <section className={`${SURFACE} p-4`} aria-labelledby="novo-rh-roadmap">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="novo-rh-roadmap" className="text-sm font-semibold text-stone-800">
            {t("novoRh.roadmap.title")}
          </h2>
          <p className="text-xs text-stone-500">{t("novoRh.roadmap.progress", { done: progress.done, total: progress.total })}</p>
        </div>
        <ol className="mt-3 divide-y divide-[#F5C992]/40">
          {ROADMAP.map((phase) => {
            const s = STATUS[phase.status];
            return (
              <li key={phase.number} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-900">
                    <span className="mr-2 text-stone-400">{phase.number}</span>
                    {t(`novoRh.phase.${phase.number}` as MessageKey)}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">{t(`novoRh.phase.${phase.number}.desc` as MessageKey)}</p>
                </div>
                <StatusBadge tone={s.tone}>{t(s.key)}</StatusBadge>
              </li>
            );
          })}
        </ol>
      </section>
    </PageShell>
  );
}
