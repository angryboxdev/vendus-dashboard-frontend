/** Mesmo limite do backend (multer: 10 ficheiros). */
export const MAX_SAFT_FILES = 10;

/** Mensagem de erro (pt-PT) ou `null` se os ficheiros escolhidos puderem ser enviados. */
export function validateSaftFiles(names: string[]): string | null {
  if (names.length === 0) return "Escolha pelo menos um ficheiro SAF-T (.xml).";
  if (names.length > MAX_SAFT_FILES) return `Pode enviar no máximo ${MAX_SAFT_FILES} ficheiros.`;
  const notXml = names.find((n) => !n.toLowerCase().endsWith(".xml"));
  if (notXml !== undefined) return `"${notXml}" não é um ficheiro .xml.`;
  return null;
}
