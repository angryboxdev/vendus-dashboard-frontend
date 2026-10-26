import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useStockPurchaseReviewModule } from "../../stock-purchase-review.module.tsx";
import { ENTRY_MODE_LABELS, ENTRY_RULE_TYPES, type EntryMode, type EntryRules, type StockSettings } from "../../domain/entities/stock-purchase-review.ts";

/**
 * Regras de entrada no Stock por tipo de artigo (task «Stock inteligente» V4 §2), abertas pela
 * engrenagem em «Artigos e ingredientes». Por empresa; só quem gere Compras por rever grava.
 * Só afetam faturas futuras. O Tipo de artigo decide o inventário; a Categoria financeira classifica o custo.
 */
export function EntryRulesModal({ onClose }: { onClose(): void }) {
  const { api } = useStockPurchaseReviewModule();
  const [rules, setRules] = useState<EntryRules | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // V5 §2.4: localização principal do Stock (para onde vão as entradas das faturas).
  const [settings, setSettings] = useState<StockSettings | null>(null);
  const [defaultLocationId, setDefaultLocationId] = useState<string | null>(null);

  useEffect(() => {
    api.getEntryRules().then(setRules).catch((e: unknown) => setError(e instanceof Error ? e.message : "Não foi possível ler as regras."));
    api
      .getStockSettings()
      .then((s) => {
        setSettings(s);
        setDefaultLocationId(s.defaultLocationId);
      })
      .catch(() => setSettings(null));
  }, [api]);

  async function save() {
    if (!rules) return;
    setSaving(true);
    setError(null);
    try {
      setRules(await api.saveEntryRules(rules));
      if (settings && defaultLocationId !== settings.defaultLocationId) {
        const next = await api.saveStockSettings(defaultLocationId);
        setSettings(next);
        setDefaultLocationId(next.defaultLocationId);
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível gravar.");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Regras de entrada no Stock">
      <div className="absolute inset-0 bg-black/40" onClick={() => !saving && onClose()} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-slate-900">Regras de entrada no Stock</h2>
        <p className="mt-1 text-xs text-slate-500">
          Por tipo de artigo: o que entra no inventário quando chega numa fatura. Vale para as faturas futuras; a decisão manual da linha e uma decisão já confirmada (artigo/embalagem do fornecedor) têm prioridade.
        </p>
        {!rules && !error && <p className="mt-4 text-sm text-slate-400">A carregar…</p>}
        {rules && (
          <table className="mt-4 w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {ENTRY_RULE_TYPES.map(({ type, label }) => (
                <tr key={type}>
                  <td className="py-2 pr-3 text-slate-700">{label}</td>
                  <td className="py-2">
                    <div role="radiogroup" aria-label={label} className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                      {(Object.keys(ENTRY_MODE_LABELS) as EntryMode[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={rules[type] === m}
                          onClick={() => {
                            setRules({ ...rules, [type]: m });
                            setSaved(false);
                          }}
                          className={`flex-1 rounded-md px-2 py-1 font-medium ${rules[type] === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                          {ENTRY_MODE_LABELS[m]}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {settings && settings.locations.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <label htmlFor="stock-default-location" className="block text-sm font-medium text-slate-700">
              Localização principal do Stock
            </label>
            <p className="mt-0.5 text-xs text-slate-500">
              {settings.locations.length === 1
                ? "Só há uma loja ativa: as entradas das faturas vão para ela."
                : "As entradas das faturas vão para esta loja, sem perguntar. Sem localização principal, a entrada fica bloqueada até a definir."}
            </p>
            <select
              id="stock-default-location"
              value={defaultLocationId ?? ""}
              onChange={(e) => {
                setDefaultLocationId(e.target.value || null);
                setSaved(false);
              }}
              className="mt-1.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            >
              <option value="">— por definir —</option>
              {settings.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {saved && <p className="mt-3 text-xs text-emerald-700">Regras gravadas.</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-md px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-50">
            Fechar
          </button>
          <button type="button" onClick={() => void save()} disabled={!rules || saving} className="rounded-md bg-[#ED5C32] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
            {saving ? "A gravar…" : "Gravar regras"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
