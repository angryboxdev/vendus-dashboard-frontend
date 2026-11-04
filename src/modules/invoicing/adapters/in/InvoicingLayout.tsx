import { Outlet } from "react-router-dom";
import { AlertBanner, PageShell, TabNav } from "../../../../components/ui/index.ts";
import { useInvoicingMeta } from "./use-invoicing.ts";

const TABS = [
  { to: "/vendas/emitir", label: "Emitir documento" },
  { to: "/vendas/documentos", label: "Documentos" },
  { to: "/vendas/series", label: "Séries" },
  { to: "/vendas/saft", label: "SAF-T" },
];

/** Área «Vendas» — faturação certificada AT, em testes (isolada dos outros canais). */
export function InvoicingLayout() {
  const { data: meta, error } = useInvoicingMeta();
  return (
    <PageShell
      title="Vendas"
      description="Faturação certificada pela AT — documentos assinados, com ATCUD e código QR."
      tabs={<TabNav items={TABS} label="Vendas" />}
    >
      <div className="space-y-4 p-4 sm:p-6">
        {error && <AlertBanner tone="danger" title="Não foi possível carregar a configuração da faturação">{error}</AlertBanner>}
        {meta && !meta.certified && (
          <AlertBanner tone="warning" title="Programa ainda não certificado pela AT">
            Só se emitem documentos de formação, marcados «DOCUMENTO DE TESTE – SEM VALOR FISCAL». Não os entregue a clientes.
          </AlertBanner>
        )}
        {meta && !meta.signingAvailable && (
          <AlertBanner tone="danger" title="Emissão indisponível">
            A chave de assinatura não está configurada no servidor.
          </AlertBanner>
        )}
        <Outlet />
      </div>
    </PageShell>
  );
}
