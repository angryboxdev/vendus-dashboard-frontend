import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertBanner, Button, FIELD, LABEL, SURFACE } from "../../../../components/ui/index.ts";
import type { PosSettings } from "../../domain/entities/pos.ts";
import { usePosModule } from "../../pos.module.tsx";
import { errorText, usePosSettings } from "./use-pos.ts";

/** Vendas → POS: séries (FR e NC, com código da AT) e gestores (PIN do quiosque de ponto). */
export function PosSettingsView() {
  const { pos } = usePosModule();
  const { data, error } = usePosSettings();
  const [form, setForm] = useState<PosSettings | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data && !form) setForm(data.settings);
  }, [data, form]);

  if (error) return <AlertBanner tone="danger" title="Não foi possível carregar a configuração">{error}</AlertBanner>;
  if (!data || !form) return <p className="text-sm text-ink-secondary">A carregar…</p>;

  const seriesOf = (type: string) => data.series.filter((s) => s.documentType === type && s.validationCode);
  const select = (type: "FR" | "NC", field: "invoiceSeriesRef" | "creditSeriesRef", label: string) => (
    <label>
      <span className={LABEL}>{label}</span>
      <select className={FIELD} value={form[field] ?? ""} onChange={(e) => setForm({ ...form, [field]: e.target.value || null })}>
        <option value="">Escolher…</option>
        {seriesOf(type).map((s) => (
          <option key={s.ref} value={s.ref}>
            {s.seriesId}
            {s.mode === "training" ? " (formação)" : ""}
          </option>
        ))}
      </select>
      {seriesOf(type).length === 0 && (
        <span className="mt-1 block text-xs text-ink-secondary">
          Crie uma série {type} em <Link className="underline" to="/vendas/series">Séries</Link> e registe o código de validação da AT.
        </span>
      )}
    </label>
  );

  return (
    <form
      className={`${SURFACE} space-y-5 p-4`}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setSaveError(null);
        setSaved(false);
        try {
          setForm(await pos.saveSettings(form));
          setSaved(true);
        } catch (err) {
          setSaveError(errorText(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <h2 className="text-base font-semibold text-ink">Caixa (POS)</h2>
        <p className="text-sm text-ink-secondary">
          Antes do certificado da AT, o POS emite documentos de formação («DOCUMENTO DE TESTE»). O Vendus continua a ser o sistema oficial.{" "}
          <Link className="font-medium underline" to="/pos">
            Abrir o POS
          </Link>
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {select("FR", "invoiceSeriesRef", "Série das faturas-recibo (FR)")}
        {select("NC", "creditSeriesRef", "Série das notas de crédito (NC)")}
      </div>
      <fieldset>
        <legend className={LABEL}>Gestores (podem sair do POS e emitir notas de crédito)</legend>
        <p className="mb-2 text-xs text-ink-secondary">Entram com o PIN do registo de ponto. Só aparecem funcionários ativos.</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.employees.map((emp) => (
            <label key={emp.id} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.managerEmployeeIds.includes(emp.id)}
                onChange={(e) =>
                  setForm({ ...form, managerEmployeeIds: e.target.checked ? [...form.managerEmployeeIds, emp.id] : form.managerEmployeeIds.filter((x) => x !== emp.id) })
                }
              />
              {emp.name}
            </label>
          ))}
        </div>
      </fieldset>
      {saveError && <AlertBanner tone="danger" title="Não foi possível gravar">{saveError}</AlertBanner>}
      {saved && <AlertBanner tone="success" title="Configuração gravada">O POS já usa estas séries e gestores.</AlertBanner>}
      <Button type="submit" variant="primary" loading={busy}>
        Gravar
      </Button>
    </form>
  );
}
