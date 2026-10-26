# Módulo: stock-demo

> Status: ativo
> Última atualização: 2026-10-26

## Propósito

Demonstração da Gestão de Stock (backend `stock-demo`, ADR-0041): botão **«Demonstração»** em Artigos e
ingredientes (só Admins) para escolher um de três cenários fictícios — Comida brasileira, Hamburgueria, Bar — e
faixa fixa no topo do Stock enquanto um cenário está ativo («Recomeçar demonstração», «Sair da demonstração»).
Independente da demonstração do RH (que não é tocada).

## Ports

### Saída

- `StockDemoApiPort` — `GET /api/stock-demo` (estado), `POST /api/stock-demo/:cenário` (criar),
  `POST /api/stock-demo/:cenário/reset` (recomeçar). Sempre na empresa real.
- `StockDemoModeStorePort` — cenário ativo neste navegador (localStorage com try/catch).

## Adapters

- Entrada: `StockDemoMenu` (em `StockPage`, cabeçalho de Artigos e ingredientes) e `StockDemoBanner` (em
  `StockLayout`).
- Saída: `HttpStockDemoApiAdapter`, `LocalStorageStockDemoModeStore`.

## Decisões de design

- **Cabeçalho `X-Stock-Demo` só nas páginas `/stock/*`** (`demo-mode.ts`), por um fornecedor adicional do cliente
  HTTP (`addRequestHeaderProvider`), sem tocar no do Novo RH (`setRequestHeaderProvider`).
- **O primeiro pedido de cada ecrã já sai certo**: o cenário vive num ref atualizado em `useLayoutEffect` do
  `StockDemoProvider`; todos os layout effects correm antes dos `useEffect` dos ecrãs filhos, onde estes pedem dados.
- **Trocar de cenário remonta a Gestão de Stock** (`StockLayout` usa `cenário:versão` como chave do `Outlet`), sem
  recarregar a página; «Recomeçar» incrementa a versão.
- Só Admins: para os restantes o cenário é sempre `null` (nem botão, nem cabeçalho), mesmo com um valor guardado.

## Como testar

`npx vitest run src/modules/stock-demo`
