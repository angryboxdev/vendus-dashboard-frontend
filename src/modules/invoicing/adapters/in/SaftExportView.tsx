import { useState } from "react";
import { AlertBanner, Button, FIELD, LABEL, SURFACE } from "../../../../components/ui/index.ts";
import { useInvoicingModule } from "../../invoicing.module.tsx";
import { useInvoicingMeta, useLegalEntities } from "./use-invoicing.ts";

/** Primeiro e último dia do mês anterior (AAAA-MM-DD), o período habitual da comunicação mensal. */
function previousMonth(today = new Date()): { from: string; to: string } {
  const first = new Date(Date.UTC(today.getFullYear(), today.getMonth() - 1, 1));
  const last = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

/** Exportar o ficheiro SAF-T (PT) 1.04_01 de um emitente e período. */
export function SaftExportView() {
  const { invoicing } = useInvoicingModule();
  const { data: meta } = useInvoicingMeta();
  const { data: entities } = useLegalEntities();
  const [legalEntityId, setLegalEntityId] = useState("");
  const [{ from, to }, setPeriod] = useState(previousMonth);
  // Por omissão: incluir formação só antes do certificado (até lá só há documentos de formação).
  const [trainingChoice, setTraining] = useState<boolean | null>(null);
  const training = trainingChoice ?? !meta?.certified;
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  return (
    <form
      className={`${SURFACE} space-y-4 p-4`}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setDone(false);
        try {
          const out = await invoicing.exportSaft({ legalEntityId, from, to, includeTraining: training });
          setErrors(out);
          setDone(out.length === 0);
        } catch (err) {
          setErrors([err instanceof Error ? err.message : "Erro ao exportar"]);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-sm text-ink-secondary">Ficheiro SAF-T (PT) 1.04_01 de faturação, para a AT (inspeção e comunicação) ou para o contabilista. Um só ano fiscal por ficheiro.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="lg:col-span-2">
          <span className={LABEL}>Emitente</span>
          <select className={FIELD} value={legalEntityId} onChange={(e) => setLegalEntityId(e.target.value)}>
            <option value="">Escolher…</option>
            {entities.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} ({x.taxId})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={LABEL}>De</span>
          <input type="date" className={FIELD} value={from} onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))} />
        </label>
        <label>
          <span className={LABEL}>Até</span>
          <input type="date" className={FIELD} value={to} onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={training} onChange={(e) => setTraining(e.target.checked)} />
        Incluir documentos de formação {meta && !meta.certified && <span className="text-ink-secondary">(antes do certificado só há formação)</span>}
      </label>
      {errors.length > 0 && (
        <AlertBanner tone="danger" title="Não foi possível exportar">
          <ul className="list-disc pl-5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </AlertBanner>
      )}
      {done && <AlertBanner tone="success" title="SAF-T descarregado" />}
      <Button type="submit" variant="primary" loading={busy}>
        Exportar SAF-T
      </Button>
    </form>
  );
}
