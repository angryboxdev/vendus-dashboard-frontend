/**
 * NIF português (espelho de `isValidPtNif` em `fiscal-documents` no backend):
 * 9 dígitos com dígito de controlo módulo 11. Serve para avisar logo no campo
 * — um NIF lido pela IA com dígitos trocados falha aqui antes de lançar.
 */
export function isValidPtNif(nif: string): boolean {
  if (!/^\d{9}$/.test(nif)) return false;
  const sum = nif
    .slice(0, 8)
    .split("")
    .reduce((s, d, i) => s + Number(d) * (9 - i), 0);
  const check = 11 - (sum % 11);
  return (check >= 10 ? 0 : check) === Number(nif[8]);
}

export type NifCheck =
  | { kind: "empty" }
  | { kind: "valid" }
  /** 9 dígitos (com ou sem «PT») e controlo errado. */
  | { kind: "invalid" }
  /** Outro formato (ex.: NIF estrangeiro com prefixo) — não se valida aqui. */
  | { kind: "other" };

export function checkNif(raw: string): NifCheck {
  const compact = raw.toUpperCase().replace(/[\s.\-/]/g, "");
  if (!compact) return { kind: "empty" };
  const digits = compact.startsWith("PT") ? compact.slice(2) : compact;
  if (!/^\d{9}$/.test(digits)) return { kind: "other" };
  return isValidPtNif(digits) ? { kind: "valid" } : { kind: "invalid" };
}

/** Mesmo NIF, ignorando espaços, pontos e o prefixo «PT». */
export function sameNif(a: string | null | undefined, b: string | null | undefined): boolean {
  const n = (s: string | null | undefined) => (s ?? "").toUpperCase().replace(/[\s.\-/]/g, "").replace(/^PT/, "");
  return n(a) !== "" && n(a) === n(b);
}
