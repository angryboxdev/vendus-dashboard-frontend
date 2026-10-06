import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccountingModule } from "../../accounting.module.tsx";
import type { VatPeriodicity } from "../../domain/entities/vat-overview.ts";
import { DOCUMENT_TYPE_LABELS, FUNDING_SOURCE_LABELS, type AccountingDocumentType, type AccountingFundingSource } from "../../domain/entities/accounting-document.ts";

function fromCents(n: number): string {
  return (n / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function formatDate(s: string): string {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

function quarterOfMonth(month: number): number {
  return Math.ceil(month / 3);
}

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function periodLabel(periodicity: VatPeriodicity, year: number, period: number): string {
  if (periodicity === "monthly") return `${MONTH_NAMES[period - 1] ?? period} ${year}`;
  return `${period}º Trimestre ${year}`;
}

function documentTypeLabel(value: string): string {
  return DOCUMENT_TYPE_LABELS[value as AccountingDocumentType] ?? value;
}

function fundingSourceLabel(value: string | null): string {
  if (!value) return "—";
  return FUNDING_SOURCE_LABELS[value as AccountingFundingSource] ?? value;
}

/**
 * "Apuramento de IVA" (aba "IVA" dentro de Contabilidade) — acompanhamento
 * (sem fecho formal). Nunca recalcula IVA: só mostra o que o backend já
 * agrega a partir de `vendus` (vendas) e `invoices`/`accounting_documents`
 * (compras). A navegação por período é sensível à periodicidade configurada
 * (mensal = passo de 1 mês, trimestral = passo de 1 trimestre) — nunca
 * hardcoded a trimestre como antes.
 */
export function VatControlView() {
  const { api } = useAccountingModule();
  const qc = useQueryClient();
  const now = new Date();

  const { data: settings } = useQuery({ queryKey: ["accounting-settings"], queryFn: () => api.getAccountingSettings() });

  const [year, setYear] = useState(now.getFullYear());
  const [period, setPeriod] = useState(quarterOfMonth(now.getMonth() + 1));
  const [initialized, setInitialized] = useState(false);

  const periodicity: VatPeriodicity = settings?.vatPeriodicity ?? "quarterly";

  // Assim que a periodicidade configurada chega, recalcula o período inicial ("agora" nessa periodicidade) — só uma vez.
  useEffect(() => {
    if (settings && !initialized) {
      setPeriod(settings.vatPeriodicity === "monthly" ? now.getMonth() + 1 : quarterOfMonth(now.getMonth() + 1));
      setInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["vat-overview", year, period, periodicity],
    queryFn: () => api.getVatOverview(year, period),
    enabled: initialized,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (vatPeriodicity: VatPeriodicity) => api.updateAccountingSettings({ vatPeriodicity }),
    onSuccess: (updated) => {
      qc.setQueryData(["accounting-settings"], updated);
      setYear(now.getFullYear());
      setPeriod(updated.vatPeriodicity === "monthly" ? now.getMonth() + 1 : quarterOfMonth(now.getMonth() + 1));
    },
  });

  function changePeriod(delta: number) {
    const periodsPerYear = periodicity === "monthly" ? 12 : 4;
    let p = period + delta;
    let y = year;
    if (p < 1) { p = periodsPerYear; y -= 1; }
    if (p > periodsPerYear) { p = 1; y += 1; }
    setPeriod(p);
    setYear(y);
  }

  const balance = data?.balance ?? 0;

  return (
    <div className="flex min-h-full flex-col bg-[#FAF6F3]">
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Apuramento de IVA</h1>
          <p className="mt-0.5 text-sm text-stone-500">Acompanhamento do IVA liquidado, dedutível e saldo estimado.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={periodicity}
            onChange={(e) => updateSettingsMutation.mutate(e.target.value as VatPeriodicity)}
            disabled={updateSettingsMutation.isPending}
            className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs font-medium text-stone-600 outline-none focus:border-[#ED5C32]"
            title="Periodicidade do IVA"
          >
            <option value="monthly">Mensal</option>
            <option value="quarterly">Trimestral</option>
          </select>
          <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-2 py-1">
            <button onClick={() => changePeriod(-1)} className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100">←</button>
            <span className="min-w-[10rem] text-center text-sm font-medium text-stone-700">{periodLabel(periodicity, year, period)}</span>
            <button onClick={() => changePeriod(1)} className="rounded px-2 py-1 text-stone-500 hover:bg-stone-100">→</button>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-6">
        {isLoading || !initialized ? (
          <p className="py-8 text-center text-sm text-stone-400">A carregar…</p>
        ) : isError || !data ? (
          <div
            className="rounded-xl border border-dashed border-stone-200 bg-white p-8 text-center text-sm text-stone-400"
            title={error instanceof Error ? error.message : undefined}
          >
            Indisponível — não foi possível carregar o Apuramento de IVA.
          </div>
        ) : (
          <>
            <p className="text-xs text-stone-400">
              Período: {formatDate(data.period.from)} — {formatDate(data.period.to)}
            </p>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <p className="text-xs font-medium text-stone-500">IVA liquidado (vendas)</p>
                <p className="mt-1 text-xl font-bold text-emerald-600">{fromCents(data.salesVatTotal)}</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <p className="text-xs font-medium text-stone-500">IVA dedutível (compras)</p>
                <p className="mt-1 text-xl font-bold text-stone-800">{fromCents(data.purchasesVatDeductibleTotal)}</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <p className="text-xs font-medium text-stone-500">IVA não dedutível</p>
                <p className="mt-1 text-xl font-bold text-amber-600">{fromCents(data.purchasesVatNonDeductibleTotal)}</p>
              </div>
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <p className="text-xs font-medium text-stone-500">Saldo estimado do período</p>
                <p className={`mt-1 text-xl font-bold ${balance >= 0 ? "text-red-600" : "text-emerald-600"}`}>{fromCents(balance)}</p>
                <p className="text-[11px] text-stone-400">{balance >= 0 ? "A pagar ao Estado" : "Crédito de IVA"}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="border-b border-stone-200 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                IVA por taxa
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase text-stone-400">
                    <th className="px-4 py-2.5">Taxa</th>
                    <th className="px-4 py-2.5 text-right">IVA vendas</th>
                    <th className="px-4 py-2.5 text-right">IVA compras (dedutível)</th>
                    <th className="px-4 py-2.5 text-right">IVA compras (não dedutível)</th>
                    <th className="px-4 py-2.5 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {data.byRate.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-stone-400">Sem movimentos neste período.</td>
                    </tr>
                  ) : (
                    data.byRate.map((r) => (
                      <tr key={r.rate}>
                        <td className="px-4 py-2.5 font-medium text-stone-800">{r.rate}%</td>
                        <td className="px-4 py-2.5 text-right text-stone-600">{fromCents(r.salesVat)}</td>
                        <td className="px-4 py-2.5 text-right text-stone-600">{fromCents(r.purchasesVatDeductible)}</td>
                        <td className="px-4 py-2.5 text-right text-stone-600">{fromCents(r.purchasesVatNonDeductible)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-stone-800">{fromCents(r.balance)}</td>
                      </tr>
                    ))
                  )}
                  <tr className="bg-stone-50 font-semibold text-stone-800">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="px-4 py-2.5 text-right">{fromCents(data.salesVatTotal)}</td>
                    <td className="px-4 py-2.5 text-right">{fromCents(data.purchasesVatDeductibleTotal)}</td>
                    <td className="px-4 py-2.5 text-right">{fromCents(data.purchasesVatNonDeductibleTotal)}</td>
                    <td className="px-4 py-2.5 text-right">{fromCents(balance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-stone-400">
              Nota: documentos de acompanhamento (sócio/funcionário/plataforma/regularização) entram nos totais acima mas não têm uma taxa única — por isso ficam fora do breakdown por taxa. Ver detalhe abaixo.
            </p>

            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              <div className="border-b border-stone-200 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                Documentos de acompanhamento (fora do IVA por taxa)
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left text-xs font-medium uppercase text-stone-400">
                    <th className="px-4 py-2.5">Entidade</th>
                    <th className="px-4 py-2.5">Tipo</th>
                    <th className="px-4 py-2.5">Origem</th>
                    <th className="px-4 py-2.5">Data</th>
                    <th className="px-4 py-2.5 text-right">IVA</th>
                    <th className="px-4 py-2.5 text-right">Dedutível</th>
                    <th className="px-4 py-2.5 text-right">Não dedutível</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {data.documents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-stone-400">Sem documentos de acompanhamento neste período.</td>
                    </tr>
                  ) : (
                    data.documents.map((d) => (
                      <tr key={d.id}>
                        <td className="px-4 py-2.5 font-medium text-stone-800">{d.entityName}</td>
                        <td className="px-4 py-2.5 text-stone-600">{documentTypeLabel(d.documentType)}</td>
                        <td className="px-4 py-2.5 text-stone-500">{fundingSourceLabel(d.fundingSource)}</td>
                        <td className="px-4 py-2.5 text-stone-600">{formatDate(d.date)}</td>
                        <td className="px-4 py-2.5 text-right text-stone-600">{fromCents(d.vatAmount)}</td>
                        <td className="px-4 py-2.5 text-right text-stone-600">{fromCents(d.vatDeductibleAmount)}</td>
                        <td className="px-4 py-2.5 text-right text-stone-600">{fromCents(d.vatNonDeductibleAmount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
