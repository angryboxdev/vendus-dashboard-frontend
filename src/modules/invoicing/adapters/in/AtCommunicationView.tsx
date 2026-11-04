import { useState } from "react";
import { AlertBanner, Button, EmptyState, FIELD, LABEL, StatusBadge, SURFACE, TABLE, TD, TH, THEAD, TR } from "../../../../components/ui/index.ts";
import { EMPTY_AT_CREDENTIALS, type AtCredentialsInput, type CommunicateResult } from "../../domain/entities/invoicing.ts";
import { useInvoicingModule } from "../../invoicing.module.tsx";
import { AtCredentialsFields } from "./AtCredentialsFields.tsx";
import { useAtStatus, useLegalEntities } from "./use-invoicing.ts";

const errorText = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado");
const date = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("pt-PT") : "—");

function resultText(r: CommunicateResult): string {
  if (r.attempted === 0) return r.withoutCredentials > 0 ? `Nada enviado: ${r.withoutCredentials} documento(s) sem credenciais do emitente.` : "Nada por enviar agora.";
  return `${r.attempted} enviado(s): ${r.accepted} aceite(s), ${r.rejected} recusado(s), ${r.failed} por repetir.`;
}

/**
 * Comunicação dos documentos à AT (e-Fatura, webservice). Envio automático a
 * cada 10 min quando o servidor tem o certificado; aqui vê-se o que falta, o
 * prazo (dia 5 do mês seguinte) e as recusas, e gravam-se as credenciais WFA.
 */
export function AtCommunicationView() {
  const { invoicing } = useInvoicingModule();
  const { data: status, error, reload } = useAtStatus();
  const { data: entities } = useLegalEntities();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [legalEntityId, setLegalEntityId] = useState("");
  const [creds, setCreds] = useState<AtCredentialsInput>(EMPTY_AT_CREDENTIALS);
  const [credErrors, setCredErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const communicate = async (force: boolean) => {
    setSending(true);
    setSendError(null);
    setResult(null);
    try {
      setResult(resultText(await invoicing.communicateAt(force)));
      await reload();
    } catch (e) {
      setSendError(errorText(e));
    } finally {
      setSending(false);
    }
  };

  const entityName = (id: string) => entities.find((e) => e.id === id)?.name ?? id;
  const queue = status?.queue;

  return (
    <div className="space-y-4">
      {error && <AlertBanner tone="danger" title="Não foi possível carregar o estado da comunicação">{error}</AlertBanner>}
      {status && !status.configured && (
        <AlertBanner tone="warning" title="Comunicação à AT por configurar">
          Falta no servidor o certificado do produtor assinado pela AT e a chave pública do Sistema de Autenticação. Até lá, comunique pelo Portal das Finanças
          (e-Fatura) ou pelo ficheiro SAF-T.
        </AlertBanner>
      )}
      {status?.environment === "test" && (
        <p className="text-sm text-ink-secondary">Ambiente de testes da AT: os envios não contam como comunicação real.</p>
      )}
      {queue?.overdue && (
        <AlertBanner tone="danger" title="Prazo de comunicação ultrapassado">
          Há documentos de {date(queue.oldestPendingDate)} por comunicar; o prazo era {date(queue.deadline)}.
        </AlertBanner>
      )}
      {queue?.dueSoon && !queue.overdue && (
        <AlertBanner tone="warning" title="Prazo de comunicação a terminar">
          Comunique até {date(queue.deadline)} (dia 5 do mês seguinte ao da emissão).
        </AlertBanner>
      )}

      <section className={`${SURFACE} space-y-3 p-4`}>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-2xl font-semibold text-ink">{queue?.pending ?? "—"}</p>
            <p className="text-sm text-ink-secondary">por comunicar</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-ink">{queue?.blocked ?? "—"}</p>
            <p className="text-sm text-ink-secondary">recusados pela AT</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-ink">{date(queue?.deadline ?? null)}</p>
            <p className="text-sm text-ink-secondary">prazo do mais antigo</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="primary" loading={sending} disabled={!status?.configured} onClick={() => void communicate(false)}>
              Comunicar agora
            </Button>
            <Button loading={sending} disabled={!status?.configured || !queue?.blocked} onClick={() => void communicate(true)}>
              Repetir recusados
            </Button>
          </div>
        </div>
        {result && <p className="text-sm text-ink">{result}</p>}
        {sendError && <p className="text-sm text-red-700">{sendError}</p>}
      </section>

      {status && status.problems.length > 0 && (
        <div className={`${SURFACE} overflow-x-auto`}>
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Documento</th>
                <th className={TH}>Resposta da AT</th>
              </tr>
            </thead>
            <tbody>
              {status.problems.map((p) => (
                <tr key={p.documentId} className={TR}>
                  <td className={`${TD} font-medium`}>{p.documentNumber}</td>
                  <td className={TD}>
                    <StatusBadge tone="danger">{p.outcome === "auth" ? "Credenciais recusadas" : `Código ${p.code ?? "?"}`}</StatusBadge>{" "}
                    <span className="text-sm text-ink-secondary">{p.message}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className={`${SURFACE} space-y-3 p-4`}>
        <h2 className="text-base font-semibold text-ink">Credenciais de comunicação (WFA)</h2>
        <p className="text-sm text-ink-secondary">
          Subutilizador do NIF de cada emitente, criado no Portal das Finanças com a autorização «WFA – Comunicação de dados de faturas». A senha fica cifrada no
          servidor e nunca é mostrada.
        </p>
        {status && status.credentials.length === 0 ? (
          <EmptyState title="Nenhum emitente com credenciais" />
        ) : (
          <ul className="divide-y divide-line-subtle">
            {status?.credentials.map((c) => (
              <li key={c.legalEntityId} className="flex items-center gap-3 py-2 text-sm">
                <span className="font-medium text-ink">{entityName(c.legalEntityId)}</span>
                <span className="font-mono text-ink-secondary">{c.username}</span>
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={async () => {
                    await invoicing.removeAtCredentials(c.legalEntityId);
                    await reload();
                  }}
                >
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              const errors = await invoicing.saveAtCredentials(legalEntityId, creds);
              setCredErrors(errors);
              if (errors.length === 0) {
                setCreds(EMPTY_AT_CREDENTIALS);
                await reload();
              }
            } catch (err) {
              setCredErrors([errorText(err)]);
            } finally {
              setSaving(false);
            }
          }}
        >
          <label>
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
          <AtCredentialsFields value={creds} onChange={setCreds} />
          <div className="flex items-end">
            <Button type="submit" variant="primary" loading={saving}>
              Gravar credenciais
            </Button>
          </div>
          {credErrors.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-red-700 sm:col-span-2 lg:col-span-4">
              {credErrors.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </form>
      </section>
    </div>
  );
}
