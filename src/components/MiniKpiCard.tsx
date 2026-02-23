export function MiniKpiCard({
  title,
  value,
  secondary,
}: {
  title: string;
  value: number | string;
  secondary?: boolean;
}) {
  return (
    <div
      className={
        secondary
          ? "rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
          : "rounded-xl border border-slate-100 p-4"
      }
    >
      <div className="text-xs text-slate-500">{title}</div>
      <div
        className={
          secondary
            ? "mt-1 text-base font-semibold text-slate-800"
            : "mt-1 text-lg font-semibold text-slate-900"
        }
      >
        {value}
      </div>
    </div>
  );
}
