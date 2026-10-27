import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useInvoicesModule } from "../../invoices.module.tsx";
import { useAuth } from "../../../../contexts/AuthContext";
import { hasLevel } from "../../../access/domain/services/access-ui.service.ts";
import { formatIsoDatePt } from "../../../../lib/format.ts";
import { AlertBanner, AppIcon, Button, Dialog, FIELD, IconCopy, IconCheck, IconInbox, LABEL, SegmentedControl, Skeleton, StatusBadge } from "../../../../components/ui/index.ts";
import type { EmailIntakeDTO, EmailIntakeDestination } from "../../domain/entities/email-intake.ts";
import { emailIntakeStatus } from "../../domain/services/email-intake.ts";

const QUERY_KEY = ["invoices", "email-intake"];

/** Pode alterar: Admin ou «Faturas» com gestão. */
function useCanManage(): boolean {
  const { user } = useAuth();
  const access = user?.access;
  return !!access && !access.portalOnly && (access.isAdmin || hasLevel(access.permissions, "finance.invoices", "MANAGE"));
}

/**
 * «Faturas por email»: endereço da empresa (copiar / gerar novo), destino, como partilhar com os fornecedores e
 * o que chegou nos últimos 30 dias. A chave, o webhook e o segredo da Resend nunca aparecem aqui (são do servidor).
 */
export function EmailIntakePanel() {
  const { api } = useInvoicesModule();
  const qc = useQueryClient();
  const canManage = useCanManage();
  const { data, isLoading, error } = useQuery({ queryKey: QUERY_KEY, queryFn: () => api.getEmailIntake(), refetchInterval: 30_000 });
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [reason, setReason] = useState("");
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const rotate = useMutation({
    mutationFn: (r: string | null) => api.generateEmailIntakeAddress(r),
    onSuccess: (created) => {
      setConfirmRotate(false);
      setReason("");
      setNotice({ tone: "success", text: `Novo endereço ativo: ${created.email}. Envie-o aos fornecedores.` });
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => setNotice({ tone: "danger", text: e.message }),
  });
  const destination = useMutation({
    mutationFn: (d: EmailIntakeDestination) => api.setEmailIntakeDestination(d),
    onSuccess: () => void qc.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (e: Error) => setNotice({ tone: "danger", text: e.message }),
  });

  async function copy(email: string) {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice({ tone: "danger", text: "Não foi possível copiar — selecione o endereço e copie à mão." });
    }
  }

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-24" /></div>;
  if (error || !data) return <AlertBanner tone="danger" title="Não foi possível carregar as faturas por email.">{error instanceof Error ? error.message : null}</AlertBanner>;

  return (
    <div className="space-y-6">
      {notice && <AlertBanner tone={notice.tone} title={notice.text} />}
      <AddressBlock data={data} canManage={canManage} copied={copied} onCopy={copy} onRotate={() => setConfirmRotate(true)} onActivate={() => rotate.mutate(null)} activating={rotate.isPending} />

      {data.address && (
        <>
          <section>
            <p className={LABEL}>As faturas recebidas entram em</p>
            {canManage ? (
              <SegmentedControl
                label="Destino das faturas recebidas"
                size="sm"
                value={data.destination}
                onChange={(d) => destination.mutate(d)}
                items={[
                  { key: "finance", label: "Faturas (Financeiro)" },
                  { key: "stock", label: "Stock — Compras por rever" },
                ]}
              />
            ) : (
              <p className="text-sm font-medium text-navy-900">{data.destination === "stock" ? "Stock — Compras por rever" : "Faturas (Financeiro)"}</p>
            )}
            <p className="mt-1.5 text-xs text-ink-secondary">
              {data.destination === "stock"
                ? "Para empresas que só usam o Stock: cada fatura aparece em Stock → Compras por rever."
                : "Cada fatura aparece em Faturas → «Por rever». Depois de aprovada, vai para o Stock pela regra do fornecedor."}{" "}
              Receber nunca confirma, paga nem mexe no stock.
            </p>
          </section>

          <section className="space-y-2 text-sm text-ink-secondary">
            <p className="font-semibold text-navy-900">Como usar</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Envie este endereço aos fornecedores e peça-lhes que mandem as faturas em <strong>PDF</strong> para ele.</li>
              <li>Recebeu uma fatura no seu email? Use <strong>Reencaminhar</strong> (Gmail ou Outlook) para este endereço.</li>
              <li>
                Reencaminhamento automático: no Outlook, uma regra «Reencaminhar para» funciona. No Gmail, o reencaminhamento automático pede um código de
                confirmação enviado para este endereço, que o Mezza não mostra — por agora, reencaminhe à mão.
              </li>
              <li>Só se importam PDFs (até 10 por email, 20 MB cada). Fotografias e imagens são ignoradas.</li>
            </ul>
          </section>

          <ActivityBlock data={data} />

          {data.previousAddresses.length > 0 && (
            <details className="text-xs text-ink-muted">
              <summary className="cursor-pointer select-none font-medium">Endereços anteriores (já não aceites)</summary>
              <ul className="mt-2 space-y-1">
                {data.previousAddresses.map((a) => (
                  <li key={a.email} className="font-mono">
                    {a.email} <span className="font-sans">— desativado {a.deactivatedAt ? formatIsoDatePt(a.deactivatedAt.slice(0, 10)) : ""}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <Dialog
        open={confirmRotate}
        title="Gerar um endereço novo?"
        description={
          <div className="space-y-3">
            <p>
              O endereço atual <strong>deixa de funcionar no Mezza</strong>: os emails enviados para ele a partir de agora não são importados. Os fornecedores
              têm de receber o endereço novo. As faturas já recebidas ficam como estão.
            </p>
            <label className="block">
              <span className={LABEL}>Motivo (opcional)</span>
              <input className={`${FIELD} w-full`} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: o endereço foi partilhado por engano" />
            </label>
          </div>
        }
        onClose={() => !rotate.isPending && setConfirmRotate(false)}
        actions={
          <>
            <Button onClick={() => setConfirmRotate(false)} disabled={rotate.isPending}>Cancelar</Button>
            <Button variant="danger" loading={rotate.isPending} onClick={() => rotate.mutate(reason.trim() || null)}>Gerar novo endereço</Button>
          </>
        }
      />
    </div>
  );
}

function AddressBlock({
  data,
  canManage,
  copied,
  onCopy,
  onRotate,
  onActivate,
  activating,
}: {
  data: EmailIntakeDTO;
  canManage: boolean;
  copied: boolean;
  onCopy: (email: string) => void;
  onRotate: () => void;
  onActivate: () => void;
  activating: boolean;
}) {
  if (!data.configured) {
    return (
      <AlertBanner tone="warning" title="As faturas por email ainda não estão ligadas.">
        A receção de emails tem de ser configurada pela equipa técnica do Mezza.
      </AlertBanner>
    );
  }
  if (!data.allowed) {
    return <AlertBanner tone="info" title="As faturas por email ainda não estão disponíveis para esta empresa." />;
  }
  if (!data.address) {
    return (
      <div className="rounded-xl border border-dashed border-line px-5 py-6 text-center">
        <IconInbox className="mx-auto mb-2 h-6 w-6 text-ink-muted" />
        <p className="text-sm font-semibold text-navy-900">Receba as faturas dos fornecedores diretamente no Mezza</p>
        <p className="mt-1 text-xs text-ink-secondary">Gera-se um endereço exclusivo desta empresa; as faturas enviadas para ele entram para rever.</p>
        {canManage ? (
          <Button className="mt-4" variant="primary" loading={activating} onClick={onActivate}>Ativar endereço</Button>
        ) : (
          <p className="mt-3 text-xs text-ink-muted">Peça a quem gere as Faturas para o ativar.</p>
        )}
      </div>
    );
  }
  return (
    <section>
      <p className={LABEL}>Endereço desta empresa</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-surface-soft px-3 py-2 font-mono text-sm text-navy-900" title={data.address.email}>
          {data.address.email}
        </code>
        <Button size="sm" icon={copied ? <IconCheck className="h-4 w-4" /> : <IconCopy className="h-4 w-4" />} onClick={() => onCopy(data.address!.email)}>
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <span>Ativo desde {formatIsoDatePt(data.address.createdAt.slice(0, 10))}</span>
        {canManage && (
          <button type="button" onClick={onRotate} className="font-medium text-ink-secondary underline-offset-2 hover:text-navy-900 hover:underline">
            Gerar novo endereço
          </button>
        )}
      </div>
    </section>
  );
}

/** Link para a própria fatura (`?open=` abre exatamente essa; rascunho → revisão) — ou o aviso de eliminada. */
function invoiceLink(invoiceId: string): string {
  return `/financial/invoices?open=${encodeURIComponent(invoiceId)}`;
}

function ActivityBlock({ data }: { data: EmailIntakeDTO }) {
  const c = data.counts;
  const stats: [string, number][] = [
    ["Por rever", c.imported],
    ["Duplicadas", c.duplicate],
    ["Rejeitadas", c.rejected],
    ["Com erro", c.failed],
    ["Em fila", c.pending],
    ["Emails sem PDF", c.emailsWithoutPdf],
  ];
  return (
    <section>
      <p className="mb-2 text-sm font-semibold text-navy-900">Últimos 30 dias</p>
      <div className="grid grid-cols-3 gap-2">
        {stats.map(([label, n]) => (
          <div key={label} className="rounded-lg bg-surface-soft px-3 py-2">
            <p className="text-lg font-semibold tabular-nums text-navy-900">{n}</p>
            <p className="text-[11px] text-ink-muted">{label}</p>
          </div>
        ))}
      </div>
      {data.recent.length === 0 ? (
        <p className="mt-3 text-xs text-ink-muted">Ainda não chegou nenhuma fatura por email.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
          {data.recent.map((a) => {
            const s = emailIntakeStatus(a);
            return (
              <li key={a.id} className="flex items-start gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy-900" title={a.filename}>{a.filename}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {formatIsoDatePt(a.receivedAt.slice(0, 10))}
                    {a.sender ? ` · ${a.sender}` : ""}
                  </p>
                  {a.message && a.status !== "imported" && <p className="mt-0.5 text-xs text-ink-secondary">{a.message}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                  {a.invoiceId &&
                    (a.invoiceDeleted ? (
                      <span className="inline-flex items-center gap-1 text-xs text-ink-muted" title="Esta fatura foi eliminada no Mezza.">
                        <AppIcon name="lock" size={12} aria-hidden="true" />
                        Fatura eliminada
                      </span>
                    ) : (
                      <Link to={invoiceLink(a.invoiceId)} className="text-xs font-medium text-ink-secondary hover:text-navy-900 hover:underline">
                        Abrir fatura
                      </Link>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
