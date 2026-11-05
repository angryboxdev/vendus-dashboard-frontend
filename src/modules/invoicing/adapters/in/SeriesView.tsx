import { useState } from "react";
import { AlertBanner, Button, EmptyState, FIELD, LABEL, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../components/ui/index.ts";
import { AT_WEBSERVICE_ENABLED, DOCUMENT_TYPE_LABELS, type FiscalDocumentType, type SeriesMode } from "../../domain/entities/invoicing.ts";
import { AtSeriesActions } from "./AtSeriesActions.tsx";
import { Link } from "react-router-dom";
import { useInvoicingModule } from "../../invoicing.module.tsx";
import { useInvoicingMeta, useLegalEntities, useSeries } from "./use-invoicing.ts";

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado");

const COMPANY_FIELDS: Record<string, string> = {
  country: "País (só Portugal)",
  legalName: "Razão social",
  nif: "NIF",
  niss: "NISS",
  email: "Email",
  address: "Morada fiscal",
  postalCode: "Código postal",
  city: "Localidade",
  region: "Distrito / região",
};

/** Sem emitente: cria-o com os dados da Empresa e diz o que falta (ou o erro). */
function IssuerFromCompany({ onDone }: { onDone: () => Promise<void> }) {
  const { invoicing } = useInvoicingModule();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="mt-2 space-y-2 text-xs text-ink-secondary">
      <p>O emitente é a Empresa (Empresa &amp; Estrutura → Empresa).</p>
      <Button
        type="button"
        size="sm"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setMessage(null);
          try {
            const r = await invoicing.syncIssuerFromCompany();
            if (r.status === "synced") await onDone();
            else if (r.status === "incomplete") setMessage(`Falta preencher na Empresa: ${r.missing.map((f) => COMPANY_FIELDS[f] ?? f).join(", ")}.`);
            else setMessage(`Não foi possível criar o emitente: ${r.message}`);
          } catch (e) {
            setMessage(errorText(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Usar os dados da Empresa
      </Button>
      {message && (
        <p role="alert" className="text-red-700">
          {message}{" "}
          <Link to="/empresa" className="underline">
            Abrir a Empresa
          </Link>
        </p>
      )}
    </div>
  );
}

/** Código de validação da AT para uma série (comunicada no Portal das Finanças até haver webservice). */
function ValidationCodeForm({ onSave }: { onSave: (code: string) => Promise<void> }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
          await onSave(code);
        } catch (err) {
          setError(errorText(err));
        } finally {
          setSaving(false);
        }
      }}
    >
      <input aria-label="Código de validação da AT" className={`${FIELD} w-36 uppercase`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex.: CDF7T5HD" />
      <Button type="submit" size="sm" disabled={code.trim().length < 8} loading={saving}>
        Registar
      </Button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </form>
  );
}

/** Séries: uma por tipo de documento e emitente; antes do certificado só de formação. */
export function SeriesView() {
  const { data: meta } = useInvoicingMeta();
  const { data: series, error, create, setValidationCode, reload } = useSeries();
  const { data: entities, error: entitiesError, loading: entitiesLoading, reload: reloadEntities } = useLegalEntities();
  const [form, setForm] = useState<{ legalEntityId: string; documentType: FiscalDocumentType; seriesId: string; mode: SeriesMode }>({
    legalEntityId: "",
    documentType: "FS",
    seriesId: "",
    mode: "training",
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <form
        className={`${SURFACE} grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5`}
        onSubmit={async (e) => {
          e.preventDefault();
          setCreating(true);
          setCreateError(null);
          try {
            await create({ ...form, seriesId: form.seriesId.trim() });
            setForm((f) => ({ ...f, seriesId: "" }));
          } catch (err) {
            setCreateError(errorText(err));
          } finally {
            setCreating(false);
          }
        }}
      >
        <label className="min-w-0 lg:col-span-2">
          <span className={LABEL}>Emitente</span>
          <select className={`${FIELD} w-full min-w-0`} value={form.legalEntityId} onChange={(e) => setForm({ ...form, legalEntityId: e.target.value })}>
            <option value="">Escolher…</option>
            {entities.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} ({x.taxId})
              </option>
            ))}
          </select>
        </label>
        {(entitiesError || (!entitiesLoading && entities.length === 0)) && (
          <div className="sm:col-span-2 lg:col-span-5">
            {entitiesError ? (
              <p role="alert" className="text-sm text-red-700">
                Não foi possível carregar os emitentes: {entitiesError}
              </p>
            ) : (
              <IssuerFromCompany onDone={reloadEntities} />
            )}
          </div>
        )}
        <label className="min-w-0">
          <span className={LABEL}>Tipo de documento</span>
          <select className={`${FIELD} w-full min-w-0`} value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value as FiscalDocumentType })}>
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className={LABEL}>Identificador da série</span>
          <input className={`${FIELD} w-full min-w-0`} value={form.seriesId} maxLength={35} onChange={(e) => setForm({ ...form, seriesId: e.target.value })} placeholder="Ex.: L01-2027" />
        </label>
        <label className="min-w-0">
          <span className={LABEL}>Modo</span>
          <select className={`${FIELD} w-full min-w-0`} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as SeriesMode })}>
            <option value="training">Formação</option>
            <option value="normal" disabled={!meta?.certified}>
              Normal{meta?.certified ? "" : " (só com certificado)"}
            </option>
          </select>
        </label>
        <div className="flex items-end lg:col-span-5">
          <Button type="submit" variant="primary" loading={creating} disabled={!form.legalEntityId || !form.seriesId.trim()}>
            Criar série
          </Button>
          {createError && <span className="ml-3 text-sm text-red-700">{createError}</span>}
        </div>
      </form>

      <p className="text-sm text-ink-secondary">
        {AT_WEBSERVICE_ENABLED
          ? "Depois de criar, registe a série na AT — aqui («Registar na AT», com o subutilizador WSE) ou no Portal das Finanças (Faturação › Séries), copiando o código de validação. Sem código, a série não emite."
          : "Depois de criar, comunique a série à AT no Portal das Finanças (Faturação › Séries) e registe aqui o código de validação. Sem código, a série não emite."}
      </p>

      {error && <AlertBanner tone="danger" title="Não foi possível carregar as séries">{error}</AlertBanner>}
      {series.length === 0 ? (
        <EmptyState title="Ainda não há séries" />
      ) : (
        <div className={`${SURFACE} overflow-x-auto`}>
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Tipo</th>
                <th className={TH}>Série</th>
                <th className={TH}>Modo</th>
                <th className={TH}>Código de validação (ATCUD)</th>
                <th className={TH}>Último n.º</th>
                {AT_WEBSERVICE_ENABLED && <th className={TH}>Na AT</th>}
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.ref} className={TR}>
                  <td className={TD}>{DOCUMENT_TYPE_LABELS[s.documentType]}</td>
                  <td className={`${TD} font-medium`}>{s.seriesId}</td>
                  <td className={TD}>{s.mode === "training" ? <StatusBadge tone="warning">Formação</StatusBadge> : <StatusBadge tone="success">Normal</StatusBadge>}</td>
                  <td className={TD}>{s.validationCode ?? <ValidationCodeForm onSave={(code) => setValidationCode(s.ref, code)} />}</td>
                  <td className={TD}>{s.lastSequence}</td>
                  {AT_WEBSERVICE_ENABLED && (
                    <td className={TD}>
                      {s.status === "finalized" ? (
                        <StatusBadge tone="neutral">Finalizada</StatusBadge>
                      ) : s.status === "cancelled" ? (
                        <StatusBadge tone="danger">Anulada</StatusBadge>
                      ) : (
                        <AtSeriesActions series={s} onDone={reload} />
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
