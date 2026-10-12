import { supabase } from "../../../../lib/supabase.ts";
import type { MfaEnrollment, MfaPort, MfaStatus } from "../../domain/ports/out/mfa.port.ts";

/** MFA TOTP do Supabase Auth (tem de estar ativa no projeto: Authentication → MFA → TOTP). */
export class SupabaseMfaAdapter implements MfaPort {
  async status(): Promise<MfaStatus> {
    const [aal, factors] = await Promise.all([supabase.auth.mfa.getAuthenticatorAssuranceLevel(), supabase.auth.mfa.listFactors()]);
    if (aal.error) throw new Error(aal.error.message);
    if (factors.error) throw new Error(factors.error.message);
    const verified = factors.data.totp.find((f) => f.status === "verified");
    return { level: aal.data.currentLevel === "aal2" ? "aal2" : "aal1", factorId: verified?.id ?? null };
  }

  async enroll(): Promise<MfaEnrollment> {
    // Limpa tentativas anteriores por concluir (o Supabase recusa nomes repetidos).
    const factors = await supabase.auth.mfa.listFactors();
    for (const f of factors.data?.all ?? []) {
      if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Mezza ERP ${new Date().toISOString().slice(0, 16)}` });
    if (error) throw new Error(error.message);
    return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  }

  async verify(factorId: string, code: string): Promise<void> {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) throw new Error(error.message);
  }
}
