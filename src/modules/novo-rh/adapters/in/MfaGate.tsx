import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "../../../../i18n/I18nProvider.tsx";
import { AlertBanner, Button, FIELD, LABEL, SURFACE } from "../../../../components/ui/index.ts";
import { useNovoRh } from "../../novo-rh.module.tsx";

/**
 * TK-3: com a MFA ligada na empresa (Configurações → Segurança, desligada por
 * omissão), o Novo RH só abre com a sessão confirmada pelo segundo fator
 * (`aal2`). Sem fator → ativar (QR + código); com fator → pedir o código.
 * Desligada → abre logo.
 */
export function MfaGate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { mfa } = useNovoRh();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const required = useQuery({ queryKey: ["novo-rh", "mfa", "required"], queryFn: () => mfa.required(), staleTime: 60_000 });
  const status = useQuery({ queryKey: ["novo-rh", "mfa"], queryFn: () => mfa.status(), enabled: required.data === true });
  const enrollment = useMutation({ mutationFn: () => mfa.enroll() });
  const verify = useMutation({
    mutationFn: (factorId: string) => mfa.verify(factorId, code.trim()),
    onSuccess: () => {
      setCode("");
      void qc.invalidateQueries();
    },
  });

  if (required.isLoading) return <p className="text-sm text-stone-400">{t("common.loading")}</p>;
  // Desligada na empresa (ou sem resposta): não pede o código — o servidor decide na mesma.
  if (required.data !== true) return <>{children}</>;
  if (status.isLoading) return <p className="text-sm text-stone-400">{t("common.loading")}</p>;
  if (status.isError || !status.data) return <AlertBanner tone="danger" title={t("mfa.error")}>{status.error instanceof Error ? status.error.message : ""}</AlertBanner>;
  if (status.data.level === "aal2") return <>{children}</>;

  const factorId = status.data.factorId ?? enrollment.data?.factorId ?? null;
  const needsEnroll = !status.data.factorId;

  return (
    <section className={`${SURFACE} mx-auto max-w-lg space-y-4 p-5`} aria-labelledby="mfa-title">
      <div>
        <h2 id="mfa-title" className="text-base font-semibold text-stone-900">
          {needsEnroll ? t("mfa.enroll.title") : t("mfa.verify.title")}
        </h2>
        <p className="mt-1 text-sm text-stone-600">{needsEnroll ? t("mfa.enroll.body") : t("mfa.verify.body")}</p>
      </div>

      {needsEnroll && !enrollment.data && (
        <Button variant="primary" onClick={() => enrollment.mutate()} disabled={enrollment.isPending}>
          {t("mfa.enroll.start")}
        </Button>
      )}

      {needsEnroll && enrollment.data && (
        <div className="space-y-2">
          <img src={enrollment.data.qrCode} alt={t("mfa.enroll.qrAlt")} className="h-44 w-44 rounded-lg border border-stone-200 bg-white p-2" />
          <p className="text-xs text-stone-500">
            {t("mfa.enroll.secret")} <code className="select-all break-all font-mono text-stone-700">{enrollment.data.secret}</code>
          </p>
        </div>
      )}

      {factorId && (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (/^\d{6}$/.test(code.trim())) verify.mutate(factorId);
          }}
        >
          <div>
            <label htmlFor="mfa-code" className={LABEL}>
              {t("mfa.code")}
            </label>
            <input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className={`${FIELD} w-32 text-center font-mono tracking-widest`}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <Button type="submit" variant="primary" disabled={!/^\d{6}$/.test(code.trim()) || verify.isPending}>
            {t("mfa.confirm")}
          </Button>
        </form>
      )}

      {(enrollment.isError || verify.isError) && (
        <AlertBanner tone="danger" title={t("mfa.error")}>
          {verify.isError ? t("mfa.wrongCode") : enrollment.error instanceof Error ? enrollment.error.message : ""}
        </AlertBanner>
      )}
    </section>
  );
}
