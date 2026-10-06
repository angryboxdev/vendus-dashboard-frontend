import { useState } from "react";
import { useAuth } from "../../../../contexts/AuthContext.tsx";

/** 1º acesso com palavra-passe temporária (ou "Mudar palavra-passe" no Perfil). */
export function SetPasswordView({ firstAccess, onDone }: { firstAccess: boolean; onDone?: () => void }) {
  const { changePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("A palavra-passe tem de ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As palavras-passe não coincidem.");
    setSaving(true);
    setError(null);
    try {
      await changePassword(password);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4 rounded-2xl border border-[#F5C992]/50 bg-white p-5 shadow-sm">
      <div>
        <h1 className="text-lg font-semibold text-stone-900">{firstAccess ? "Defina a sua palavra-passe" : "Mudar palavra-passe"}</h1>
        {firstAccess && <p className="text-sm text-stone-600">É o seu primeiro acesso: substitua a palavra-passe temporária que recebeu.</p>}
      </div>
      <div>
        <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-stone-700">Nova palavra-passe</label>
        <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-base" />
      </div>
      <div>
        <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-stone-700">Repetir palavra-passe</label>
        <input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-base" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#ED5C32] px-4 py-3 text-base font-semibold text-white disabled:opacity-50">
        {saving ? "A guardar…" : "Guardar"}
      </button>
    </form>
  );
}
