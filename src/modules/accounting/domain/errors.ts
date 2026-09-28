import type { AccountingDuplicateCandidate } from "./entities/accounting-document.ts";

/**
 * Espelha o 409 `PossibleDuplicateDocumentError` do backend (deteção de
 * duplicados por NIF+número+data+total). A UI deve mostrar `candidate` e
 * deixar o utilizador cancelar ou reenviar o mesmo pedido com
 * `confirmDuplicate: true` — nunca engolir isto como um erro genérico.
 */
export class AccountingDuplicateError extends Error {
  readonly candidate: AccountingDuplicateCandidate;

  constructor(candidate: AccountingDuplicateCandidate) {
    super(`Possível documento duplicado: ${candidate.label}`);
    this.name = "AccountingDuplicateError";
    this.candidate = candidate;
  }
}
