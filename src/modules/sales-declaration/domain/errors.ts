export class InvalidSalesDeclarationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSalesDeclarationRequestError";
  }
}
