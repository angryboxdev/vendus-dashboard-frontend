import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useFinancialBaseModule } from "../../financial-base.module.tsx";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import { LocationSelect } from "../../../../components/LocationSelect.tsx";
import { formatEUR } from "../../../../lib/format.ts";
import type { SupplierDetail } from "../../domain/entities/supplier.ts";

const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

/** `Date#getDay()` devolve 0=domingo…6=sábado; o backend usa ISO 1=segunda…7=domingo. */
function isoWeekday(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

function nextDeliveryDates(weekdays: number[], count = 3): Date[] {
  if (weekdays.length === 0) return [];
  const result: Date[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < 60 && result.length < count; i++) {
    const candidate = new Date(cursor);
    candidate.setDate(cursor.getDate() + i);
    if (weekdays.includes(isoWeekday(candidate))) result.push(candidate);
  }
  return result;
}

function fmtShortDate(d: Date): string {
  return d.toLocaleDateString("pt-PT", { weekday: "short", day: "2-digit", month: "2-digit" });
}

/** Agrega faturas já carregadas por mês — única fonte de "evolução" honesta disponível hoje (não há preço por linha/produto nesta API). */
function buildMonthlyBilledSeries(supplier: SupplierDetail): { month: string; total: number }[] {
  const byMonth = new Map<string, number>();
  for (const inv of supplier.invoices) {
    const key = inv.invoiceDate.slice(0, 7); // YYYY-MM
    byMonth.set(key, (byMonth.get(key) ?? 0) + inv.totalWithVat);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, total]) => ({ month, total }));
}

const checkboxCls = "h-4 w-4 rounded border-stone-300 text-[#ED5C32] focus:ring-[#ED5C32]";
const inputCls =
  "rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-[#ED5C32]";

/**
 * Tab "Planeamento de stock" do detalhe de fornecedor — calendário de
 * entrega por loja (D10) + um resumo do que já existe sobre este
 * fornecedor no módulo Financeiro (reaproveitado, nunca inventado).
 *
 * Gaps documentados no README do módulo: sem dados de categoria/preço por
 * linha de fatura, "Categorias mais compradas" e "Evolução de preços" não
 * são cleanly deriváveis — mostramos antes uma evolução do valor faturado
 * por mês (dado real) e omitimos a repartição por categoria.
 */
export function SupplierPlanningTab({ supplier }: { supplier: SupplierDetail }) {
  const { api } = useFinancialBaseModule();
  const { locations } = useLocations();
  const qc = useQueryClient();

  const [locationId, setLocationId] = useState<string | null>(locations[0]?.id ?? null);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [cutoffTime, setCutoffTime] = useState("");
  const [active, setActive] = useState(true);
  const [saved, setSaved] = useState(false);

  const effectiveLocationId = locationId ?? locations[0]?.id ?? null;

  const { data: schedules = [] } = useQuery({
    queryKey: ["supplier-delivery-schedules", supplier.id],
    queryFn: () => api.listSupplierDeliverySchedules(supplier.id),
  });

  const currentSchedule = useMemo(
    () => schedules.find((s) => s.locationId === effectiveLocationId) ?? null,
    [schedules, effectiveLocationId],
  );

  useEffect(() => {
    setWeekdays(currentSchedule?.weekdays ?? []);
    setCutoffTime(currentSchedule?.cutoffTime ?? "");
    setActive(currentSchedule?.active ?? true);
    setSaved(false);
  }, [currentSchedule, effectiveLocationId]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.upsertSupplierDeliverySchedule(supplier.id, {
        locationId: effectiveLocationId!,
        weekdays: weekdays.length > 0 ? weekdays : null,
        cutoffTime: cutoffTime || null,
        active,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["supplier-delivery-schedules", supplier.id] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  function toggleWeekday(value: number) {
    setWeekdays((prev) => (prev.includes(value) ? prev.filter((w) => w !== value) : [...prev, value].sort()));
  }

  const upcoming = nextDeliveryDates(weekdays);
  const monthlySeries = useMemo(() => buildMonthlyBilledSeries(supplier), [supplier]);

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-700">Calendário de entrega</h3>
            <LocationSelect value={locationId} onChange={setLocationId} className={inputCls} />
          </div>

          <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
            Os dias selecionados indicam quando este fornecedor costuma entregar nesta loja — é informativo para o planeamento, nunca um compromisso contratual.
          </div>

          <div className="mt-3">
            <p className="mb-2 text-xs font-medium text-stone-500">Dias de entrega</p>
            <div className="flex flex-wrap gap-3">
              {WEEKDAY_OPTIONS.map((w) => (
                <label key={w.value} className="flex items-center gap-1.5 text-sm text-stone-700">
                  <input type="checkbox" className={checkboxCls} checked={weekdays.includes(w.value)} onChange={() => toggleWeekday(w.value)} />
                  {w.label}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-500">Hora limite (opcional)</label>
              <input type="time" value={cutoffTime} onChange={(e) => setCutoffTime(e.target.value)} className={`${inputCls} w-full`} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-1.5 text-sm text-stone-700">
                <input type="checkbox" className={checkboxCls} checked={active} onChange={(e) => setActive(e.target.checked)} />
                Calendário ativo
              </label>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-stone-500">Próximas oportunidades de fornecimento</p>
            {upcoming.length === 0 ? (
              <p className="text-xs text-stone-400">Sem dias de entrega definidos.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {upcoming.map((d) => (
                  <span key={d.toISOString()} className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
                    {fmtShortDate(d)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              disabled={!effectiveLocationId || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className="rounded-md bg-gradient-to-r from-[#ED5C32] to-[#EF8935] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saveMutation.isPending ? "A guardar…" : "Guardar alterações"}
            </button>
            {saved && <span className="text-xs font-medium text-emerald-700">Calendário guardado.</span>}
            {saveMutation.isError && <span className="text-xs text-red-600">Erro ao guardar calendário.</span>}
          </div>
        </div>
      </div>

      <div className="w-80 shrink-0 space-y-4">
        <div className="rounded-xl border border-stone-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-stone-700">Resumo no planeamento</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-stone-400">Total faturado</dt><dd className="font-medium text-stone-700">{formatEUR(supplier.stats.totalBilled)}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-400">Faturas</dt><dd className="font-medium text-stone-700">{supplier.stats.invoiceCount}</dd></div>
            <div className="flex justify-between"><dt className="text-stone-400">Total pendente</dt><dd className="font-medium text-stone-700">{formatEUR(supplier.stats.totalPending)}</dd></div>
          </dl>
        </div>

        <div className="rounded-xl border border-stone-100 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-stone-700">Categorias mais compradas</h3>
          <p className="text-xs text-stone-400">Não disponível nesta versão — as faturas deste fornecedor não têm categoria por linha, só ao nível do documento. Ver README do módulo.</p>
        </div>

        <div className="rounded-xl border border-stone-100 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-stone-700">Evolução do valor faturado</h3>
          {monthlySeries.length === 0 ? (
            <p className="text-xs text-stone-400">Sem faturas suficientes.</p>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#78716c" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#78716c" }} axisLine={false} tickLine={false} width={36} tickFormatter={(v: number) => formatEUR(v)} />
                <Tooltip formatter={(v: number) => formatEUR(v)} />
                <Bar dataKey="total" fill="#ED5C32" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="mt-1 text-[10px] text-stone-400">Valor faturado por mês (documento), não preço unitário por item — ver README.</p>
        </div>

        <div className="rounded-xl border border-stone-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-stone-700">Faturas recentes deste fornecedor</h3>
          {supplier.invoices.length === 0 ? (
            <p className="text-xs text-stone-400">Sem faturas registadas.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {supplier.invoices.slice(0, 5).map((inv) => (
                <li key={inv.id} className="flex justify-between text-stone-600">
                  <span className="font-mono">{inv.invoiceNumber}</span>
                  <span>{formatEUR(inv.totalWithVat)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
