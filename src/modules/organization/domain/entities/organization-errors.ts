import type { OrganizationFieldError } from "./organization-profile.ts";

/** 400 do backend com erros por campo — o formulário mostra cada um junto do campo respetivo. */
export class OrganizationValidationError extends Error {
  readonly fieldErrors: OrganizationFieldError[];

  constructor(fieldErrors: OrganizationFieldError[]) {
    super("Há campos inválidos no perfil da empresa");
    this.name = "OrganizationValidationError";
    this.fieldErrors = fieldErrors;
  }
}

/** Validação local do logotipo, antes de qualquer pedido (mesmos limites do backend). */
export class InvalidLogoFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLogoFileError";
  }
}
