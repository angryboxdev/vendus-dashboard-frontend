import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError } from "../../lib/api";
import { kioskScan, type KioskScanResult } from "../hr/hrApi";

type PageState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: KioskScanResult }
  | { status: "error"; message: string };

const KEYPAD: (string | null)[] = [
  "1", "2", "3",
  "4", "5", "6",
  "7", "8", "9",
  null, "0", "⌫",
];

function PinDots({ count }: { count: number }) {
  return (
    <div className="flex gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`h-4 w-4 rounded-full transition-colors ${
            i < count ? "bg-indigo-500" : "bg-slate-300"
          }`}
        />
      ))}
    </div>
  );
}

export function KioskCheckinPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const date = params.get("date") ?? "";

  const [digits, setDigits] = useState<string[]>([]);
  const [pageState, setPageState] = useState<PageState>({ status: "idle" });

  const invalidLink = !token || !date;

  async function handleScan(pin: string) {
    setPageState({ status: "loading" });
    try {
      const result = await kioskScan({ token, date, pin });
      setPageState({ status: "success", result });
      // Auto-reset após 5 segundos
      setTimeout(() => {
        setDigits([]);
        setPageState({ status: "idle" });
      }, 5000);
    } catch (e: unknown) {
      const message =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Erro inesperado";
      setPageState({ status: "error", message });
      setTimeout(() => {
        setDigits([]);
        setPageState({ status: "idle" });
      }, 3500);
    }
  }

  function handleKey(key: string) {
    if (pageState.status === "loading") return;
    if (pageState.status !== "idle") return;

    if (key === "⌫") {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    if (digits.length >= 4) return;

    const next = [...digits, key];
    setDigits(next);

    if (next.length === 4) {
      void handleScan(next.join(""));
    }
  }

  if (invalidLink) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-6">
        <div className="max-w-xs text-center">
          <p className="text-4xl">⚠️</p>
          <p className="mt-4 text-lg font-semibold text-white">Link inválido</p>
          <p className="mt-2 text-sm text-slate-400">
            Lê o QR code na entrada da loja para aceder a esta página.
          </p>
        </div>
      </div>
    );
  }

  // Success screen
  if (pageState.status === "success") {
    const { result } = pageState;
    const isCheckIn = result.action === "check_in";
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-emerald-600 px-6">
        <div className="max-w-xs text-center">
          <p className="text-6xl">{isCheckIn ? "👋" : "👍"}</p>
          <p className="mt-6 text-2xl font-bold text-white">
            {isCheckIn ? "Bom dia" : "Até logo"},{" "}
            {result.employee.fullName.split(" ")[0]}!
          </p>
          <p className="mt-3 text-lg text-emerald-100">
            {isCheckIn ? "Entrada" : "Saída"} registada às{" "}
            <span className="font-semibold">{result.time}</span>
          </p>
          <p className="mt-2 text-sm text-emerald-200">
            Turno: {result.shift.startTime} – {result.shift.endTime}
          </p>
          <p className="mt-8 text-xs text-emerald-300">A fechar em 5 segundos…</p>
        </div>
      </div>
    );
  }

  // Error screen
  if (pageState.status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-red-600 px-6">
        <div className="max-w-xs text-center">
          <p className="text-6xl">✗</p>
          <p className="mt-6 text-xl font-bold text-white">{pageState.message}</p>
          <p className="mt-8 text-xs text-red-200">A fechar em 3 segundos…</p>
        </div>
      </div>
    );
  }

  // Loading screen
  if (pageState.status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-600 border-t-indigo-400" />
      </div>
    );
  }

  // Idle — PIN entry
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-6 py-12">
      <div className="flex w-full max-w-xs flex-col items-center gap-8">
        {/* Header */}
        <div className="text-center">
          <p className="text-xl font-bold text-white">Angry Box</p>
          <p className="mt-1 text-sm text-slate-400">Introduz o teu PIN</p>
        </div>

        {/* Dots */}
        <PinDots count={digits.length} />

        {/* Keypad */}
        <div className="grid w-full grid-cols-3 gap-3">
          {KEYPAD.map((key, i) =>
            key === null ? (
              <div key={i} />
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => handleKey(key)}
                className={`flex h-16 items-center justify-center rounded-2xl text-xl font-semibold transition-colors active:scale-95 ${
                  key === "⌫"
                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    : "bg-slate-700 text-white hover:bg-slate-600"
                }`}
              >
                {key}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
