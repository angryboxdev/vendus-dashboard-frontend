/** O servidor pede confirmação expressa (data futura, relógio atrasado). */
export class IssueNeedsConfirmationError extends Error {
  readonly warnings: string[];

  constructor(warnings: string[]) {
    super("Confirmação necessária");
    this.warnings = warnings;
    this.name = "IssueNeedsConfirmationError";
  }
}

/** Regra fiscal recusada pelo servidor (422) — mensagem já em português, para mostrar. */
export class FiscalRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FiscalRuleError";
  }
}
