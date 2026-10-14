import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../i18n/I18nProvider.tsx";
import { AlertBanner, Button, IconAlert, IconInfo, SURFACE } from "../../../../components/ui/index.ts";
import type { DataMode } from "../../domain/entities/roadmap.ts";
import type { DemoStatus } from "../../domain/ports/out/demo-api.port.ts";
import { useDataMode, useNovoRh } from "../../novo-rh.module.tsx";

const KEY = ["novo-rh", "demo-status"] as const;

/** Modo de dados (Real / Demonstração) — em Configurações → Geral. */
export function DataModeCard() {
  const { t } = useI18n();
  return (
    <section className={`${SURFACE} p-4`} aria-labelledby="novo-rh-mode">
      <h2 id="novo-rh-mode" className="text-sm font-semibold text-stone-800">
        {t("novoRh.mode.label")}
      </h2>
      <DataModeSwitch />
    </section>
  );
}

/** Escolha Real / Demonstração (Visão geral). Demonstração só depois de criada a organização fictícia. */
export function DataModeSwitch() {
  const { t } = useI18n();
  const { demo } = useNovoRh();
  const { mode, setMode } = useDataMode();
  const qc = useQueryClient();
  // Enquanto a atualização corre no servidor, o estado volta a ser pedido a cada 5 s.
  const status = useQuery({ queryKey: KEY, queryFn: () => demo.status(), refetchInterval: (q) => (q.state.data?.refresh?.running ? 5_000 : false) });
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
      void qc.invalidateQueries({ queryKey: KEY });
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
          <RefreshStatus s={status.data?.refresh} />
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
  // Uma só linha discreta; o texto completo fica no ícone de informação.
  return (
    <div role="status" className="flex items-center gap-3 rounded-xl border border-amber-200/80 bg-[#FFFBF2] px-3 py-1.5 text-sm">
      <IconAlert size={16} className="shrink-0 text-amber-600" />
      <p className="min-w-0 flex-1 truncate">
        <strong className="font-semibold text-amber-900">{t("novoRh.mode.bannerTitle")}</strong>
        <span className="hidden text-ink-secondary sm:inline"> · Está a visualizar a organização de demonstração.</span>
      </p>
      <span title={t("novoRh.mode.bannerBody")} aria-label={t("novoRh.mode.bannerBody")} className="hidden shrink-0 cursor-help text-ink-muted md:inline">
        <IconInfo size={16} />
      </span>
      <button type="button" onClick={() => setMode("real")} className="shrink-0 rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-medium text-navy-900 hover:bg-surface-soft">
        {t("novoRh.mode.backToReal")}
      </button>
    </div>
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

/** O que a última atualização fez (ou o erro), para se perceber porque faltam dados. */
function RefreshStatus({ s }: { s: DemoStatus["refresh"] }) {
  if (!s || (!s.running && !s.lastAt)) return null;
  const e = s.last?.enriched;
  const at = s.lastAt ? new Date(s.lastAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) : null;
  const parts = [
    s.last?.punches !== undefined ? `${s.last.punches} marcações novas` : null,
    e?.periodClosed ? "mês anterior fechado" : null,
    e && e.rules ? `${e.rules} regras de alerta` : null,
    e && e.alerts ? `${e.alerts} alertas abertos` : null,
    e && e.pending ? `${e.pending} pedidos criados` : null,
  ].filter(Boolean);
  return (
    <div className="w-full text-xs text-stone-600" role="status">
      {s.running ? (
        <p>A atualizar em segundo plano…</p>
      ) : (
        <p>
          Última atualização{at ? ` às ${at}` : ""}: {s.error ? <span className="text-red-700">falhou — {s.error}</span> : parts.length ? parts.join(" · ") : "nada em falta"}
        </p>
      )}
      {!!e?.errors?.length && (
        <ul className="mt-1 list-disc pl-4 text-red-700">
          {e.errors.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
