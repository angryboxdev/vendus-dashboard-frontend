import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useStockPurchaseReviewModule } from "../../stock-purchase-review.module.tsx";
import { ENTRY_MODE_LABELS, ENTRY_RULE_TYPES, type EntryMode, type EntryRules, type StockSettings } from "../../domain/entities/stock-purchase-review.ts";
import { SlideSwitch } from "../../../../components/ui/SlideSwitch.tsx";

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
      <div className="relative w-full max-w-xl rounded-2xl bg-surface-card p-6 shadow-pop">
        <h2 className="text-base font-semibold text-ink">Regras de entrada no Stock</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Por tipo de artigo: o que entra no inventário quando chega numa fatura. Vale para as faturas futuras; a decisão manual da linha e uma decisão já confirmada (artigo/embalagem do fornecedor) têm prioridade.
        </p>
        {!rules && !error && <p className="mt-4 text-sm text-ink-muted">A carregar…</p>}
        {rules && (
          <ul className="mt-4 divide-y divide-line">
            {ENTRY_RULE_TYPES.map(({ type, label }) => (
              <li key={type} className="flex flex-col items-start gap-1.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="text-sm text-ink sm:min-w-0 sm:flex-1">{label}</span>
                <SlideSwitch
                  label={label}
                  itemWidthClass="w-24 sm:w-28"
                  options={(Object.keys(ENTRY_MODE_LABELS) as EntryMode[]).map((m) => ({ key: m, label: ENTRY_MODE_LABELS[m] }))}
                  value={rules[type]}
                  onChange={(m) => {
                    setRules({ ...rules, [type]: m });
                    setSaved(false);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
        {settings && settings.locations.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <label htmlFor="stock-default-location" className="block text-sm font-medium text-ink">
              Localização principal do Stock
            </label>
            <p className="mt-0.5 text-xs text-ink-muted">
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
              className="mt-1.5 w-full rounded-md border border-line bg-surface-card px-2 py-1.5 text-sm text-ink"
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
          <button type="button" onClick={onClose} disabled={saving} className="rounded-md px-4 py-2 text-sm text-ink-secondary hover:bg-surface-soft disabled:opacity-50">
            Fechar
          </button>
          <button type="button" onClick={() => void save()} disabled={!rules || saving} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
            {saving ? "A gravar…" : "Gravar regras"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
