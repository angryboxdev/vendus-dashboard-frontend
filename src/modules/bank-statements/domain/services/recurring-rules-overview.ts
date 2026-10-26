import type { ReconciliationRuleDTO } from "../entities/bank-statement.ts";

/** Página «Movimentos recorrentes»: resumo, filtros e agrupamento das regras por conta. */

export type RuleStatusFilter = "active" | "paused" | "all";

export interface RulesSummary {
  active: number;
  paused: number;
  /** Movimentos conciliados automaticamente por todas as regras. */
  autoMovements: number;
}

export function summarizeRules(rules: ReconciliationRuleDTO[]): RulesSummary {
  return rules.reduce<RulesSummary>(
    (acc, r) => ({
      active: acc.active + (r.isActive ? 1 : 0),
      paused: acc.paused + (r.isActive ? 0 : 1),
      autoMovements: acc.autoMovements + (r.usage?.movementsCount ?? 0),
    }),
    { active: 0, paused: 0, autoMovements: 0 },
  );
}

function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function filterRules(
  rules: ReconciliationRuleDTO[],
  opts: { status: RuleStatusFilter; accountId: string | null; search: string },
): ReconciliationRuleDTO[] {
  const q = fold(opts.search.trim());
  return rules.filter((r) => {
    if (opts.status === "active" && !r.isActive) return false;
    if (opts.status === "paused" && r.isActive) return false;
    if (opts.accountId && r.bankAccountId !== opts.accountId) return false;
    if (q && !fold(`${r.name} ${r.descriptionContains}`).includes(q)) return false;
    return true;
  });
}

export interface RuleGroup {
  /** null = regras antigas, válidas para todas as contas. */
  accountId: string | null;
  label: string;
  rules: ReconciliationRuleDTO[];
}

/** Agrupa por conta (rótulo dado pelo chamador); dentro do grupo, ativas primeiro, depois as mais usadas. */
export function groupRulesByAccount(
  rules: ReconciliationRuleDTO[],
  accountLabel: (accountId: string) => string,
): RuleGroup[] {
  const groups = new Map<string, RuleGroup>();
  for (const r of rules) {
    const key = r.bankAccountId ?? "";
    const g = groups.get(key) ?? {
      accountId: r.bankAccountId,
      label: r.bankAccountId ? accountLabel(r.bankAccountId) : "Todas as contas",
      rules: [],
    };
    g.rules.push(r);
    groups.set(key, g);
  }
  const byUse = (a: ReconciliationRuleDTO, b: ReconciliationRuleDTO) =>
    Number(b.isActive) - Number(a.isActive) ||
    (b.usage?.movementsCount ?? 0) - (a.usage?.movementsCount ?? 0) ||
    a.name.localeCompare(b.name, "pt");
  return [...groups.values()]
    .map((g) => ({ ...g, rules: [...g.rules].sort(byUse) }))
    .sort((a, b) => (a.accountId === null ? 1 : b.accountId === null ? -1 : a.label.localeCompare(b.label, "pt")));
}

/** «Qualquer valor» ou «12,30 € ± 1,00 €». */
export function ruleAmountLabel(rule: Pick<ReconciliationRuleDTO, "amountCents" | "amountToleranceCents">, eur: (cents: number) => string): string {
  if (rule.amountCents === null) return "Qualquer valor";
  return `${eur(rule.amountCents)} ± ${eur(rule.amountToleranceCents)}`;
}

/** Lê um valor em euros escrito pelo utilizador («18,74», «1 230,50», «12.3») → cêntimos; inválido → null. */
export function parseEuroToCents(input: string): number | null {
  const s = input.replace(/\s|€/g, "");
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}
