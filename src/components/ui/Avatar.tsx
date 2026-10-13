import type { ReactNode } from "react";

/** Fundos discretos para as iniciais (escolhidos pelo nome, sempre os mesmos para a mesma pessoa). */
const SOFT_BG = ["bg-brand-100 text-brand-600", "bg-shift-afternoon-bg text-shift-afternoon-ink", "bg-shift-split-bg text-shift-split-ink", "bg-shift-night-bg text-shift-night-ink", "bg-shift-other-bg text-shift-other-ink"];

const SIZES = { xs: "h-6 w-6 text-[10px]", sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", list: "h-11 w-11 text-sm", lg: "h-12 w-12 text-base", xl: "h-20 w-20 text-2xl" } as const;
export type AvatarSize = keyof typeof SIZES;

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Fotografia real quando existe; senão iniciais sobre um fundo pastel discreto. */
export function Avatar({ name, photoUrl = null, size = "md" }: { name: string; photoUrl?: string | null; size?: AvatarSize }) {
  if (photoUrl) return <img src={photoUrl} alt={name} className={`shrink-0 rounded-full bg-surface-soft object-cover ${SIZES[size]}`} />;
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${SOFT_BG[hash(name) % SOFT_BG.length]} ${SIZES[size]}`}>
      {initials(name) || "?"}
    </span>
  );
}

/** Pessoa numa lista: avatar, nome (principal) e cargo/departamento (secundário); `aside` à direita (ex.: horas). */
export function EmployeeCell({ name, subtitle, photoUrl = null, size = "md", aside }: { name: string; subtitle?: ReactNode; photoUrl?: string | null; size?: AvatarSize; aside?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar name={name} photoUrl={photoUrl} size={size} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-snug text-navy-900">{name}</p>
        {subtitle && <p className="truncate text-xs text-ink-secondary">{subtitle}</p>}
      </div>
      {aside && <div className="shrink-0 text-xs tabular-nums text-ink-secondary">{aside}</div>}
    </div>
  );
}
