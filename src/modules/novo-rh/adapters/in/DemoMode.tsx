import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../i18n/I18nProvider.tsx";
import { AlertBanner, Button } from "../../../../components/ui/index.ts";
import type { DataMode } from "../../domain/entities/roadmap.ts";
import { useDataMode, useNovoRh } from "../../novo-rh.module.tsx";

const KEY = ["novo-rh", "demo-status"] as const;

/** Escolha Real / Demonstração (Visão geral). Demonstração só depois de criada a organização fictícia. */
export function DataModeSwitch() {
  const { t } = useI18n();
  const { demo } = useNovoRh();
  const { mode, setMode } = useDataMode();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: KEY, queryFn: () => demo.status() });
  const [confirming, setConfirming] = useState(false);
  const create = useMutation({
    mutationFn: () => demo.create(),
    onSuccess: (s) => {
      qc.setQueryData(KEY, s);
      setConfirming(false);
    },
  });
  const refresh = useMutation({
    mutationFn: () => demo.refresh(),
    // Os ecrãs do Novo RH voltam a pedir com as marcações novas.
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["novo-rh"] });
      // A correr em segundo plano: volta a pedir os dados daqui a pouco.
      if (r.running) setTimeout(() => void qc.invalidateQueries({ queryKey: ["novo-rh"] }), 30_000);
    },
  });
  const exists = status.data?.exists === true;
  const option = (value: DataMode, label: string, enabled: boolean) => {
    const on = mode === value;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={on}
        aria-disabled={!enabled}
        disabled={!enabled}
        onClick={() => !on && setMode(value)}
        className={
          on
            ? "rounded-full border border-[#ED5C32] bg-[#FDF8F5] px-3 py-1 text-sm font-medium text-[#C2410C]"
            : enabled
              ? "rounded-full border border-[#F5C992] px-3 py-1 text-sm text-stone-700 hover:bg-[#FDF8F5]"
              : "rounded-full border border-stone-200 px-3 py-1 text-sm text-stone-400"
        }
      >
        {label}
      </button>
    );
  };

  return (
    <div className="mt-2 space-y-2">
      <div
        className="flex flex-wrap items-center gap-2"
        role="radiogroup"
        aria-labelledby="novo-rh-mode"
      >
        {option("real", t("novoRh.mode.real"), true)}
        {option("demo", t("novoRh.mode.demo"), exists || mode === "demo")}
        {exists && (
          <p className="text-xs text-stone-500">
            {t("novoRh.mode.demoName", { name: status.data?.name ?? "" })}
          </p>
        )}
      </div>
      {exists && mode === "demo" && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            {refresh.isPending ? t("novoRh.mode.refreshing") : t("novoRh.mode.refresh")}
          </Button>
          <p className="text-xs text-stone-500">
            {refresh.data ? (refresh.data.running ? t("novoRh.mode.refreshRunning") : t("novoRh.mode.refreshed", { count: refresh.data.punches })) : t("novoRh.mode.refreshHint")}
          </p>
          {refresh.isError && <p className="text-xs text-red-700">{refresh.error.message}</p>}
        </div>
      )}
      {status.isSuccess && !exists && !confirming && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-stone-500">
            {t("novoRh.mode.demoMissing")}
          </p>
          <Button size="sm" onClick={() => setConfirming(true)}>
            {t("novoRh.mode.create")}
          </Button>
        </div>
      )}
      {confirming && (
        <AlertBanner
          tone="info"
          title={t("novoRh.mode.createTitle")}
          action={
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="tertiary"
                onClick={() => setConfirming(false)}
                disabled={create.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => create.mutate()}
                disabled={create.isPending}
              >
                {create.isPending
                  ? t("novoRh.mode.creating")
                  : t("novoRh.mode.createConfirm")}
              </Button>
            </div>
          }
        >
          {t("novoRh.mode.createBody")}
        </AlertBanner>
      )}
      {(create.isError || status.isError) && (
        <p className="text-xs text-red-700">
          {(create.error ?? status.error)?.message}
        </p>
      )}
    </div>
  );
}

/** Faixa visível em todo o Novo RH enquanto o modo é Demonstração. */
export function DemoModeBanner() {
  const { t } = useI18n();
  const { mode, setMode } = useDataMode();
  if (mode !== "demo") return null;
  return (
    <AlertBanner
      tone="warning"
      title={t("novoRh.mode.bannerTitle")}
      action={
        <Button size="sm" onClick={() => setMode("real")}>
          {t("novoRh.mode.backToReal")}
        </Button>
      }
    >
      {t("novoRh.mode.bannerBody")}
    </AlertBanner>
  );
}

/** Acessos são das contas reais: em Demonstração não se mostram nem se alteram. */
export function DemoAccessNotice() {
  const { t } = useI18n();
  return (
    <AlertBanner tone="info" title={t("novoRh.mode.accessTitle")}>
      {t("novoRh.mode.accessBody")}
    </AlertBanner>
  );
}
