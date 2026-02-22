import type { Debug } from "../types/monthlySummary";

export function DebugPanel({ url, debug }: { url: string; debug: Debug }) {
  return (
    <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Debug</h2>
        <span className="text-xs text-slate-500">
          {debug?.took_ms ? `${debug.took_ms}ms` : ""}
        </span>
      </div>

      <pre className="mt-4 max-h-[420px] overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-slate-100">
        {JSON.stringify({ url, debug }, null, 2)}
      </pre>
    </div>
  );
}
