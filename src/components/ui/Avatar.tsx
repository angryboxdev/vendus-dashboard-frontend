import { useState, type ReactNode } from "react";

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

/**
 * Fotografia redonda quando existe; senão (ou se a imagem falhar, ex.: URL
 * expirado) iniciais sobre um fundo pastel discreto. Decorativa: o nome está
 * sempre escrito ao lado ou no rótulo do botão.
 */
export function Avatar({ name, photoUrl = null, size = "md", className = "" }: { name: string; photoUrl?: string | null; size?: AvatarSize; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (photoUrl && failed !== photoUrl)
    return <img src={photoUrl} alt="" aria-hidden="true" loading="lazy" onError={() => setFailed(photoUrl)} className={`shrink-0 rounded-full bg-surface-soft object-cover ${SIZES[size]} ${className}`.trim()} />;
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${SOFT_BG[hash(name) % SOFT_BG.length]} ${SIZES[size]} ${className}`.trim()}>
      {initials(name) || "?"}
    </span>
  );
}

/** Pessoa numa lista: avatar, nome (principal) e cargo/departamento (secundário); `aside` à direita (ex.: horas). */
export function EmployeeCell({
  name,
  subtitle,
  photoUrl = null,
  size = "md",
  aside,
  renderName,
}: {
  name: string;
  subtitle?: ReactNode;
  photoUrl?: string | null;
  size?: AvatarSize;
  aside?: ReactNode;
  /** Ex.: o nome como link para a ficha (o kit não conhece o router). */
  renderName?: (name: string) => ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar name={name} photoUrl={photoUrl} size={size} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-snug text-navy-900">{renderName ? renderName(name) : name}</p>
        {subtitle && <p className="truncate text-xs text-ink-secondary">{subtitle}</p>}
      </div>
      {aside && <div className="shrink-0 text-xs tabular-nums text-ink-secondary">{aside}</div>}
    </div>
  );
}

export interface AvatarStackItem {
  key: string;
  name: string;
  photoUrl?: string | null;
  /** Com `onClick`, cada foto é um botão (rótulo = `label` ou o nome). */
  onClick?: () => void;
  label?: string;
}

/** Fotos sobrepostas (ex.: quem faz um turno num dia), com "+N" quando passam de `max`. */
export function AvatarStack({ items, max = 4, size = "sm" }: { items: AvatarStackItem[]; max?: number; size?: AvatarSize }) {
  const shown = items.length > max ? items.slice(0, max - 1) : items;
  const rest = items.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((i) =>
        i.onClick ? (
          <button
            key={i.key}
            type="button"
            aria-label={i.label ?? i.name}
            title={i.name}
            onClick={i.onClick}
            className="rounded-full ring-2 ring-surface-card transition duration-150 hover:z-10 hover:-translate-y-px focus-visible:z-10 focus-visible:outline-none focus-visible:ring-brand-500/60"
          >
            <Avatar name={i.name} photoUrl={i.photoUrl} size={size} />
          </button>
        ) : (
          <span key={i.key} title={i.name} className="rounded-full ring-2 ring-surface-card">
            <Avatar name={i.name} photoUrl={i.photoUrl} size={size} />
          </span>
        ),
      )}
      {rest > 0 && (
        <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-surface-card font-semibold text-ink-secondary ring-2 ring-surface-card ${SIZES[size]}`}>+{rest}</span>
      )}
    </div>
  );
}
