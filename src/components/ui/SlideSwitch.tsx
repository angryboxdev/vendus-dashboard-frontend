/**
 * Interruptor deslizante entre opções de igual largura (ex.: XS · Pequena · Grande; Entra no Stock · Fora do Stock
 * · Por rever). O destaque desliza para a opção escolhida (respeita movimento reduzido); setas ← → também mudam.
 * `itemWidthClass` define a largura de cada opção (e do destaque), em classes Tailwind.
 */
export function SlideSwitch<T extends string>({
  options,
  value,
  onChange,
  label,
  itemWidthClass = "w-24",
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  itemWidthClass?: string;
}) {
  const index = Math.max(0, options.findIndex((o) => o.key === value));
  const move = (delta: number) => onChange(options[(index + delta + options.length) % options.length]!.key);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") move(1);
        if (e.key === "ArrowLeft") move(-1);
      }}
      className="relative inline-flex shrink-0 rounded-full bg-surface-soft p-0.5 text-xs font-medium"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0.5 left-0.5 ${itemWidthClass} rounded-full bg-navy-900 shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none`}
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={o.key === value}
          tabIndex={o.key === value ? 0 : -1}
          onClick={() => onChange(o.key)}
          className={`relative z-10 ${itemWidthClass} whitespace-nowrap rounded-full py-1 text-center transition-colors ${o.key === value ? "text-white" : "text-ink-secondary hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
