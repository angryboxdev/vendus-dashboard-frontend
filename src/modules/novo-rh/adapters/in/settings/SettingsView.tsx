import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Button, IconPlus, SECTION_TITLE, SURFACE, Tabs } from "../../../../../components/ui/index.ts";
import type { SettingDomain } from "../../../domain/entities/settings.ts";
import { DOMAIN_KEY, DOMAINS } from "../../../domain/services/settings-format.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";
import { EffectivePanel } from "./EffectivePanel.tsx";
import { HistoryPanel } from "./HistoryPanel.tsx";
import { NewProfileDrawer } from "./NewProfileDrawer.tsx";
import { ProfilePanel } from "./ProfilePanel.tsx";

/**
 * Novo RH → Configurações (C11.4): perfis por área, valor por colaborador
 * (efetivo, origem, herdado) e histórico exportável.
 */
export function SettingsView() {
  const { t } = useI18n();
  const { settings } = useNovoRh();
  const [domain, setDomain] = useState<SettingDomain>("security");
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const definitions = useQuery({ queryKey: ["novo-rh", "settings", "definitions"], queryFn: () => settings.listDefinitions() });
  const profiles = useQuery({ queryKey: ["novo-rh", "settings", "profiles"], queryFn: () => settings.listProfiles() });

  const ofDomain = (profiles.data ?? []).filter((p) => p.domain === domain && !p.archived);
  const selectedId = selected && ofDomain.some((p) => p.id === selected) ? selected : (ofDomain[0]?.id ?? null);
  const defs = (definitions.data ?? []).filter((d) => d.domain === domain);

  return (
    <div className="space-y-4">
      <Tabs value={domain} onChange={setDomain} items={DOMAINS.map((d) => ({ key: d, label: t(DOMAIN_KEY[d]) }))} />

      {profiles.isLoading || definitions.isLoading ? (
        <p className="text-sm text-stone-400">{t("common.loading")}</p>
      ) : profiles.isError || definitions.isError ? (
        <p className="text-sm text-red-700">{t("common.loadError")}</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <section className={`${SURFACE} p-3`} aria-labelledby="settings-profiles">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 id="settings-profiles" className={SECTION_TITLE}>
                {t("settings.profiles.title")}
              </h2>
              <Button size="sm" variant="primary" icon={<IconPlus />} onClick={() => setCreating(true)}>
                {t("settings.profiles.new")}
              </Button>
            </div>
            {ofDomain.length === 0 ? (
              <p className="text-xs text-stone-500">{t("settings.profiles.empty")}</p>
            ) : (
              <ul className="space-y-1">
                {ofDomain.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(p.id)}
                      aria-current={p.id === selectedId}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        p.id === selectedId ? "bg-[#FDF8F5] font-medium text-stone-900 ring-1 ring-[#ED5C32]/40" : "text-stone-700 hover:bg-stone-50"
                      }`}
                    >
                      {p.name}
                      <span className="block text-xs font-normal text-stone-500">{t(`settings.kind.${p.kind}`)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {selectedId ? <ProfilePanel profileId={selectedId} definitions={defs} /> : <div />}
        </div>
      )}

      <EffectivePanel definitions={definitions.data ?? []} />
      <HistoryPanel />

      <NewProfileDrawer
        open={creating}
        domain={domain}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setSelected(id);
          setCreating(false);
        }}
      />
    </div>
  );
}
