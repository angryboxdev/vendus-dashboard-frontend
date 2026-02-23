import type {
  ReceitaBrutaItem,
  ReceitaBrutaPayload,
  ReceitaBrutaSectionKey,
} from "./receitaBruta.types";

import { RECEITA_BRUTA_TAX_RATE } from "./receitaBruta.types";
import { formatEUR } from "../../lib/format";
import { useDreStore } from "./DreStoreContext";
import { useEffect } from "react";

function sumValor(items: ReceitaBrutaItem[]) {
  return items.reduce((a, i) => a + i.valor, 0);
}
function sumTaxa(items: ReceitaBrutaItem[]) {
  return items.reduce((a, i) => a + i.taxa, 0);
}

const EMPTY_PAYLOAD: ReceitaBrutaPayload = {
  dinheiro: [],
  tpa: [],
  apps: [],
};

export function ReceitaBrutaPage() {
  const {
    receitaBruta,
    loadingReceitaBruta: loading,
    loadReceitaBruta,
  } = useDreStore();
  const data = receitaBruta ?? EMPTY_PAYLOAD;

  useEffect(() => {
    loadReceitaBruta();
  }, [loadReceitaBruta]);

  const totalDinheiroValor = sumValor(data.dinheiro);
  const totalDinheiroTaxa = sumTaxa(data.dinheiro);
  const totalTpaValor = sumValor(data.tpa);
  const totalTpaTaxa = sumTaxa(data.tpa);
  const totalAppsValor = sumValor(data.apps);
  const totalAppsTaxa = sumTaxa(data.apps);
  const totalBruto = totalDinheiroValor + totalTpaValor + totalAppsValor;
  const totalTaxas = totalDinheiroTaxa + totalTpaTaxa + totalAppsTaxa;
  const totalLiquido = totalBruto - totalTaxas;

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <p className="text-sm text-slate-500">A carregar…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h2 className="text-lg font-semibold text-slate-800">Receita Bruta</h2>
      <p className="mt-2 mb-1 text-sm text-slate-800">
        <span className="italic">Total Bruto</span>:{" "}
        <span className="font-bold">{formatEUR(totalBruto)}</span>
      </p>
      <p className="mb-1 text-sm text-slate-800">
        <span className="italic">Total Taxa</span>:{" "}
        <span className="font-bold">{formatEUR(totalTaxas)}</span>
      </p>
      <p className="text-sm text-slate-800">
        <span className="italic">Total Líquido</span>:{" "}
        <span className="font-bold">{formatEUR(totalLiquido)}</span>
      </p>

      <ReceitaBrutaTable
        title="Dinheiro"
        section="dinheiro"
        items={data.dinheiro}
        totalValor={totalDinheiroValor}
        totalTaxa={totalDinheiroTaxa}
      />

      <ReceitaBrutaTable
        title="TPA"
        section="tpa"
        items={data.tpa}
        totalValor={totalTpaValor}
        totalTaxa={totalTpaTaxa}
      />

      <ReceitaBrutaTable
        title="Apps"
        section="apps"
        items={data.apps}
        totalValor={totalAppsValor}
        totalTaxa={totalAppsTaxa}
      />
    </div>
  );
}

type ReceitaBrutaTableProps = {
  title: string;
  section: ReceitaBrutaSectionKey;
  items: ReceitaBrutaItem[];
  totalValor: number;
  totalTaxa: number;
};

function ReceitaBrutaTable({
  title,
  section,
  items,
  totalValor,
  totalTaxa,
}: ReceitaBrutaTableProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-600">
            <th className="px-4 py-3 font-medium">Descrição</th>
            <th className="px-4 py-3 font-medium">Valor</th>
            <th className="px-4 py-3 font-medium">
              Taxa ({RECEITA_BRUTA_TAX_RATE[section] * 100}%)
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-t border-slate-100 hover:bg-slate-50/50"
            >
              <td className="px-4 py-2 text-slate-800">{item.descricao}</td>
              <td className="px-4 py-2 text-slate-800">
                {formatEUR(item.valor)}
              </td>
              <td className="px-4 py-2 text-slate-800">
                {formatEUR(item.taxa)}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-200 bg-white font-medium">
            <td className="px-4 py-3 text-slate-800">Total</td>
            <td className="px-4 py-3 text-slate-800">
              {formatEUR(totalValor)}
            </td>
            <td className="px-4 py-3 text-slate-800">{formatEUR(totalTaxa)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
