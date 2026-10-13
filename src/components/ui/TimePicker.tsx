import { useId, type KeyboardEvent, type WheelEvent } from "react";
import { IconChevronDown, IconClock } from "./icons.tsx";
import { Popover } from "./Popover.tsx";
import { FOCUS_RING } from "./ui-classes.ts";

const pad = (n: number) => String(n).padStart(2, "0");
const wrap = (n: number, size: number) => ((n % size) + size) % size;

/** "08:30" → [8, 30]; inválido → [0, 0]. */
function split(value: string): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  return m ? [wrap(Number(m[1]), 24), wrap(Number(m[2]), 60)] : [0, 0];
}

/**
 * Coluna da roda (horas ou minutos): o valor escolhido ao centro, três de
 * cada lado, setas por cima e por baixo. Roda do rato e setas do teclado
 * avançam um; Page Up/Down avançam cinco; clicar num valor escolhe-o.
 */
function WheelColumn({ label, value, size, onChange }: { label: string; value: number; size: number; onChange: (v: number) => void }) {
  const uid = useId();
  const step = (d: number) => onChange(wrap(value + d, size));
  const onKey = (e: KeyboardEvent) => {
    const d = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 }[e.key];
    if (d !== undefined) {
      e.preventDefault();
      step(d);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      onChange(e.key === "Home" ? 0 : size - 1);
    }
  };
  const onWheel = (e: WheelEvent) => {
    if (e.deltaY !== 0) step(e.deltaY > 0 ? 1 : -1);
  };
  const arrow = "flex h-7 w-full items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-soft hover:text-navy-900";
  return (
    <div className="flex w-14 flex-col items-center gap-1">
      <button type="button" tabIndex={-1} aria-label={`${label}: anterior`} className={arrow} onClick={() => step(-1)}>
        <IconChevronDown size={16} className="rotate-180" />
      </button>
      <div
        role="listbox"
        aria-label={label}
        aria-activedescendant={`${uid}-${value}`}
        tabIndex={0}
        onKeyDown={onKey}
        onWheel={onWheel}
        className={`flex w-full flex-col items-center gap-0.5 rounded-xl border border-line p-1 focus-within:border-brand-500 ${FOCUS_RING}`}
      >
        {[-3, -2, -1, 0, 1, 2, 3].map((d) => {
          const v = wrap(value + d, size);
          const active = d === 0;
          return (
            <div
              key={d}
              id={active ? `${uid}-${value}` : undefined}
              role="option"
              aria-selected={active}
              onClick={() => onChange(v)}
              className={`w-full cursor-pointer select-none rounded-lg py-1 text-center text-sm tabular-nums transition-colors duration-100 ${
                active ? "bg-brand-600 font-semibold text-white" : Math.abs(d) === 3 ? "text-ink-muted" : "text-ink-secondary hover:bg-surface-soft"
              }`}
            >
              {pad(v)}
            </div>
          );
        })}
      </div>
      <button type="button" tabIndex={-1} aria-label={`${label}: seguinte`} className={arrow} onClick={() => step(1)}>
        <IconChevronDown size={16} />
      </button>
    </div>
  );
}

/**
 * Hora (HH:MM) escolhida numa roda de horas e minutos, sem escrever. O
 * campo mostra "08 : 00"; ao abrir, setas, roda do rato ou clique mudam o
 * valor na hora (Enter ou Esc fecham).
 */
export function TimePicker({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  const [h, m] = split(value);
  const set = (nh: number, nm: number) => onChange(`${pad(nh)}:${pad(nm)}`);
  return (
    <Popover
      label={label}
      width="w-auto"
      trigger={({ open, toggle, id }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          aria-label={`${label}: ${pad(h)}:${pad(m)}`}
          className={`flex h-10 items-center gap-2 rounded-xl border bg-surface-card px-3 text-sm tabular-nums text-ink transition-colors ${open ? "border-brand-500 ring-2 ring-brand-500/15" : "border-line hover:border-navy-900/30"} ${FOCUS_RING} ${className}`.trim()}
        >
          <IconClock size={16} className="text-ink-muted" />
          <span>
            {pad(h)} : {pad(m)}
          </span>
        </button>
      )}
    >
      {(close) => (
        <div className="flex items-center gap-1 p-2" onKeyDown={(e) => e.key === "Enter" && close()}>
          <WheelColumn label="Horas" value={h} size={24} onChange={(v) => set(v, m)} />
          <span aria-hidden="true" className="px-0.5 text-base font-semibold text-navy-900">
            :
          </span>
          <WheelColumn label="Minutos" value={m} size={60} onChange={(v) => set(h, v)} />
        </div>
      )}
    </Popover>
  );
}
