import type { Country, LegalEntityInput, TaxIdType } from "../entities/legal-entities.ts";

/**
 * Validação no cliente = espelho do servidor (módulo `legal-entities` do
 * backend): mesmos algoritmos de dígito de controlo e mesmos formatos. O
 * servidor continua a ser a fonte de verdade.
 */
export const normalizeTaxId = (v: string) => v.replace(/[\s.\-/]/g, "").toUpperCase();

export function validPtNif(v: string): boolean {
  if (!/^\d{9}$/.test(v)) return false;
  const sum = [...v.slice(0, 8)].reduce((s, d, i) => s + Number(d) * (9 - i), 0);
  const r = sum % 11;
  return Number(v[8]) === (r < 2 ? 0 : 11 - r);
}

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

export function validEsNif(v: string): boolean {
  const m = /^(\d{8})([A-Z])$/.exec(v);
  return !!m && DNI_LETTERS[Number(m[1]) % 23] === m[2];
}

export function validEsNie(v: string): boolean {
  const m = /^([XYZ])(\d{7})([A-Z])$/.exec(v);
  if (!m) return false;
  return DNI_LETTERS[Number(`${"XYZ".indexOf(m[1]!)}${m[2]}`) % 23] === m[3];
}

export function validEsCif(v: string): boolean {
  const m = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(v);
  if (!m) return false;
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const d = Number(m[2]![i]);
    if (i % 2 === 0) {
      const x = d * 2;
      sum += Math.floor(x / 10) + (x % 10);
    } else sum += d;
  }
  const control = (10 - (sum % 10)) % 10;
  const letter = "JABCDEFGHI"[control]!;
  if ("PQRSNW".includes(m[1]!)) return m[3] === letter;
  if ("ABEH".includes(m[1]!)) return m[3] === String(control);
  return m[3] === letter || m[3] === String(control);
}

export function validTaxId(country: Country, type: TaxIdType, v: string): boolean {
  if (country === "PT") return type === "nif" && validPtNif(v);
  if (type === "cif") return validEsCif(v);
  if (type === "nif") return validEsNif(v);
  return validEsNie(v);
}

/** Erros por campo (vazio = válido). Mensagens iguais às do servidor. */
export function legalEntityErrors(i: LegalEntityInput, regionLabel: string): Partial<Record<keyof LegalEntityInput, string>> {
  const e: Partial<Record<keyof LegalEntityInput, string>> = {};
  const len = (v: string, a: number, b: number) => v.trim().length >= a && v.trim().length <= b;
  if (!len(i.name, 2, 160)) e.name = "A denominação social tem de ter entre 2 e 160 caracteres.";
  if (!validTaxId(i.country, i.taxIdType, normalizeTaxId(i.taxId))) e.taxId = "Identificação fiscal inválida (formato ou dígito de controlo).";
  if (!/^\d{11}$/.test(i.socialSecurityId.replace(/\s/g, ""))) e.socialSecurityId = "A identificação na Segurança Social tem 11 dígitos.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.billingEmail.trim())) e.billingEmail = "E-mail de faturação inválido.";
  if (!len(i.street, 2, 200)) e.street = "A morada tem de ter entre 2 e 200 caracteres.";
  if (i.country === "PT" ? !/^\d{4}-\d{3}$/.test(i.postalCode.trim()) : !/^\d{5}$/.test(i.postalCode.trim())) e.postalCode = i.country === "PT" ? "Código postal no formato 0000-000." : "Código postal com 5 dígitos.";
  if (!len(i.city, 2, 80)) e.city = "A localidade tem de ter entre 2 e 80 caracteres.";
  if (!len(i.region, 2, 80)) e.region = `Indique o ${regionLabel.toLowerCase()}.`;
  const phone = i.phone?.replace(/\s/g, "") ?? "";
  if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) e.phone = "Telefone no formato internacional (ex.: +351…).";
  return e;
}
