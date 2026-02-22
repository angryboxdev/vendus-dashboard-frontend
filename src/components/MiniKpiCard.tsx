export function MiniKpiCard({
  title,
  value,
}: {
  title: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}
