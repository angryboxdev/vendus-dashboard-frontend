import { formatEUR, formatNumber, formatPct } from "../../lib/format";

import type { CustosFixoItem } from "./custosFixos.types";
import type { CustosVariaveisPayload } from "./custosVariaveis.types";
import { KpiCard } from "../../components/KpiCard";
import type { ReceitaBrutaPayload } from "./receitaBruta.types";
import { useDreStore } from "./DreStoreContext";
import { useEffect } from "react";

function sumReceitaBruta(data: ReceitaBrutaPayload): number {
  const sum = (arr: { valor: number }[]) =>
    arr.reduce((a, i) => a + i.valor, 0);
  return sum(data.dinheiro) + sum(data.tpa) + sum(data.apps);
}

function sumCustosFixos(items: CustosFixoItem[]): number {
  return items.reduce((a, i) => a + i.valorSemIva, 0);
}

function sumCustosVariaveis(data: CustosVariaveisPayload): number {
  const sum = (arr: { valorSemIva: number }[]) =>
    arr.reduce((a, i) => a + i.valorSemIva, 0);
  return sum(data.producao) + sum(data.venda);
}

const IRC_RATE = 0.2;

export function DemonstrativoPage() {
  const {
    receitaBruta,
    custosFixos,
    custosVariaveis,
    kpis,
    loadReceitaBruta,
    loadCustosFixos,
    loadCustosVariaveis,
    loadKpis,
    loadingReceitaBruta,
    loadingCustosFixos,
    loadingCustosVariaveis,
    loadingKpis,
  } = useDreStore();

  useEffect(() => {
    loadReceitaBruta();
    loadCustosFixos();
    loadCustosVariaveis();
    loadKpis();
  }, [loadReceitaBruta, loadCustosFixos, loadCustosVariaveis, loadKpis]);

  const loading =
    loadingReceitaBruta ||
    loadingCustosFixos ||
    loadingCustosVariaveis ||
    loadingKpis;

  const receitaBrutaValor = receitaBruta ? sumReceitaBruta(receitaBruta) : 0;
  const ivaRecolhido = receitaBruta?.tax_amount ?? 0;
  const receitaLiquida = receitaBrutaValor - ivaRecolhido;

  const custosVariaveisValor = custosVariaveis
    ? sumCustosVariaveis(custosVariaveis)
    : 0;
  const margemContribuicao = receitaLiquida - custosVariaveisValor;
  const margemContribuicaoPct =
    receitaLiquida > 0 ? margemContribuicao / receitaLiquida : 0;

  const custosFixosValor = custosFixos ? sumCustosFixos(custosFixos) : 0;
  const ebitda = margemContribuicao - custosFixosValor;
  const irc = ebitda > 0 ? ebitda * IRC_RATE : 0;
  const lucroLiquido = ebitda - irc;

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <p className="text-sm text-slate-500">A carregar…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="font-semibold text-slate-800">
                Mapa de rentabilidade
              </h3>
            </div>
            <div className="p-4">
              <table className="w-full text-left text-sm">
                <tbody className="text-slate-800">
                  <tr className="border-t border-slate-100">
                    <td className="py-2 pr-4">Receita Bruta</td>
                    <td className="py-2 text-right font-medium tabular-nums">
                      {formatEUR(receitaBrutaValor)}
                    </td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="py-2 pr-4">(-) IVA recolhido</td>
                    <td className="py-2 text-right font-medium tabular-nums">
                      {formatEUR(ivaRecolhido)}
                    </td>
                  </tr>
                  <tr className="border-t-2 border-slate-200 bg-slate-50/50">
                    <td className="py-2 pr-4 font-medium">Receita Líquida</td>
                    <td className="py-2 text-right font-semibold tabular-nums">
                      {formatEUR(receitaLiquida)}
                    </td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="py-2 pr-4">(-) Custos variáveis</td>
                    <td className="py-2 text-right font-medium tabular-nums">
                      {formatEUR(custosVariaveisValor)}
                    </td>
                  </tr>
                  <tr className="border-t-2 border-slate-200 bg-slate-50/50">
                    <td className="py-2 pr-4 font-medium">
                      Margem de contribuição
                    </td>
                    <td className="py-2 text-right font-semibold tabular-nums">
                      {formatEUR(margemContribuicao)}
                    </td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="py-2 pr-4">Margem de contribuição (%)</td>
                    <td className="py-2 text-right font-medium tabular-nums">
                      {formatPct(margemContribuicaoPct)}
                    </td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="py-2 pr-4">(-) Custos fixos</td>
                    <td className="py-2 text-right font-medium tabular-nums">
                      {formatEUR(custosFixosValor)}
                    </td>
                  </tr>
                  <tr className="border-t-2 border-slate-200 bg-slate-50/50">
                    <td className="py-2 pr-4 font-medium">EBITDA</td>
                    <td className="py-2 text-right font-semibold tabular-nums">
                      {formatEUR(ebitda)}
                    </td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="py-2 pr-4">IRC</td>
                    <td className="py-2 text-right font-medium tabular-nums">
                      {formatEUR(irc)}
                    </td>
                  </tr>
                  <tr className="border-t-2 border-slate-200 bg-white font-semibold">
                    <td className="py-3 pr-4">Resultado líquido</td>
                    <td className="py-3 text-right tabular-nums">
                      {formatEUR(lucroLiquido)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <h3 className="font-semibold text-slate-800">KPIs</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard
              title="Vendas loja"
              value={kpis != null ? formatNumber(kpis.vendas_loja) : "—"}
            />
            <KpiCard
              title="Vendas apps"
              value={kpis != null ? formatNumber(kpis.vendas_apps) : "—"}
            />
            <KpiCard
              title="Vendas totais"
              value={kpis != null ? formatNumber(kpis.vendas_totais) : "—"}
            />
            <KpiCard
              title="Ticket bruto"
              value={kpis != null ? formatEUR(kpis.ticket_medio_bruto) : "—"}
            />
            <KpiCard
              title="Ticket líquido"
              value={kpis != null ? formatEUR(kpis.ticket_medio_liquido) : "—"}
            />
            <KpiCard
              title="Vendas loja"
              value={kpis != null ? formatPct(kpis.receita_pct_loja) : "—"}
            />
            <KpiCard
              title="Vendas apps"
              value={kpis != null ? formatPct(kpis.receita_pct_apps) : "—"}
            />
            <KpiCard
              title="CMV"
              value={kpis != null ? formatPct(kpis.cmv_pct) : "—"}
            />
            <KpiCard
              title="Custo fixo"
              value={kpis != null ? formatPct(kpis.custo_fixo_pct) : "—"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
