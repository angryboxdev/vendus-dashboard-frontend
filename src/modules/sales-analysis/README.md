# Módulo: sales-analysis

> Status: ativo
> Última atualização: 2026-11-21 (fila da AirMenu)

## Propósito
Página «Análise de Vendas» (Operação → `/analise-vendas`): **quando** a loja
principal vende — por dia, hora, dia da semana e canal — com comparação com o
ano anterior (cartões) e o mês anterior (gráfico diário), mapa de calor,
destaques clicáveis com detalhe até à hora de um dia, e previsão do mês com IA.
Não emite documentos nem altera Vendus, Air Menu ou Resultados.

## Conceitos do domínio
- **Bloco** (`CompactBucket`) — vendas de um dia × hora (Lisboa) × canal: bruto
  com IVA (líquido de NC), líquido e n.º de vendas. Hora −1 = total do dia
  (ano anterior e mês anterior vêm assim).
- **Fonte** — Vendus (por defeito), AirMenu ou Ambas. A AirMenu só é buscada
  quando o utilizador clica «Buscar» num mês; os meses ficam numa fila (um de
  cada vez), cada mês é buscado uma semana de cada vez (1 pedido a cada 3 s) e
  os dias já guardados nunca voltam a ser pedidos (backend, ADR-0045). A página
  mostra «na fila» e «a buscar… X de Y dias».
- **Período** — Este mês (pré-selecionado), Mês anterior, Este ano, Personalizado; máx. 12 meses.
- **Horário de funcionamento** (fixo): abre 12h; fecha 22h30 (seg–qui, dom) ou
  23h30 (sex, sáb). Vendas fora do horário contam nos totais e são assinaladas;
  «horas sem vendas» só dentro do horário.
- `buildAnalysis` (domínio) calcula totais, dia mais forte/fraco (dias a zero
  contam), médias por dia da semana e por hora, hora de pico/fraca com n.º de
  vendas, mapa de calor, faixas sem vendas e canais (peso, hora de pico).

## Ports
### Entrada (use cases)
- `GetSalesAnalysisUseCase` — valida o período e pede os blocos.
- `FetchAirMenuMonthUseCase` — pede ao backend para buscar um mês à AirMenu.
- `GetSalesForecastUseCase` — previsão do mês corrente (`ready` ou `pending`).
### Saída (dependências do domínio)
- `SalesAnalysisApiPort` — `getAnalysis`, `fetchAirMenuMonth`, `getForecast`.

## Adapters
### Entrada (UI)
- `useSalesAnalysis` — filtros, carregamento, atualização automática a cada 5 s
  enquanto a Vendus enche a cache ou um mês da AirMenu está a ser buscado;
  previsão só no mês corrente.
- `SalesAnalysisView` — variante A do protótipo («Painel»): cartões, gráfico
  diário (barras clicáveis, n.º de vendas, linha do mês anterior, previsão
  tracejada), destaques, dia da semana, hora, mapa de calor, canais.
- `SalesAnalysisDetail` — painel lateral (dia, dia da semana, hora, célula,
  canal, previsão) com navegação e «Voltar».
### Saída
- `HttpSalesAnalysisApiAdapter` → `GET /api/sales-analysis`, `POST /api/sales-analysis/air-menu/fetch`, `GET /api/sales-analysis/forecast` (`lib/api`).

## Decisões de design (ADR resumido)
- Os cálculos fazem-se aqui (domínio puro) a partir dos blocos; o backend só
  guarda e fornece dados (ADR-0045 do backend). Assim o detalhe de qualquer
  dia/hora/canal abre sem novo pedido.
- Permissão `sales.analysis` (rota em `access-ui.service`): por omissão só Admin e Gerência (Manager).
- Cartões comparam com o mesmo período do ano anterior; a linha do gráfico
  diário é o mês anterior (pedido da gerência).
- A previsão diz sempre se é «IA» ou «estimativa» (regra simples quando a IA
  falha) e que não é um valor garantido.
- Protótipo descartável: ramo `prototype/analise-de-vendas` (variante A escolhida).

## Como testar
- Domínio/use cases e UI: `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=teste-ficticio npx vitest run src/modules/sales-analysis`.

## Pontos de atenção / dívidas conhecidas
- Horário de funcionamento fixo no domínio (sem ecrã de configuração).
- Só a loja principal (sem seletor de loja).
- Um período longo na primeira vez mostra «A preparar os dados» até a Vendus encher a cache.
