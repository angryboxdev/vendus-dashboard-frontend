import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { fetchKioskDailyToken } from "../hr/hrApi";

type TokenState =
  | { status: "loading" }
  | { status: "ok"; token: string; date: string; qrUrl: string }
  | { status: "error"; message: string };

function msUntilMidnightLisbon(): number {
  const now = new Date();
  const lisbon = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const h = Number(lisbon.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(lisbon.find((p) => p.type === "minute")?.value ?? 0);
  const s = Number(lisbon.find((p) => p.type === "second")?.value ?? 0);
  const elapsedMs = (h * 3600 + m * 60 + s) * 1000;
  const dayMs = 24 * 60 * 60 * 1000;
  return dayMs - elapsedMs + 500; // +500ms buffer
}

export function KioskDisplayPage() {
  const [state, setState] = useState<TokenState>({ status: "loading" });

  async function loadToken() {
    setState({ status: "loading" });
    try {
      const { token, date } = await fetchKioskDailyToken();
      const qrUrl = `${window.location.origin}/kiosk/checkin?date=${encodeURIComponent(date)}&token=${encodeURIComponent(token)}`;
      setState({ status: "ok", token, date, qrUrl });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro ao carregar QR code";
      setState({ status: "error", message });
    }
  }

  useEffect(() => {
    void loadToken();

    // Recarrega o QR automaticamente à meia-noite de Lisboa
    const ms = msUntilMidnightLisbon();
    const t = setTimeout(() => { void loadToken(); }, ms);
    return () => clearTimeout(t);
  }, []);

  const todayLabel = new Date().toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Lisbon",
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        {/* Header */}
        <div className="text-center">
          <p className="text-2xl font-bold tracking-tight text-white">Angry Box</p>
          <p className="mt-1 text-sm capitalize text-slate-400">{todayLabel}</p>
        </div>

        {/* QR area */}
        <div className="flex flex-col items-center gap-6">
          {state.status === "loading" ? (
            <div className="flex h-64 w-64 items-center justify-center rounded-2xl bg-white">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
            </div>
          ) : state.status === "error" ? (
            <div className="flex h-64 w-64 flex-col items-center justify-center gap-3 rounded-2xl bg-white p-6 text-center">
              <p className="text-sm text-red-700">{state.message}</p>
              <button
                type="button"
                onClick={() => void loadToken()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-white p-5 shadow-xl">
              <QRCodeSVG
                value={state.qrUrl}
                size={220}
                level="M"
                marginSize={1}
              />
            </div>
          )}

          {state.status === "ok" ? (
            <div className="text-center">
              <p className="text-lg font-semibold text-white">
                Aponta a câmara do telemóvel
              </p>
              <p className="mt-1 text-sm text-slate-400">
                para registar o teu ponto
              </p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <p className="text-xs text-slate-600">O QR renova automaticamente à meia-noite</p>
      </div>
    </div>
  );
}
