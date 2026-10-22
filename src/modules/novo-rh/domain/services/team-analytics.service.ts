/**
 * Mais → Relatórios → Análise da equipa: números agregados a partir da lista
 * de colaboradores que o servidor já devolve com a privacidade por campo de
 * quem consulta (campo escondido = «Desconhecido»). Nada aqui sai como dado
 * individual; só contagens e médias.
 */

export interface AnalyticsPerson {
  id: string;
  hireDate: string | null;
  deactivatedAt: string | null;
  status: "active" | "inactive";
  birthDate: string | null;
  gender: string | null;
  nationality: string | null;
  primaryLocationId: string | null;
}
export interface AnalyticsAssignment {
  employeeId: string;
  unitType: "department" | "group" | "location";
  unitId: string;
  validFrom: string;
  validTo: string | null;
}
export interface Slice {
  key: string;
  label: string;
  value: number;
}

export const UNKNOWN = "Desconhecido";
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const monthEnd = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

/** Ativo num dia: admitido até esse dia e não desativado antes dele (sem admissão: conta se está ativo hoje). */
export function activeOn(p: AnalyticsPerson, date: string): boolean {
  if (p.hireDate && p.hireDate > date) return false;
  if (p.deactivatedAt && p.deactivatedAt.slice(0, 10) <= date) return false;
  if (!p.hireDate && p.status !== "active") return false;
  return true;
}

/** Os últimos `n` fins de mês até `asOf` (o mês corrente termina em `asOf`). */
export function monthEnds(asOf: string, n = 12): { key: string; label: string; date: string }[] {
  const [y, m] = asOf.split("-").map(Number) as [number, number];
  const out: { key: string; label: string; date: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const yy = d.getUTCFullYear();
    const mm = d.getUTCMonth() + 1;
    const end = i === 0 ? asOf : monthEnd(yy, mm);
    out.push({ key: `${yy}-${String(mm).padStart(2, "0")}`, label: MONTHS[mm - 1]!, date: end });
  }
  return out;
}

export function headcountSeries(people: AnalyticsPerson[], asOf: string, n = 12) {
  return monthEnds(asOf, n).map((m) => ({ ...m, value: people.filter((p) => activeOn(p, m.date)).length }));
}

/** Variação do efetivo nos últimos 3 meses (em %; `null` sem base). */
export function quarterTrend(series: { value: number }[]): number | null {
  if (series.length < 4) return null;
  const now = series.at(-1)!.value;
  const before = series.at(-4)!.value;
  return before > 0 ? Math.round(((now - before) / before) * 100) : null;
}

/** Data de nascimento utilizável: AAAA-MM-DD e idade plausível (14–100) no dia. */
export function validBirth(birthDate: string | null, date: string): birthDate is string {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return false;
  const a = ageAt(birthDate, date);
  return a >= 14 && a <= 100;
}

export function ageAt(birthDate: string, date: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number) as [number, number, number];
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export function averageAge(people: AnalyticsPerson[], date: string): number | null {
  const ages = people.filter((p) => validBirth(p.birthDate, date) && activeOn(p, date)).map((p) => ageAt(p.birthDate!, date));
  return ages.length ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : null;
}

export function averageAgeSeries(people: AnalyticsPerson[], asOf: string, n = 12) {
  return monthEnds(asOf, n).map((m) => ({ ...m, value: averageAge(people, m.date) }));
}

const count = (keys: string[], order?: string[]): Slice[] => {
  const map = new Map<string, number>();
  for (const k of keys) map.set(k, (map.get(k) ?? 0) + 1);
  const slices = [...map].map(([key, value]) => ({ key, label: key, value }));
  if (order) return slices.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return slices.sort((a, b) => (a.key === UNKNOWN ? 1 : b.key === UNKNOWN ? -1 : b.value - a.value));
};

export const GENDER_ORDER = ["Feminino", "Masculino", "Outro", "Prefiro não indicar", UNKNOWN];
export function genderSplit(active: AnalyticsPerson[]): Slice[] {
  return count(active.map((p) => (p.gender && GENDER_ORDER.includes(p.gender) ? p.gender : UNKNOWN)), GENDER_ORDER);
}

export const AGE_BUCKETS = ["Até 25 anos", "26–35 anos", "36–45 anos", "46–55 anos", "Mais de 55 anos", UNKNOWN];
export function ageBuckets(active: AnalyticsPerson[], date: string): Slice[] {
  return count(
    active.map((p) => {
      if (!validBirth(p.birthDate, date)) return UNKNOWN;
      const a = ageAt(p.birthDate, date);
      return a <= 25 ? AGE_BUCKETS[0]! : a <= 35 ? AGE_BUCKETS[1]! : a <= 45 ? AGE_BUCKETS[2]! : a <= 55 ? AGE_BUCKETS[3]! : AGE_BUCKETS[4]!;
    }),
    AGE_BUCKETS,
  );
}

export const GENERATIONS = ["Baby boomers (até 1964)", "Geração X (1965–1980)", "Millennials (1981–1996)", "Geração Z (1997–2012)", "Geração Alpha (2013+)", UNKNOWN];
export function generations(active: AnalyticsPerson[], date: string): Slice[] {
  return count(
    active.map((p) => {
      if (!validBirth(p.birthDate, date)) return UNKNOWN;
      const y = Number(p.birthDate.slice(0, 4));
      return y <= 1964 ? GENERATIONS[0]! : y <= 1980 ? GENERATIONS[1]! : y <= 1996 ? GENERATIONS[2]! : y <= 2012 ? GENERATIONS[3]! : GENERATIONS[4]!;
    }),
    GENERATIONS,
  );
}

/** Nacionalidades: as `top` mais frequentes; o resto junta-se em «Outras». */
export function nationalities(active: AnalyticsPerson[], top = 6): Slice[] {
  const all = count(active.map((p) => p.nationality?.trim() || UNKNOWN));
  const known = all.filter((s) => s.key !== UNKNOWN);
  const head = known.slice(0, top);
  const rest = known.slice(top).reduce((s, x) => s + x.value, 0);
  const unknown = all.find((s) => s.key === UNKNOWN);
  return [...head, ...(rest ? [{ key: "Outras", label: "Outras", value: rest }] : []), ...(unknown ? [unknown] : [])];
}

export const TENURE_BUCKETS = ["Menos de 1 ano", "1–2 anos", "2–5 anos", "5–10 anos", "Mais de 10 anos", UNKNOWN];
export function tenureBuckets(active: AnalyticsPerson[], date: string): Slice[] {
  return count(
    active.map((p) => {
      if (!p.hireDate) return UNKNOWN;
      const y = ageAt(p.hireDate, date);
      return y < 1 ? TENURE_BUCKETS[0]! : y < 2 ? TENURE_BUCKETS[1]! : y < 5 ? TENURE_BUCKETS[2]! : y < 10 ? TENURE_BUCKETS[3]! : TENURE_BUCKETS[4]!;
    }),
    TENURE_BUCKETS,
  );
}

/** Pessoas por centro, departamento ou grupo num dia (pertenças com vigência; centro = centro principal). */
export function byUnit(active: AnalyticsPerson[], assignments: AnalyticsAssignment[], kind: "location" | "department" | "group", names: Map<string, string>, date: string, top = 7): Slice[] {
  const keys: string[] = [];
  for (const p of active) {
    if (kind === "location") {
      keys.push(p.primaryLocationId ? (names.get(p.primaryLocationId) ?? UNKNOWN) : "Sem centro");
      continue;
    }
    const units = assignments.filter((a) => a.employeeId === p.id && a.unitType === kind && a.validFrom <= date && (a.validTo === null || a.validTo >= date));
    if (!units.length) keys.push(kind === "department" ? "Sem departamento" : "Sem grupo");
    for (const u of units) keys.push(names.get(u.unitId) ?? UNKNOWN);
  }
  const all = count(keys);
  const rest = all.slice(top).reduce((s, x) => s + x.value, 0);
  return [...all.slice(0, top), ...(rest ? [{ key: "Outros", label: "Outros", value: rest }] : [])];
}

/** Entradas e saídas nos últimos 12 meses e rotatividade (saídas / efetivo médio). */
export function movements(people: AnalyticsPerson[], asOf: string) {
  const from = monthEnds(asOf, 12)[0]!.key + "-01";
  const hires = people.filter((p) => p.hireDate && p.hireDate >= from && p.hireDate <= asOf).length;
  const exits = people.filter((p) => p.deactivatedAt && p.deactivatedAt.slice(0, 10) >= from && p.deactivatedAt.slice(0, 10) <= asOf).length;
  const series = headcountSeries(people, asOf);
  const avg = series.reduce((s, m) => s + m.value, 0) / series.length;
  return { hires, exits, turnover: avg > 0 ? Math.round((exits / avg) * 100) : null };
}

/** Filtro de âmbito do painel (comparação lado a lado). */
export function inScope(p: AnalyticsPerson, scope: { kind: "all" | "location" | "department" | "group"; id: string }, assignments: AnalyticsAssignment[], date: string): boolean {
  if (scope.kind === "all" || !scope.id) return true;
  if (scope.kind === "location") return p.primaryLocationId === scope.id;
  return assignments.some((a) => a.employeeId === p.id && a.unitType === scope.kind && a.unitId === scope.id && a.validFrom <= date && (a.validTo === null || a.validTo >= date));
}
