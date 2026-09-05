import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LocationSelect } from "../../../../components/LocationSelect.tsx";
import { PageFooter } from "../../../../components/PageFooter.tsx";
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

function fmtDeviceId(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function CountdownPill({ seconds, urgent }: { seconds: number; urgent: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        urgent ? "bg-[#FEF3EC] text-[#A3211A]" : "bg-stone-100 text-stone-600"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${urgent ? "animate-pulse bg-[#A3211A]" : "bg-stone-400"}`} />
      Expira em {fmtCountdown(seconds)}
    </span>
  );
}

function GeneratedCode({
  pairingCode,
  onExpired,
  onRegenerate,
  regenerating,
}: {
  pairingCode: PairingCode;
  onExpired: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const { remainingSeconds, expired } = useCountdown(pairingCode);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(pairingCode.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  if (expired) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg border border-[#F5C992]/80 bg-[#FEF3EC] px-4 py-3 text-sm text-[#A3211A]">
        Código expirado.
        <button type="button" onClick={onExpired} className="font-semibold underline underline-offset-2">
          Gerar novo código
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="sr-only">{pairingCode.code}</span>
        <span aria-hidden="true" className="flex flex-wrap gap-1.5">
          {pairingCode.code.split("").map((char, i) => (
            <span
              key={i}
              className="flex h-11 w-9 items-center justify-center rounded-md border border-stone-200 bg-stone-50 font-mono text-lg font-bold text-stone-800"
            >
              {char}
            </span>
          ))}
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="ml-2 text-xs font-medium text-stone-500 underline decoration-stone-300 underline-offset-4 hover:text-[#ED5C32] hover:decoration-[#ED5C32]"
        >
          {copied ? "Copiado ✓" : "Copiar"}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <CountdownPill seconds={remainingSeconds} urgent={remainingSeconds <= 60} />
        <button
          type="button"
          disabled={regenerating}
          onClick={onRegenerate}
          className="text-xs font-medium text-stone-500 underline decoration-stone-300 underline-offset-4 hover:text-[#ED5C32] hover:decoration-[#ED5C32] disabled:opacity-50"
        >
          Gerar novo código
        </button>
      </div>

      <p className="mt-3 text-xs text-stone-400">Este código não voltará a aparecer depois de sair desta página.</p>
    </div>
  );
}

function TokenListSkeleton() {
  return (
    <div className="animate-pulse divide-y divide-stone-50">
      {[0, 1].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <div className="h-3 w-40 rounded bg-stone-100" />
          <div className="h-3 w-24 rounded bg-stone-100" />
        </div>
      ))}
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

  if (isPending) {
    return (
      <div className="mt-3 rounded-xl border border-stone-100 bg-white shadow-sm">
        <TokenListSkeleton />
      </div>
    );
  }

  const tokens = data ?? [];
  if (tokens.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-stone-100 bg-white py-10 text-center shadow-sm">
        <p className="text-sm text-stone-400">Nenhum dispositivo emparelhado nesta loja.</p>
        <p className="mt-1 text-xs text-stone-400">Gere um código acima para ligar o primeiro ecrã.</p>
      </div>
    );
  }

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-stone-100 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-100 bg-stone-50 text-left text-xs font-semibold uppercase tracking-wide text-stone-400">
            <th className="px-4 py-3 font-semibold">ID</th>
            <th className="px-4 py-3 font-semibold">Emparelhado em</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-50">
          {tokens.map((t) => (
            <tr key={t.id} className="hover:bg-[#FAF6F3]">
              <td className="px-4 py-3 font-mono text-xs text-stone-600" title={t.id}>
                {fmtDeviceId(t.id)}
              </td>
              <td className="px-4 py-3 tabular-nums text-stone-500">{fmtIssuedAt(t.issuedAt)}</td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  disabled={revokeMutation.isPending}
                  onClick={() => handleRevoke(t)}
                  className="text-xs font-medium text-[#A3211A] hover:underline disabled:opacity-50"
                >
                  Revogar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
    <div className="flex min-h-screen flex-col bg-[#FAF6F3]">
      <div className="mx-auto w-full max-w-2xl flex-1 p-6">
        <h1 className="text-2xl font-bold text-[#A3211A]">Tokens de dispositivo</h1>
        <p className="mt-1 text-sm text-stone-500">
          Emparelhamento de ecrãs sem operador (kiosk, fecho de caixa, KDS) por loja.
        </p>

        <div className="mt-6">
          <LocationSelect value={chosenLocationId} onChange={setChosenLocationId} label="Loja" />
        </div>

        {!locationId && (
          <p className="mt-6 text-sm text-stone-400">Selecione uma loja para gerir os dispositivos.</p>
        )}

        {locationId && (
          <>
            <div className="relative mt-6 overflow-hidden rounded-xl border border-[#F5C992]/60 bg-white p-5 shadow-sm">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#ED5C32] to-[#EF8935]" />

              {!pairingCode ? (
                <>
                  <h2 className="text-sm font-semibold text-stone-800">Emparelhar novo dispositivo</h2>
                  <p className="mt-1 text-xs text-stone-500">
                    Gere um código e introduza-o no ecrã que quer ligar a esta loja.
                  </p>
                  <button
                    type="button"
                    disabled={generating}
                    onClick={() => void handleGenerate()}
                    className="btn-primary mt-4"
                  >
                    {generating ? "A gerar…" : "Gerar código de emparelhamento"}
                  </button>
                </>
              ) : (
                <GeneratedCode
                  pairingCode={pairingCode}
                  onExpired={() => setPairingCode(null)}
                  onRegenerate={() => void handleGenerate()}
                  regenerating={generating}
                />
              )}
            </div>

            <div className="mt-8">
              <h2 className="text-sm font-semibold text-stone-800">Dispositivos emparelhados</h2>
              <TokenList locationId={locationId} />
            </div>
          </>
        )}
      </div>
      <PageFooter />
    </div>
  );
}
