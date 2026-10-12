import type { FormField } from "../entities/engagement.ts";

/** Uma linha por item; "*" no início = obrigatório. */
export function parseChecklist(text: string): { text: string; required: boolean }[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.startsWith("*") ? { text: l.slice(1).trim(), required: true } : { text: l, required: false }))
    .filter((i) => i.text);
}

/** Campo novo do formulário (id estável a partir da posição). */
export function newField(index: number): FormField {
  return { id: `campo${index + 1}`, title: "", type: "text", options: [], required: false };
}

/** "S, M, L" → ["S", "M", "L"]. */
export const parseOptions = (text: string) => [...new Set(text.split(",").map((o) => o.trim()).filter(Boolean))];

export const shortDateTime = (iso: string | null) => (iso ? iso.slice(0, 16).replace("T", " ") : "—");
