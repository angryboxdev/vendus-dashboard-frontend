/** Autenticação de dois fatores (app autenticadora, TOTP) — ADR-0024 do backend (D2). */
export interface MfaStatus {
  /** `aal2` = sessão já confirmada com o segundo fator. */
  level: "aal1" | "aal2";
  /** Fator TOTP já ativado (verificado) nesta conta; null se ainda não há. */
  factorId: string | null;
}

export interface MfaEnrollment {
  factorId: string;
  /** Imagem do QR code (data URL SVG) para ler na app autenticadora. */
  qrCode: string;
  /** Chave para introduzir à mão, se não der para ler o QR. */
  secret: string;
}

export interface MfaPort {
  status(): Promise<MfaStatus>;
  enroll(): Promise<MfaEnrollment>;
  /** Confirma o código de 6 dígitos (ativação ou entrada); a sessão passa a `aal2`. */
  verify(factorId: string, code: string): Promise<void>;
}
