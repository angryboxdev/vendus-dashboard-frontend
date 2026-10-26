const clean = (s: string) => s.replace(/[\s.-]/g, "").toUpperCase();

/**
 * A conta do extrato é a conta escolhida? Compara IBAN e nº de conta sem espaços; o nº de conta do
 * Millennium («45797093352») está contido no IBAN/NIB («PT50 0033 0000 4579 7093 3520 5»).
 */
export function isSameAccount(contextIdentifier: string, detectedAccount: string | null, detectedIban: string | null): boolean {
  const ctx = clean(contextIdentifier);
  if (!ctx) return true;
  const candidates = [detectedAccount, detectedIban].filter((v): v is string => !!v).map(clean);
  if (candidates.length === 0) return true;
  return candidates.some((c) => c === ctx || (c.length >= 8 && ctx.includes(c)) || (ctx.length >= 8 && c.includes(ctx)));
}

/** «PT50003300004579709335205» → «PT50 0033 •••• •••• 3520 5». */
export function maskIban(iban: string): string {
  const groups = clean(iban).match(/.{1,4}/g) ?? [];
  return groups.map((g, i) => (i < 2 || i >= groups.length - 2 ? g : "••••")).join(" ");
}
