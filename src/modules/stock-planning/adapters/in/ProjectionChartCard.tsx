import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { formatIsoDatePt } from "../../../../lib/format.ts";
import type { ProjectionPoint } from "../../domain/entities/stock-planning.ts";

function ProjectionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: ProjectionPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-stone-700">{formatIsoDatePt(label)}</p>
      <p className="text-stone-600">
        Stock projetado: <span className="tabular-nums">{point.projectedStock.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}</span>
      </p>
      <p className="text-stone-400">
        Consumo previsto do dia: <span className="tabular-nums">{point.expectedConsumption.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}</span>
      </p>
    </div>
  );
}

/**
 * Gráfico de projeção de stock partilhado pelas drawers de item/alerta
 * (screenshots 2 e 5 do mockup) — mesma série, mesmas cores, só muda o
 * cabeçalho. Marca a data de rutura (`ruptureDate`) com uma linha de
 * referência vermelha quando existe dentro do horizonte.
 */
export function ProjectionChartCard({
  title,
  projection,
  ruptureDate,
  baseUnit,
}: {
  title?: string;
  projection: ProjectionPoint[];
  ruptureDate?: string | null;
  baseUnit?: string;
}) {
  if (projection.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        {title && <h3 className="mb-2 text-sm font-semibold text-stone-700">{title}</h3>}
        <p className="text-xs text-stone-400">Sem dados de projeção disponíveis para este horizonte.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      {title && <h3 className="mb-3 text-sm font-semibold text-stone-700">{title}</h3>}
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={projection}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => formatIsoDatePt(d)}
            tick={{ fontSize: 10, fill: "#78716c" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#78716c" }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip content={<ProjectionTooltip />} />
          <ReferenceLine y={0} stroke="#d6d3d1" strokeDasharray="3 3" />
          {ruptureDate && (
            <ReferenceLine
              x={ruptureDate}
              stroke="#e11d48"
              strokeDasharray="4 4"
              label={{ value: "Rutura prevista", position: "insideTopRight", fontSize: 10, fill: "#e11d48" }}
            />
          )}
          <Line
            type="monotone"
            dataKey="projectedStock"
            name="Stock projetado"
            stroke="#ED5C32"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
      {baseUnit && <p className="mt-1 text-right text-[11px] text-stone-400">unidade: {baseUnit}</p>}
    </div>
  );
}
