/** Recusa do POS com mensagem para o ecrã (regra, PIN, recusa fiscal). */
export class PosError extends Error {
  readonly kind: "rule" | "pin";

  constructor(message: string, kind: "rule" | "pin") {
    super(message);
    this.name = "PosError";
    this.kind = kind;
  }
}
