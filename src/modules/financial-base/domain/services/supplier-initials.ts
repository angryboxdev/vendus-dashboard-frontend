/** Iniciais do nome do fornecedor (até duas letras), para quando não há logótipo: «Makro Portugal» → «MP». */
export function supplierInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const letters = words.length > 1 ? [words[0]![0], words[1]![0]] : [...(words[0] ?? "?").slice(0, 2)];
  return letters.join("").toUpperCase();
}
