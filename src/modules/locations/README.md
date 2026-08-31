# Módulo: locations

> Status: ativo
> Última atualização: 2026-08-30 (`resolveLocationId` — ticket 17 do backend passou a exigir `location_id` nos movimentos de stock)

## Propósito

Carrega, uma vez por sessão, as locations (lojas/restaurantes) da organização
do utilizador autenticado, e expõe-as a qualquer ecrã de escrita que precise
de um seletor de loja (movimentos de stock, turnos, conferência de presença,
linhas de fatura). NÃO cria, edita nem desativa locations — isso é feito no
backend pelo script de provisioning. NÃO é responsável por filtrar leituras
(dashboards/relatórios) por loja — isso é uma feature futura fora deste
ticket.

## Conceitos do domínio

- **LocationDTO** — `id`, `name`, `code`, `timezone`, `isActive`. Sem
  invariantes: é um DTO só de leitura, tal como no backend
  (`src/modules/locations/domain/entities/location.ts`).

## Serviços de domínio

- `resolveLocationId(chosen, locations)` (`domain/services/resolve-location-id.ts`)
  — função pura que decide o valor efetivo a enviar num write: o escolhido
  explicitamente, senão a única location (implícito, D4), senão `null`. É a
  mesma regra que o `LocationSelect` usa para decidir se mostra o `<select>`,
  reaproveitada nos ecrãs onde a location passou a ser **obrigatória no
  backend** (stock, desde o ticket 17) — sem isto, um ecrã de loja única
  podia submeter antes do efeito de auto-preenchimento do `LocationSelect`
  ter corrido, e o pedido falhava com 400.

## Ports

### Entrada (use cases)

- `ListLocationsPort` — `execute(): Promise<LocationDTO[]>` — devolve as
  locations da organização do chamador.

### Saída (dependências do domínio)

- `LocationsApiPort` — `listLocations()` — contrato de acesso a dados.

## Adapters

### Entrada (UI)

- `useLocations()` (hook, `adapters/in/use-locations.ts`) — lê o estado
  partilhado carregado pelo `LocationsProvider`; expõe `locations`, `loading`,
  `error`, `hasMultipleLocations`, `reload`.
- `LocationSelect` (componente, `src/components/LocationSelect.tsx` — fora do
  módulo porque é consumido por ecrãs legados em `src/pages/**`, que não
  importam de `src/modules/**` por convenção) — picker reutilizável: não
  renderiza nada e auto-preenche o valor quando há 0 ou 1 location (D4 — zero
  cliques extra no caso da Angrybox); só mostra o `<select>` quando há mais
  de uma.

### Saída

- `HttpLocationsApiAdapter` → chama `GET /api/locations` via `apiGet`
  (`src/lib/api.ts`), que já trata o header de autenticação.

## Decisões de design (ADR resumido)

### Estado partilhado no `LocationsProvider`, não em cada `useLocations()`

O fetch acontece uma única vez dentro do `LocationsProvider` (gated por
`useAuth()` — só corre depois de autenticado) e é guardado em contexto.
`useLocations()` apenas lê esse contexto. Se cada chamada ao hook disparasse
o seu próprio pedido, um ecrã com vários pickers (ex.: fatura com várias
linhas) faria um `GET /api/locations` por linha.

### `LocationsProvider` montado ao lado do `AuthProvider`

Ticket 19 pede que as locations fiquem "na sessão, ao lado da organização".
Em vez de meter a chamada HTTP dentro do `AuthContext` (que hoje só decodifica
claims do JWT e não conhece `fetch`), o provider deste módulo é montado no
`main.tsx` logo a seguir ao `AuthProvider` — ao mesmo nível da árvore,
disponível a toda a app, sem misturar uma dependência de rede num contexto
que hoje é síncrono.

### `LocationSelect` fica fora de `src/modules/locations`

Os ecrãs que precisam do picker (stock, turnos, faturas) são legados ou vivem
noutro módulo; nenhum deles importa de dentro de `src/modules/locations`. O
componente vive em `src/components/`, ao lado de outros componentes
partilhados (`NumericInput`, `PageFooter`), e consome o hook do módulo.

### `resolveLocationId` em vez de confiar no efeito do `LocationSelect`

Ecrãs onde o backend agora rejeita a escrita sem `location_id` (stock,
ticket 17) chamam `resolveLocationId` explicitamente antes de montar o
payload, em vez de assumir que o estado local já foi auto-preenchido pelo
`LocationSelect`. O componente continua a fazer o auto-preenchimento — bom
para a UI parecer correta de imediato — mas a validação de submissão não
depende da ordem de efeitos do React.

### Sem `requireMinRole`/restrição de papel no front

Tal como o endpoint, o hook não filtra por papel — qualquer utilizador
autenticado pode ver as locations da sua organização.

## Como testar

```bash
npm test -- src/modules/locations
```

- `resolveLocationId` tem teste unitário puro (`resolve-location-id.test.ts`).
- O comportamento "some quando ≤ 1 location, aparece quando > 1" vive em
  `LocationSelect` e tem teste de UI com Testing Library
  (`src/components/LocationSelect.test.tsx`), plugando um `LocationsModule`
  fake no `LocationsProvider`.

## Pontos de atenção / dívidas conhecidas

- `isActive` já é filtrado no `LocationSelect` (lojas inativas não aparecem
  na lista), mas não há teste de UI cobrindo isso ainda.
- Location como filtro de leitura (selectores em relatórios/dashboards) está
  fora de scope deste ticket — ver ticket 19, secção "Not in scope".
