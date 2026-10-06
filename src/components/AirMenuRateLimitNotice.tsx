/**
 * Aviso mostrado onde há dados do AirMenu: a API só aceita 1 pedido a cada
 * 2 segundos (o backend espaça os pedidos), por isso o carregamento é lento.
 */
export function AirMenuRateLimitNotice({ className = "" }: { className?: string }) {
  return (
    <p
      role="note"
      className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 ${className}`}
    >
      A API do AirMenu só permite 1 pedido a cada 2 segundos, por isso carregar estes dados pode
      demorar — cada pedido do período leva cerca de 2 segundos. Aguarde, sem fechar a página.
    </p>
  );
}
