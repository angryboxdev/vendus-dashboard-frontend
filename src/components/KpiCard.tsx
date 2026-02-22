export function KpiCard({
  title,
  value,
}: {
  title: string;
  value: number | string;
}) {
  return (
    <div className="h-full rounded-2xl bg-white p-6 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}
