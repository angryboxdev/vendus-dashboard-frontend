/**
 * Campos da ficha com formato próprio (sem dependências de UI):
 * IBAN (PT50 por omissão, agrupado de 4 em 4, dígito de controlo),
 * telefone com indicativo do país (escolhido numa lista), género e
 * nacionalidade em listas. Os valores antigos fora das listas mantêm-se.
 */

// ── IBAN ─────────────────────────────────────────────────────────────

/** Prefixo sugerido num IBAN vazio (Portugal: país + dígitos de controlo fixos). */
export const IBAN_DEFAULT_PREFIX = "PT50";

export const compactIban = (v: string) => v.replace(/\s/g, "").toUpperCase();

/** «PT50 0002 0123 …» (só apresentação; grava-se sem espaços). */
export function formatIban(v: string): string {
  return compactIban(v)
    .replace(/[^A-Z0-9]/g, "")
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

/** Verificação ISO 13616 (mod 97). Vazio ou só o prefixo sugerido → null (nada a dizer). */
export function ibanStatus(v: string): "valid" | "invalid" | null {
  const s = compactIban(v);
  if (!s || s === IBAN_DEFAULT_PREFIX) return null;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return "invalid";
  if (s.startsWith("PT") && s.length !== 25) return "invalid";
  const moved = s.slice(4) + s.slice(0, 4);
  let rest = 0;
  for (const ch of moved) {
    const n = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of n) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1 ? "valid" : "invalid";
}

/** O que se grava: sem espaços; só o prefixo sugerido conta como vazio. */
export const ibanToSave = (v: string) => {
  const s = compactIban(v);
  return s === IBAN_DEFAULT_PREFIX ? "" : s;
};

// ── Telefone ─────────────────────────────────────────────────────────

export interface DialCode {
  /** ISO 3166-1 alfa-2. */
  country: string;
  code: string;
}

/** Indicativos (Portugal primeiro; depois Espanha, CPLP e os mais comuns). */
export const DIAL_CODES: DialCode[] = [
  { country: "PT", code: "+351" },
  { country: "ES", code: "+34" },
  { country: "BR", code: "+55" },
  { country: "AO", code: "+244" },
  { country: "CV", code: "+238" },
  { country: "MZ", code: "+258" },
  { country: "GW", code: "+245" },
  { country: "ST", code: "+239" },
  { country: "TL", code: "+670" },
  { country: "FR", code: "+33" },
  { country: "GB", code: "+44" },
  { country: "IE", code: "+353" },
  { country: "DE", code: "+49" },
  { country: "IT", code: "+39" },
  { country: "NL", code: "+31" },
  { country: "BE", code: "+32" },
  { country: "LU", code: "+352" },
  { country: "CH", code: "+41" },
  { country: "AT", code: "+43" },
  { country: "AD", code: "+376" },
  { country: "PL", code: "+48" },
  { country: "RO", code: "+40" },
  { country: "BG", code: "+359" },
  { country: "MD", code: "+373" },
  { country: "UA", code: "+380" },
  { country: "RU", code: "+7" },
  { country: "SE", code: "+46" },
  { country: "NO", code: "+47" },
  { country: "DK", code: "+45" },
  { country: "FI", code: "+358" },
  { country: "GR", code: "+30" },
  { country: "CZ", code: "+420" },
  { country: "HU", code: "+36" },
  { country: "TR", code: "+90" },
  { country: "MA", code: "+212" },
  { country: "DZ", code: "+213" },
  { country: "TN", code: "+216" },
  { country: "SN", code: "+221" },
  { country: "GN", code: "+224" },
  { country: "NG", code: "+234" },
  { country: "ZA", code: "+27" },
  { country: "US", code: "+1" },
  { country: "MX", code: "+52" },
  { country: "CO", code: "+57" },
  { country: "VE", code: "+58" },
  { country: "AR", code: "+54" },
  { country: "CL", code: "+56" },
  { country: "PE", code: "+51" },
  { country: "EC", code: "+593" },
  { country: "BO", code: "+591" },
  { country: "PY", code: "+595" },
  { country: "UY", code: "+598" },
  { country: "CU", code: "+53" },
  { country: "DO", code: "+1809" },
  { country: "IN", code: "+91" },
  { country: "PK", code: "+92" },
  { country: "BD", code: "+880" },
  { country: "NP", code: "+977" },
  { country: "CN", code: "+86" },
  { country: "PH", code: "+63" },
  { country: "TH", code: "+66" },
  { country: "VN", code: "+84" },
];
export const DEFAULT_DIAL = "+351";

/** «+351 912 345 678» → { code: "+351", number: "912345678" }; sem indicativo → o de Portugal. */
export function splitPhone(v: string | null | undefined): { code: string; number: string } {
  const s = (v ?? "").trim();
  if (!s) return { code: DEFAULT_DIAL, number: "" };
  const compact = s.replace(/[\s().-]/g, "").replace(/^00/, "+");
  if (!compact.startsWith("+")) return { code: DEFAULT_DIAL, number: compact };
  // O indicativo conhecido mais longo que encaixa (ex.: +1809 antes de +1).
  const known = [...DIAL_CODES].sort((a, b) => b.code.length - a.code.length).find((d) => compact.startsWith(d.code));
  if (known) return { code: known.code, number: compact.slice(known.code.length) };
  const m = /^(\+\d{1,3})(\d*)$/.exec(compact);
  return m ? { code: m[1]!, number: m[2]! } : { code: DEFAULT_DIAL, number: compact };
}

/** O que se grava: «+351 912345678» (vazio se não houver número). */
export function joinPhone(code: string, number: string): string {
  const n = number.replace(/[^\d]/g, "");
  return n ? `${code} ${n}` : "";
}

// ── Género e nacionalidade ───────────────────────────────────────────

export const GENDERS = ["Feminino", "Masculino", "Outro", "Prefiro não indicar"];

/** Códigos ISO 3166-1 alfa-2 (países e territórios habitados). */
const COUNTRY_CODES =
  "AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW".split(
    " ",
  );

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["pt-PT"], { type: "region" });
  } catch {
    return null;
  }
})();

/** Nome do país em português (ou o código, se o browser não souber). */
export const countryName = (code: string) => regionNames?.of(code) ?? code;

/** Nacionalidades (nome do país): Portugal, Espanha e Brasil primeiro, depois por ordem alfabética. */
export function nationalities(): string[] {
  const first = ["PT", "ES", "BR"].map(countryName);
  const rest = COUNTRY_CODES.filter((c) => !["PT", "ES", "BR"].includes(c))
    .map(countryName)
    .sort((a, b) => a.localeCompare(b, "pt"));
  return [...first, ...rest];
}

/** Opções de uma lista com o valor atual incluído, se for antigo e não estiver lá. */
export const withCurrent = (options: string[], current: string) => (current && !options.includes(current) ? [current, ...options] : options);
