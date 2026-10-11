import type { Person, PersonField } from "../entities/people.ts";

/** Secções da ficha (ordem do ecrã). `type` decide o controlo. */
export const PERSON_SECTIONS: { key: "identity" | "contact" | "address" | "work" | "pay"; fields: { field: PersonField; type: "text" | "date" | "email" | "number" | "select" }[] }[] = [
  {
    key: "identity",
    fields: [
      { field: "firstName", type: "text" },
      { field: "lastName", type: "text" },
      { field: "nif", type: "text" },
      { field: "idCardNumber", type: "text" },
      { field: "niss", type: "text" },
      { field: "birthDate", type: "date" },
      { field: "gender", type: "text" },
      { field: "nationality", type: "text" },
    ],
  },
  {
    key: "contact",
    fields: [
      { field: "email", type: "email" },
      { field: "phone", type: "text" },
      { field: "personalEmail", type: "email" },
    ],
  },
  {
    key: "address",
    fields: [
      { field: "address", type: "text" },
      { field: "postalCode", type: "text" },
      { field: "city", type: "text" },
      { field: "country", type: "text" },
    ],
  },
  {
    key: "work",
    fields: [
      { field: "hireDate", type: "date" },
      { field: "primaryLocationId", type: "select" },
    ],
  },
  {
    key: "pay",
    fields: [
      { field: "iban", type: "text" },
      { field: "currency", type: "text" },
      { field: "baseSalary", type: "number" },
      { field: "hourlyRate", type: "number" },
    ],
  },
];

export const MANDATORY: PersonField[] = ["firstName", "lastName", "nif", "hireDate", "primaryLocationId"];
/** Alterar exige motivo (o backend recusa sem ele). */
export const SENSITIVE: PersonField[] = ["nif", "iban", "niss", "idCardNumber", "baseSalary", "hourlyRate"];

export type PersonDraft = Partial<Record<PersonField, string>>;

/** Texto de cada campo para o formulário. */
export function draftOf(p: Person): PersonDraft {
  const d: PersonDraft = {};
  for (const s of PERSON_SECTIONS) for (const { field } of s.fields) d[field] = p[field] === null || p[field] === undefined ? "" : String(p[field]);
  return d;
}

/** Só os campos alterados (e visíveis), já no tipo certo para o backend. */
export function changedFields(p: Person, draft: PersonDraft): Partial<Record<PersonField, string | number | null>> {
  const out: Partial<Record<PersonField, string | number | null>> = {};
  for (const s of PERSON_SECTIONS) {
    for (const { field, type } of s.fields) {
      if (p.hidden.includes(field) || draft[field] === undefined) continue;
      const before = p[field] === null || p[field] === undefined ? "" : String(p[field]);
      const after = (draft[field] ?? "").trim();
      if (after === before) continue;
      out[field] = after === "" ? null : type === "number" ? Number(after) : after;
    }
  }
  return out;
}

export const needsReason = (changes: object) => SENSITIVE.some((f) => f in changes);
