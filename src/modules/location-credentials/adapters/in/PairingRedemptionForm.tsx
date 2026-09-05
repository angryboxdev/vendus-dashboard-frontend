import { useState } from "react";
import { useLocationCredentialsModule } from "../../location-credentials.module.tsx";
import {
  InvalidPairingCodeError,
  PairingCodeAlreadyUsedError,
  PairingCodeExpiredError,
  PairingCodeNotFoundError,
} from "../../domain/entities/pairing-errors.ts";

function errorMessage(err: unknown): string {
  if (err instanceof InvalidPairingCodeError) return "Código inválido.";
  if (err instanceof PairingCodeNotFoundError) return "Código não encontrado.";
  if (err instanceof PairingCodeAlreadyUsedError) return "Código já utilizado.";
  if (err instanceof PairingCodeExpiredError) return "Código expirado, peça um novo.";
  return "Não foi possível emparelhar. Tente novamente.";
}

export function PairingRedemptionForm({ onRedeemed }: { onRedeemed: () => void }) {
  const { redeemPairingCode } = useLocationCredentialsModule();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await redeemPairingCode.execute(code.trim());
      onRedeemed();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF6F3] p-6">
      <form
        onSubmit={(e) => { void handleSubmit(e); }}
        className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-stone-800">Emparelhar dispositivo</h1>
        <p className="mt-1 text-sm text-stone-500">
          Introduza o código de emparelhamento gerado pelo administrador.
        </p>
        <input
          className="mt-4 w-full rounded-lg border border-stone-300 px-3 py-2 text-center text-lg font-mono uppercase tracking-widest focus:border-[#ED5C32] focus:outline-none"
          placeholder="XXXXXXXX"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          disabled={submitting}
          maxLength={8}
        />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !code.trim()}
          className="mt-4 w-full rounded-lg bg-[#ED5C32] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "A emparelhar…" : "Emparelhar"}
        </button>
      </form>
    </div>
  );
}
