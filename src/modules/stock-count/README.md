# Módulo: stock-count

> Status: ativo
> Última atualização: 2026-09-30 (Fase 1 — funcional simples, sem fidelidade a mockup)

## Propósito

Frontend do motor de "Contagem Física de Stock 2.0" (backend `stock-count`):
substitui o antigo botão "Atualizar stock" (lançamento manual de deltas às
cegas) por um fluxo com escopo definido, stock teórico materializado no
início, tentativas de contagem auditadas, comparação com tolerância
configurada, e ajuste real de stock só depois de um admin confirmar
explicitamente.

**Não é** uma reprodução pixel-perfect de um mockup — é deliberadamente
"funcional simples" (Fase 1), para já substituir "Atualizar stock" em
produção. Uma Fase 2 com fidelidade total ao mockup (unidades alternativas,
zonas como filtro de UI, swipe/carrossel na execução) fica para depois.

## Conceitos do domínio

- `StockCountSessionDTO` — uma sessão de contagem: `draft → counting →
  reviewing → ready → completed`, ou `cancelled` a qualquer momento
  não-terminal. Traz sempre `version` (optimistic lock).
- `StockCountLineDTO` — uma linha por item da sessão. `not_counted →
  counted/recount_required → resolved`. Cada linha guarda as suas
  `attempts[]` (tentativas de contagem, imutáveis).
- `blindCount` — quando `true`, a UI de execução ainda assim nunca mostra
  `finalSystemQuantity`/`finalVariance`/`variancePercent` (ver Decisões de
  design).
- Escopo (`categoryIds`/`itemIds`/`zoneIds`) — definido na criação; para
  tipo `general` o escopo vazio (`{}`) já significa "todos os itens
  elegíveis" (decisão do backend, `StartCountSessionUseCase` +
  `listEligibleForScope`).

## Ports

### Saída (dependências do domínio)

- `StockCountApiPort` — um método por rota do backend
  (`listSessions`/`getSession`/`createSession`/`startSession`/
  `submitCountAttempt`/`requestRecount`/`resolveCountLine`/
  `finishExecution`/`markSessionReady`/`confirmSession`/`cancelSession`/
  `addUnscopedItem`/`listZones`/`createZone`) e dois métodos auxiliares que
  reaproveitam endpoints já existentes do módulo de stock legado —
  `listStockItemOptions` (`/api/stock/items`) e `listStockCategoryOptions`
  (`/api/stock/categories`) — para o picker de escopo e para juntar
  nome/unidade a cada linha (o DTO da linha só traz `itemId`).

## Adapters

### Entrada (UI)

- `StockCountSessionsListView` — tabela simples (Nº/Data/Tipo/Escopo/
  Progresso/Estado/Ação) com filtros de estado, tipo e período, e botão
  "+ Nova contagem" que abre `NewCountSessionForm` num modal.
- `NewCountSessionForm` — formulário simples (não wizard): tipo, loja (via
  `LocationSelect`, auto-preenchida com 1 loja ativa), data operacional,
  e — só para `cyclical`/`spot` — checkboxes de categorias/itens. Cria a
  sessão e tenta iniciá-la de imediato; se o início falhar por sobreposição
  (400), mostra a mensagem e, só para admin, um campo de motivo + "Forçar
  início mesmo assim" (retry com `overrideOverlap`).
- `StockCountSessionDetailView` — router fino: `draft`/`counting` →
  `StockCountExecutionView`; `reviewing`/`ready`/`completed`/`cancelled` →
  `StockCountReviewView`.
- `StockCountExecutionView` — lista simples e sequencial (não
  swipe/carrossel) das linhas `not_counted`/`recount_required`: item + input
  de quantidade na unidade base do item. Captura `countStartedAt` no
  primeiro foco do input de cada linha (nunca no submit — é o que permite ao
  backend detetar "movimento durante a contagem"). Mostra progresso
  ("X de Y contados") e um botão "Terminar execução". Se a sessão ainda
  estiver `draft` (ex.: o `start` da criação falhou por sobreposição),
  mostra um "gate" com botão "Iniciar contagem" (com a mesma lógica de
  override para admin).
- `StockCountReviewView` — tabela de conferência com todas as linhas
  (item/teórico/contado/diferença/diferença %/impacto/tolerância/situação
  derivada/estado/ação), filtros (Todos/Com divergência/Fora da
  tolerância/Recontagem necessária), ação "Pedir recontagem" (linhas
  `counted`) ou "Resolver" (linhas `recount_required` — escolher tentativa,
  ou, só admin, definir valor manual com motivo obrigatório), botão "Marcar
  como pronta" e, só admin e só com `status === "ready"`, "Confirmar
  contagem e ajustar stock" com um resumo compacto antes de confirmar.

### Saída

- `HttpStockCountApiAdapter` → implementa `StockCountApiPort` via
  `apiGet`/`apiPost` (`src/lib/api.ts`), incluindo a tradução do formato
  `snake_case` legado de `/api/stock/items` e `/api/stock/categories`.

## Decisões de design

- **Conflito de versão (409 `{ error, currentVersion }`)**: qualquer
  mutação que receba este erro mostra um aviso "alterado por outra pessoa"
  e invalida a query da sessão, em vez de tentar resolver o conflito no
  cliente — mesmo padrão já usado em `stock-purchase-review`.
- **Papel do utilizador**: reaproveita `useAuth().user.role === "admin"`
  (`src/contexts/AuthContext.tsx`), o mesmo mecanismo já usado pela sidebar
  e por `nav-state.service.ts` — nenhum mecanismo de auth novo.
- **`StockCountExecutionView` nunca mostra stock teórico/variância**,
  independentemente de `blindCount`: só item, unidade, input de quantidade e
  progresso. Isto é mais restritivo do que só esconder quando
  `blindCount === true` (a API devolve esses campos sempre), mas é
  deliberado — a vista de execução não é o lugar de julgar divergências,
  isso é sempre responsabilidade da Conferência. Esconder é responsabilidade
  só do frontend nesta fase (o backend não tem ainda um DTO de execução sem
  esses campos) — uma implementação rigorosa exigiria um DTO dedicado que
  nunca os devolvesse.
- **"Situação" (dentro/fora da tolerância) na Conferência é só de exibição**:
  o backend já decidiu `recount_required` do lado do servidor; o frontend
  recalcula a mesma fórmula (`variance.service.ts` do backend, replicada em
  `toleranceVerdict()`) só para dar um badge visual mais rico — nunca é usada
  para gate de nenhuma ação.
- **`NewCountSessionForm` cria e tenta iniciar a sessão no mesmo submit** —
  se o `start` falhar (ex.: sobreposição), a sessão já existe como
  rascunho; a UI não navega e mostra o erro inline, mas a sessão órfã fica
  visível na lista (estado `draft`, progresso "—") e pode ser retomada
  abrindo-a (`StockCountExecutionView` mostra o mesmo "gate" de início).
  Não há ação de cancelar sessão na Fase 1 (ver Pontos de atenção).

## Como testar

- Não há testes automatizados dedicados nesta Fase 1 (módulo novo, sem
  lógica de domínio pura além de mapeamento de DTOs e do `toleranceVerdict`
  de exibição) — validação feita via `npx tsc --noEmit`, `eslint` e
  `vite build`. Uma Fase 2 com lógica de domínio mais rica deve trazer
  testes unitários equivalentes.

## Pontos de atenção / dívidas conhecidas

- **Sem unidades alternativas** — `/api/stock/items` (legado) não expõe
  `stock_item_count_units`; a execução só aceita quantidade na unidade base
  do item. Fica para Fase 2 se o negócio precisar de contar em "saco",
  "caixa", etc.
- **Sem filtro `stock_tracking_enabled`** — o endpoint legado
  `/api/stock/items` não tem esse campo; o picker de escopo filtra só por
  `is_active`.
- **Sem UI de zonas** — `listZones`/`createZone` estão implementados no
  port/adapter (paridade com o contrato do backend), mas não há nenhuma
  vista que os use nesta fase (`zoneIds` do escopo é só informativo também
  do lado do backend, ver README do módulo backend).
- **Sem UI para "item não previsto"** (`addUnscopedItem`) — o método existe
  no port/adapter, mas não há botão nas vistas de execução/conferência que o
  invoque.
- **Sem UI de cancelamento de sessão** — `cancelSession` existe no
  port/adapter mas não é exposto em nenhuma vista; uma sessão `draft`
  órfã (`start` falhado) só pode ser retomada, nunca cancelada, a partir da
  UI desta fase.
- **`blindCount` só é escondido no frontend** — ver Decisões de design; a
  API continua a devolver os campos teóricos mesmo com `blindCount: true`.
