# Módulo: locations

> Status: ativo
> Última atualização: 2026-10-04 (gestão de Locais — Base Organizacional, ticket 02)

## Propósito

Carrega, uma vez por sessão, as locations (lojas/restaurantes/espaços) da
organização do utilizador autenticado, e expõe-as a qualquer ecrã de escrita
que precise de um seletor de loja (movimentos de stock, turnos, conferência
de presença, linhas de fatura). Desde a Base Organizacional também é dono da
aba **Empresa & Estrutura → Locais** (`/empresa/locais`): o admin cria,
edita e ativa/inativa Locais — **nunca apaga**. NÃO é responsável por
filtrar leituras (dashboards/relatórios) por loja.

## Conceitos do domínio

- **LocationDTO** — espelho do `LocationDto` do backend: `id`, `name`,
  `code` (opcional), `timezone`, `isActive`, `address`, `postalCode`,
  `city` (localidade), `municipality`, `country`, `phone`.
- **Local inativo** — continua em `locations` (os registos antigos
  precisam do nome), mas nunca conta para seletores nem para o local
  implícito.
- `LocationValidationError` — 400/409 do backend com erros por campo.

## Serviços de domínio

- `resolveLocationId(chosen, locations)` (`domain/services/resolve-location-id.ts`)
  — função pura que decide o valor efetivo a enviar num write: o escolhido
  explicitamente, senão o único local **ativo** (implícito, D4), senão
  `null`. É a mesma regra que o `LocationSelect` usa para decidir se mostra
  o `<select>`, reaproveitada nos ecrãs onde a location é **obrigatória no
  backend** (stock, desde o ticket 17).
- `location-form.service.ts` — `toLocationFormValues`, `toCreatePayload`
  (todos os campos), `toUpdatePayload` (só os alterados; opcional
  esvaziado → `null`), `sortLocationsForAdmin` (ativos primeiro),
  `locationHistoryLabel`.

## Ports

### Entrada (use cases)

- `ListLocationsPort` — locations da organização (ativas e inativas).
- `CreateLocationPort`, `UpdateLocationPort` (sem alterações não faz
  pedido), `SetLocationActivePort`, `ListLocationHistoryPort`.

### Saída (dependências do domínio)

- `LocationsApiPort` — `listLocations`, `createLocation`, `updateLocation`,
  `setLocationActive`, `listLocationHistory`.

## Adapters

### Entrada (UI)

- `useLocations()` (`adapters/in/use-locations.ts`) — lê o estado
  partilhado do `LocationsProvider`; expõe `locations` (todas),
  `activeLocations`, `hasMultipleLocations` (só ativas), `loading`,
  `error`, `reload`.
- `useManageLocations()` / `useLocationHistory()` — mutations/queries da
  gestão; cada escrita chama `reload()` para todos os seletores da app
  verem logo a mudança.
- `LocationsAdminView` + `LocationDrawer` — aba Locais: lista (inativos
  escondidos por defeito), criar/editar com erros por campo e histórico,
  inativar com confirmação. Só `admin` vê as ações.
- `LocationSelect` (`src/components/LocationSelect.tsx`) — picker
  reutilizável: não renderiza nada e auto-preenche o valor quando há 0 ou
  1 local ativo; só mostra o `<select>` (só ativos) quando há mais de um.

### Saída

- `HttpLocationsApiAdapter` → `/api/locations` (`GET`, `POST`,
  `PATCH /:id`, `PATCH /:id/active`, `GET /:id/history`) via
  `src/lib/api.ts`; traduz 400/409 com `fieldErrors` para
  `LocationValidationError`.
- `InMemoryLocationsApiAdapter` (+ `locationFixture`) → testes.

## Decisões de design (ADR resumido)

- **Zona de picagem (Portal do Colaborador, 2026-10-06)** — `GeofenceSection`
  no painel do Local (admin): coordenadas ("Usar a minha localização atual"
  via `ReadCurrentPositionPort` → `BrowserCurrentPositionAdapter`), raio e
  política Desativada / Registar e avisar / Bloquear fora da zona
  (`PATCH /api/locations/:id/geofence`). Uma política ativa exige
  coordenadas. `LocationDTO.geofence` é opcional no tipo (fixtures antigas).

### Estado partilhado no `LocationsProvider`, não em cada `useLocations()`

O fetch acontece uma única vez dentro do `LocationsProvider` (gated por
`useAuth()`) e é guardado em contexto. A gestão de Locais reutiliza esse
mesmo estado (e `reload()`), em vez de uma cache react-query paralela que
pudesse divergir dos seletores.

### `LocationsProvider` montado ao lado do `AuthProvider`

O provider é montado no `main.tsx` logo a seguir ao `AuthProvider`,
disponível a toda a app, sem misturar uma dependência de rede no
`AuthContext`.

### Só locais ativos contam para o local implícito e para os seletores

Com a gestão de Locais passou a ser possível ter 1 local ativo + N
inativos. `resolveLocationId`, `hasMultipleLocations` e o `LocationSelect`
consideram só os ativos — de outra forma uma organização com uma loja
fechada perderia o local implícito e as escritas de stock falhariam com 400.

### A aba Locais vive neste módulo, a moldura no `organization`

`/empresa/*` usa `CompanyStructureLayout` (módulo `organization`) com rotas
filhas; `LocationsAdminView` é só o conteúdo da aba e não importa nada de
outro módulo.

### `LocationSelect` fica fora de `src/modules/locations`

É consumido por ecrãs legados em `src/pages/**`; vive em
`src/components/` e consome o hook do módulo.

### Inativar, nunca apagar

Não existe ação de apagar (nem endpoint). A confirmação explica que o
histórico associado continua válido.

## Como testar

```bash
npx vitest run src/modules/locations src/components/LocationSelect.test.tsx
```

- `resolve-location-id.test.ts` e `location-form.service.test.ts` —
  unitários puros.
- `LocationsAdminView.test.tsx` — criar, código duplicado, inativar com
  confirmação, não-admin só leitura (in-memory adapter).
- `LocationSelect.test.tsx` — inclui o caso "1 ativo + 1 inativo" (sem
  picker).

## Pontos de atenção / dívidas conhecidas

- Location como filtro de leitura (relatórios/dashboards) continua fora de
  scope.
- Lista de países/fusos curta (PT/ES); o valor atual é sempre mostrado.
