import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useI18n } from "../../../../../i18n/I18nProvider.tsx";
import { Button, FIELD, LABEL, SURFACE } from "../../../../../components/ui/index.ts";
import type { JoinApiPort } from "../../../domain/ports/out/invitations-api.port.ts";

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/**
 * Página pública de adesão (FE-054): sem sessão. Pede só nome, apelidos e
 * e-mail. Um código inválido, expirado ou revogado mostra sempre a mesma
 * mensagem.
 */
export function JoinView({ code, api }: { code: string; api: JoinApiPort }) {
  const { t } = useI18n();
  const check = useQuery({ queryKey: ["join", "check"], queryFn: () => api.check(code), retry: false });
  const [v, setV] = useState({ firstName: "", lastName: "", email: "" });
  const [consent, setConsent] = useState(false);
  const send = useMutation({ mutationFn: () => api.submit(code, v) });
  const ok = v.firstName.trim() && v.lastName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim()) && consent;
  return (
    <main className="flex min-h-[100dvh] items-start justify-center bg-[#FAF6F3] px-4 py-10">
      <section className={`${SURFACE} w-full max-w-md space-y-4 p-6`} aria-labelledby="join-title">
        <h1 id="join-title" className="text-lg font-semibold text-stone-900">
          {t("join.title")}
        </h1>
        {check.isLoading && <p className="text-sm text-stone-500">{t("common.loading")}</p>}
        {check.isError && <p className="text-sm text-red-700">{message(check.error, t("join.invalid"))}</p>}
        {send.isSuccess && (
          <p role="status" className="text-sm text-emerald-700">
            {t("join.sent")}
          </p>
        )}
        {check.data && !send.isSuccess && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (ok) send.mutate();
            }}
          >
            <p className="text-sm text-stone-600">{t("join.intro")}</p>
            <label className="block">
              <span className={LABEL}>{t("join.firstName")}</span>
              <input className={`${FIELD} w-full`} autoComplete="given-name" maxLength={80} value={v.firstName} onChange={(e) => setV({ ...v, firstName: e.target.value })} />
            </label>
            <label className="block">
              <span className={LABEL}>{t("join.lastName")}</span>
              <input className={`${FIELD} w-full`} autoComplete="family-name" maxLength={120} value={v.lastName} onChange={(e) => setV({ ...v, lastName: e.target.value })} />
            </label>
            <label className="block">
              <span className={LABEL}>{t("join.email")}</span>
              <input type="email" className={`${FIELD} w-full`} autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
            </label>
            <label className="flex items-start gap-2 text-xs text-stone-600">
              <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              {t("join.privacy")}
            </label>
            <Button type="submit" variant="primary" disabled={!ok || send.isPending}>
              {t("join.send")}
            </Button>
            {send.isError && <p className="text-sm text-red-700">{message(send.error, t("common.error"))}</p>}
          </form>
        )}
      </section>
    </main>
  );
}
