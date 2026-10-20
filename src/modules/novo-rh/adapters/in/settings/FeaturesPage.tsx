import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { SURFACE } from "../../../../../components/ui/index.ts";
import type { SettingData, SettingDomain } from "../../../domain/entities/settings.ts";
import { FEATURES, featureSubDefinitions, type Feature } from "../../../domain/services/features.service.ts";
import { todayIn } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { DataModeCard } from "../DemoMode.tsx";
import { ProfilePanel } from "./ProfilePanel.tsx";

/**
 * Configurações → Geral → Funcionalidades: um interruptor por funcionalidade
 * opcional (grava no perfil geral, a partir de hoje, com motivo automático e
 * no histórico). As definições de cada uma só aparecem quando está ligada.
 */
export function FeaturesPage() {
  const { t } = useI18n();
  const { settings } = useNovoRh();
  const qc = useQueryClient();
  const definitions = useQuery({ queryKey: ["novo-rh", "settings", "definitions"], queryFn: () => settings.listDefinitions() });
  const profiles = useQuery({ queryKey: ["novo-rh", "settings", "profiles"], queryFn: () => settings.listProfiles() });
  const domains = [...new Set(FEATURES.map((f) => f.domain))];
  const globalOf = (d: SettingDomain) => (profiles.data ?? []).find((p) => p.domain === d && p.kind === "global" && !p.archived);
  const details = useQueries({
    queries: domains.map((d) => ({
      queryKey: ["novo-rh", "settings", "profile", globalOf(d)?.id ?? "none"],
      queryFn: () => settings.getProfile(globalOf(d)!.id),
      enabled: !!globalOf(d),
    })),
  });
  const detailOf = (d: SettingDomain) => details[domains.indexOf(d)]?.data;

  const toggle = useMutation({
    mutationFn: async ({ f, on }: { f: Feature; on: boolean }) => {
      // Sem perfil geral no domínio: cria-o (como «Criar regras gerais» nos temas).
      let profile = globalOf(f.domain);
      if (!profile) profile = await settings.createProfile({ domain: f.domain, name: t("cfg.globalName"), kind: "global" });
      const { etag } = await qc.fetchQuery({ queryKey: ["novo-rh", "settings", "profile", profile.id], queryFn: () => settings.getProfile(profile!.id), staleTime: 0 });
      await settings.setValue(profile.id, etag, { key: f.key, value: on, validFrom: todayIn(), reason: on ? "Ligado em Funcionalidades" : "Desligado em Funcionalidades" });
    },
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ["novo-rh", "settings"] });
      await qc.invalidateQueries({ queryKey: ["me", "features"] });
    },
  });

  if (definitions.isLoading || profiles.isLoading) return <p className="text-sm text-stone-400">{t("common.loading")}</p>;
  if (definitions.isError || profiles.isError) return <p className="text-sm text-red-700">{t("common.loadError")}</p>;
  const defs = definitions.data ?? [];

  return (
    <div className="space-y-3">
      <div className={`${SURFACE} p-4`}>
        <h2 className="text-base font-semibold text-stone-900">{t("cfg.topic.features")}</h2>
        <p className="mt-1 text-sm text-stone-600">{t("cfg.features.intro")}</p>
      </div>
      <ul className="space-y-2" aria-label={t("cfg.topic.features")}>
        {FEATURES.map((f) => {
          const def = defs.find((d) => d.key === f.key);
          if (!def) return null;
          const own = detailOf(f.domain)?.detail.values.find((v) => v.key === f.key)?.value;
          const on = ((own ?? def.defaultValue) as SettingData | null) === true;
          const sub = featureSubDefinitions(f, defs);
          const global = globalOf(f.domain);
          const busy = toggle.isPending && toggle.variables?.f.key === f.key;
          return (
            <li key={f.key} className={`${SURFACE} p-4`}>
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-stone-900">{def.label}</p>
                  <p className="mt-0.5 text-xs text-stone-500">{def.description}</p>
                  {on && f.link && (
                    <Link to={f.link.to} className="mt-1 inline-block text-xs font-medium text-[#C2410C] hover:underline">
                      {f.link.label} →
                    </Link>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={def.label}
                  disabled={busy}
                  onClick={() => toggle.mutate({ f, on: !on })}
                  className="flex shrink-0 items-center gap-2 rounded-full text-sm text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ED5C32]/40 disabled:opacity-60"
                >
                  <span className={`relative inline-flex h-6 w-11 rounded-full transition-colors duration-150 ${on ? "bg-[#D67549]" : "bg-stone-300"}`}>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 ${on ? "translate-x-5" : "translate-x-0.5"}`} />
                  </span>
                  <span className="w-16 text-left">{on ? t("cfg.features.on") : t("cfg.features.off")}</span>
                </button>
              </div>
              {/* Definições da funcionalidade: só com ela ligada. */}
              {on && sub.length > 0 && global && (
                <div className="mt-3 border-t border-stone-100 pt-1">
                  <ProfilePanel profileId={global.id} definitions={sub} bare />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {toggle.isError && (
        <p role="alert" className="text-sm text-red-700">
          {toggle.error instanceof Error ? toggle.error.message : t("common.error")}
        </p>
      )}
      <DataModeCard />
    </div>
  );
}
