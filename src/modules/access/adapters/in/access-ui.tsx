import type { AccessLevel, ModuleState } from "../../domain/entities/access.ts";
import { initials, LEVEL_LABELS, MODULE_STATE_LABELS } from "../../domain/services/access-ui.service.ts";

/** Peças visuais partilhadas pelos ecrãs de Utilizadores e Perfis (indicadores discretos — task §21). */

const AVATAR_TONES = ["bg-orange-50 text-orange-700", "bg-emerald-50 text-emerald-700", "bg-sky-50 text-sky-700", "bg-violet-50 text-violet-700", "bg-rose-50 text-rose-700", "bg-amber-50 text-amber-700"];

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const tone = AVATAR_TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span className={`inline-flex flex-shrink-0 items-center justify-center rounded-full font-semibold ${tone} ${size === "lg" ? "h-14 w-14 text-lg" : "h-10 w-10 text-sm"}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function ProfileBadge({ name, systemKey }: { name: string; systemKey: string | null }) {
  const tone =
    systemKey === "admin" ? "bg-indigo-50 text-indigo-700" : systemKey === "colaborador" ? "bg-stone-100 text-stone-700" : "bg-emerald-50 text-emerald-700";
  return <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${tone}`}>{name}</span>;
}

export function StateBadge({ state, customized }: { state: ModuleState; customized?: boolean }) {
  if (customized) return <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Personalizado</span>;
  const tone = state === "manage_all" ? "bg-emerald-50 text-emerald-700" : state === "read_all" ? "bg-sky-50 text-sky-700" : state === "mixed" ? "bg-violet-50 text-violet-700" : "bg-stone-100 text-stone-500";
  return <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${tone}`}>{MODULE_STATE_LABELS[state]}</span>;
}

export function OriginBadge({ customized, profileName, onRestore }: { customized: boolean; profileName: string; onRestore?: () => void }) {
  if (!customized) return <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-500">Herdado ({profileName})</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Personalizado</span>
      {onRestore && (
        <button type="button" onClick={onRestore} className="text-xs font-medium text-[#ED5C32] hover:underline">
          Restaurar padrão
        </button>
      )}
    </span>
  );
}

export function LevelSelect({
  value,
  onChange,
  disabled,
  label,
  special = false,
}: {
  value: AccessLevel;
  onChange: (level: AccessLevel) => void;
  disabled?: boolean;
  label: string;
  /** Permissões especiais: só Sem acesso / Permitido. */
  special?: boolean;
}) {
  const options: Array<[AccessLevel, string]> = special ? [["NONE", "Não permitido"], ["MANAGE", "Permitido"]] : (["NONE", "READ", "MANAGE"] as AccessLevel[]).map((l) => [l, LEVEL_LABELS[l]]);
  return (
    <select
      aria-label={label}
      value={special && value === "READ" ? "NONE" : value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as AccessLevel)}
      className="w-36 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-800 disabled:bg-stone-50 disabled:text-stone-400"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

export function TemporaryPasswordNotice({ password, onClose }: { password: string; onClose: () => void }) {
  return (
    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
      <p className="font-semibold">Palavra-passe temporária (só é mostrada agora):</p>
      <p className="select-all font-mono text-lg tracking-wider">{password}</p>
      <p>Entregue-a em mão. No primeiro acesso a pessoa tem de definir uma palavra-passe nova.</p>
      <button type="button" onClick={onClose} className="text-xs font-medium text-amber-900 underline">
        Já anotei
      </button>
    </div>
  );
}
