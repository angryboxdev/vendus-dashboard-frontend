export function HeaderFilters({
  since,
  until,
  type,
  loading,
  onChange,
  onRefresh,
}: {
  since: string;
  until: string;
  type: string;
  loading: boolean;
  onChange: (next: { since?: string; until?: string; type?: string }) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Vendus Dashboard</h1>
        <p className="text-sm text-slate-500">
          Conectado ao backend via <code className="font-mono">/api</code>
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Desde</span>
          <input
            type="date"
            value={since}
            onChange={(e) => onChange({ since: e.target.value })}
            className="w-44 rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Até</span>
          <input
            type="date"
            value={until}
            onChange={(e) => onChange({ until: e.target.value })}
            className="w-44 rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Tipo</span>
          <select
            value={type}
            onChange={(e) => onChange({ type: e.target.value })}
            className="w-32 rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="FS">FS</option>
            <option value="NC">NC</option>
          </select>
        </label>

        <button
          onClick={onRefresh}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Carregando..." : "Atualizar"}
        </button>
      </div>
    </div>
  );
}
