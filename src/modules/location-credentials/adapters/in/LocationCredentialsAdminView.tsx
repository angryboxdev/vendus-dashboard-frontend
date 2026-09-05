import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LocationSelect } from "../../../../components/LocationSelect.tsx";
import { useLocations } from "../../../locations/adapters/in/use-locations.ts";
import { resolveLocationId } from "../../../locations/domain/services/resolve-location-id.ts";
import { useLocationCredentialsModule } from "../../location-credentials.module.tsx";
import { PairingCode } from "../../domain/entities/pairing-code.ts";
import type { DeviceTokenSummary } from "../../domain/entities/device-token-summary.ts";

function useCountdown(pairingCode: PairingCode | null) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!pairingCode) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [pairingCode]);

  if (!pairingCode) return { remainingSeconds: 0, expired: true };
  return { remainingSeconds: pairingCode.remainingSeconds(now), expired: pairingCode.isExpired(now) };
}

function fmtCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtIssuedAt(issuedAt: Date): string {
  return issuedAt.toLocaleString("pt-PT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function GeneratedCode({ pairingCode, onExpired }: { pairingCode: PairingCode; onExpired: () => void }) {
  const { remainingSeconds, expired } = useCountdown(pairingCode);

  if (expired) {
    return (
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Código expirado.
        <button type="button" onClick={onExpired} className="ml-2 font-semibold underline">
          Gerar novo código
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-[#F5C992]/80 bg-white px-4 py-3">
      <p className="font-mono text-2xl font-bold tracking-widest text-stone-800">{pairingCode.code}</p>
      <p className="mt-1 text-xs text-stone-500">Expira em {fmtCountdown(remainingSeconds)}</p>
      <p className="mt-1 text-xs text-stone-500">Este código não voltará a aparecer depois de sair desta página.</p>
    </div>
  );
}

function TokenList({ locationId }: { locationId: string }) {
  const { listActiveTokens, revokeToken } = useLocationCredentialsModule();
  const qc = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ["location-tokens", locationId],
    queryFn: () => listActiveTokens.execute(locationId),
  });

  const revokeMutation = useMutation({
    mutationFn: (tokenId: string) => revokeToken.execute(tokenId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["location-tokens", locationId] });
    },
  });

  function handleRevoke(token: DeviceTokenSummary) {
    if (!confirm("Revogar o acesso deste dispositivo?")) return;
    revokeMutation.mutate(token.id);
  }

  if (isPending) return <p className="mt-4 text-sm text-stone-400">A carregar…</p>;

  const tokens = data ?? [];
  if (tokens.length === 0) {
    return <p className="mt-4 text-sm text-stone-400">Nenhum dispositivo emparelhado nesta loja.</p>;
  }

  return (
    <table className="mt-4 w-full text-sm">
      <thead>
        <tr className="border-b border-stone-100 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
          <th className="px-4 py-3">ID</th>
          <th className="px-4 py-3">Emparelhado em</th>
          <th className="px-4 py-3" />
        </tr>
      </thead>
      <tbody>
        {tokens.map((t) => (
          <tr key={t.id} className="border-t border-stone-100">
            <td className="px-4 py-3 font-mono text-xs text-stone-600">{t.id}</td>
            <td className="px-4 py-3 tabular-nums text-stone-500">{fmtIssuedAt(t.issuedAt)}</td>
            <td className="px-4 py-3 text-right">
              <button
                type="button"
                disabled={revokeMutation.isPending}
                onClick={() => handleRevoke(t)}
                className="text-red-500 hover:underline disabled:opacity-50"
              >
                Revogar
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function LocationCredentialsAdminView() {
  const { generatePairingCode } = useLocationCredentialsModule();
  const { locations } = useLocations();
  const [chosenLocationId, setChosenLocationId] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<PairingCode | null>(null);
  const [generating, setGenerating] = useState(false);

  const locationId = resolveLocationId(chosenLocationId, locations);

  async function handleGenerate() {
    if (!locationId) return;
    setGenerating(true);
    try {
      setPairingCode(await generatePairingCode.execute(locationId));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-semibold text-slate-900">Tokens de dispositivo</h1>
        <p className="mt-1 text-sm text-slate-500">
          Emparelhamento de ecrãs sem operador (kiosk, fecho de caixa, KDS) por loja.
        </p>
      </div>

      <div className="mt-5">
        <LocationSelect value={chosenLocationId} onChange={setChosenLocationId} label="Loja" />
      </div>

      {locationId && (
        <>
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              disabled={generating}
              onClick={() => void handleGenerate()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {generating ? "A gerar…" : "Gerar código de emparelhamento"}
            </button>
          </div>

          {pairingCode && (
            <GeneratedCode pairingCode={pairingCode} onExpired={() => setPairingCode(null)} />
          )}

          <div className="mt-8">
            <h2 className="text-sm font-semibold text-slate-700">Dispositivos emparelhados</h2>
            <TokenList locationId={locationId} />
          </div>
        </>
      )}
    </div>
  );
}
