# Módulo: location-credentials

> Status: ativo
> Última atualização: 2026-09-04

## Propósito

Emparelha ecrãs sem operador (kiosk de check-in, `/fecho`, KDS) com uma Location,
substituindo o antigo `UNATTENDED_SCOPE` por um token de dispositivo por loja.
Cobre: geração/listagem/revogação de tokens (admin) e o formulário de resgate
de código que os três ecrãs partilham. NÃO é responsável por: aplicar a
autorização no servidor (isso é o backend, `requireDeviceAuth`), pela remoção
do `UNATTENDED_SCOPE` (ticket 06), nem por modelar uma entidade "Device" — o
domínio aqui só conhece o código de emparelhamento e o resumo de um token.

## Conceitos do domínio

- **PairingCode** — `{ code, expiresAt }`, TTL de 10 minutos. `remainingSeconds(now?)`
  e `isExpired(now?)` aceitam um `now` opcional (default `new Date()`) para
  serem determinísticos em teste.
- **DeviceTokenSummary** — `{ id, issuedAt }`, o que a UI de admin lista por loja.
  O token em si nunca é devolvido de novo depois de resgatado.
- **Erros de domínio do resgate** — `InvalidPairingCodeError` (400),
  `PairingCodeNotFoundError` (404), `PairingCodeAlreadyUsedError` (409),
  `PairingCodeExpiredError` (410). Mapeiam 1:1 para os status HTTP do backend.

## Ports

### Entrada (use cases)

- `GeneratePairingCodePort` — `execute(locationId): Promise<PairingCode>` — admin gera um código para uma loja.
- `ListActiveTokensPort` — `execute(locationId): Promise<DeviceTokenSummary[]>` — lista tokens ativos de uma loja.
- `RevokeTokenPort` — `execute(tokenId): Promise<void>` — revoga um token.
- `RedeemPairingCodePort` — `execute(code): Promise<void>` — troca um código por um token e persiste-o via `DeviceTokenStoragePort`; o token nunca é devolvido ao chamador.
- `GetPairingStatusPort` — `execute(): { paired: boolean }` — **síncrono**, ao contrário de todos os outros ports deste projeto. Só lê `localStorage`, sem latência de I/O; embrulhar em Promise só introduziria um flash de loading antes de um ecrã já emparelhado renderizar. Desvio deliberado e documentado.

### Saída (dependências do domínio)

- `LocationCredentialsApiPort` — `generatePairingCode`, `listTokens`, `revokeToken` (autenticados, admin) e `redeem` (público, dispositivo) no mesmo port — reaproveita o precedente de `HttpCashClosingApiAdapter` de misturar chamadas autenticadas e públicas num único adapter.
- `DeviceTokenStoragePort` — `getToken()/setToken()/clearToken()` — port de saída próprio, separado do port de API. O domínio/use cases não sabem se o token veio de `fetch` ou de `localStorage`, e os testes de use case ficam livres de DOM. Este é o primeiro módulo do frontend a persistir uma credencial do lado do cliente — precedente documentado aqui.

## Adapters

### Entrada (UI)

- `useDevicePairing` (hook, `use-device-pairing.ts`) — lê `getPairingStatus` uma vez ao montar e expõe `{ state: "checking" | "paired" | "unpaired", markPaired }`.
- `DevicePairingGate` — modelado em `ProtectedRoute.tsx`: `state === "checking"` não renderiza nada, `"unpaired"` mostra `PairingRedemptionForm`, `"paired"` renderiza `{children}`. Não desmonta/remonta os filhos entre re-renders.
- `PairingRedemptionForm` — exportado standalone para teste direto. Um único input de código; mapeia os 4 erros de domínio do resgate para mensagens em português; chama `onRedeemed()` no sucesso. Nunca mostra o token — o use case já o persiste internamente.
- `LocationCredentialsAdminView` — página `/admin/location-tokens`: `LocationSelect` (via `resolveLocationId`, não confia no timing do auto-select do picker) + botão gerar (mostra o código com contagem decrescente via um `useCountdown` local ao componente) + tabela de tokens (`useQuery`, lista vazia = "nenhum dispositivo emparelhado nesta loja", não é erro) + revogar por linha (`confirm()` nativo, invalida só a query key da loja atual).

### Saída

- `HttpLocationCredentialsApiAdapter` — implementa `LocationCredentialsApiPort` com `apiGet`/`apiPost`/`apiDeleteNoContent` (bearer automático) para as operações de admin e `deviceFetch` para `redeem` (sem bearer, dispositivo).
- `LocalStorageDeviceTokenAdapter` — implementa `DeviceTokenStoragePort` sobre `localStorage` (chave `angrybox.deviceToken`).
- `deviceFetch` (`adapters/out/device-fetch.ts`) — wrapper de `fetch` para rotas gated por device token: acrescenta o header `X-Device-Token`, e se a resposta for 401 com o corpo exato `{"error":"Invalid or missing device credentials"}`, limpa o token guardado e recarrega a página. É necessário fazer *match* na string exata — `verify-pin` e `kiosk/scan` também devolvem 401 para PIN errado (`InvalidPinError`), que NÃO deve limpar o emparelhamento. Fragilidade conhecida: não existe um código de erro dedicado no wire para desambiguar isto de forma mais robusta.
- `InMemoryLocationCredentialsApiAdapter` / `InMemoryDeviceTokenStorageAdapter` — fakes de teste (`withSeed`), como o `InMemoryTaskApiAdapter` do módulo `tasks`.

## Decisões de design (ADR resumido)

**Um único `LocationCredentialsApiPort` para admin + dispositivo.**
Mesmo precedente do `cash-closings`: em vez de dois ports de saída, um port
mistura chamadas autenticadas (bearer automático) e a chamada pública de
resgate. Mantém o módulo pequeno sem violar "sem fetch nos componentes".

**`DeviceTokenStoragePort` separado do port de API.**
O domínio não deve saber que um token de dispositivo é lido de `localStorage`.
Separar o port de armazenamento do port de API mantém os testes de use case
livres de DOM e deixa explícito que persistir uma credencial no cliente é uma
responsabilidade distinta de falar com o backend.

**`GetPairingStatusPort` é síncrono.**
Único port de entrada deste projeto que não devolve `Promise`. Só lê
`localStorage` (sem I/O), e devolvê-lo como Promise introduziria um flash de
loading desnecessário antes de um ecrã já emparelhado renderizar.

**Seam legado: ficheiros antigos importam funções simples do módulo.**
`cashClosingApi.ts`, `kdsApi.ts` e o `kioskScan` de `hrApi.ts` são módulos
não-componente que já chamam `fetch` diretamente, fora da DI de qualquer
módulo, anteriores a este ticket. Migrá-los para os use cases do módulo
implicaria mover `CashClosingPage`/`KdsPage`/`KioskCheckinPage` para o padrão
hexagonal — fora do âmbito (o README de `cash-closings` já documenta
`CashClosingPage` como legado pendente de migração). Estes ficheiros importam
diretamente as **funções simples exportadas** de
`local-storage-device-token.adapter.ts` (`deviceFetch`, `deviceTokenHeader`,
`getStoredDeviceToken`, `clearStoredDeviceToken`) — nunca o use case, nunca o
contexto React. Isto é uma exceção deliberada e temporária, não um padrão a
reutilizar noutro sítio.

**Token nunca re-exposto depois do resgate.**
`RedeemPairingCodeUseCase.execute()` devolve `Promise<void>`: o token
resolvido é persistido internamente via `DeviceTokenStoragePort.setToken()` e
nunca chega ao componente. Corresponde ao enquadramento do backend
("mostrado exatamente uma vez") — não existe nenhuma UI de "revelar token".

**`LocationCredentialsProvider` montado globalmente em `main.tsx`.**
É necessário em 3 rotas standalone (`/kiosk/checkin`, `/fecho`, `/kds`) mais
a página de admin — montar por rota (padrão do `cash-closings`) significaria
repetir o provider 3+ vezes. Ao contrário do `LocationsProvider`, não faz
gate em `useAuth()`: o resgate tem de funcionar sem utilizador autenticado, e
não há fetch-on-mount a controlar — é só instanciação eager dos use cases.

**Sem role-guard na rota `/admin/location-tokens`.**
Segue o precedente existente de `/admin/users`: o link de navegação é
escondido para não-admins (`nav-state.service.ts`), sem guarda a nível de
rota. A aplicação real da regra continua no backend
(`requireMinRole("admin")`).

## Como testar

```bash
npx vitest run src/modules/location-credentials
```

- Domínio/use cases: `pairing-code.test.ts`, `use-cases.test.ts` — puros, com
  os fakes `InMemoryLocationCredentialsApiAdapter`/`InMemoryDeviceTokenStorageAdapter`,
  sem rede nem DOM.
- UI/hooks: Testing Library, injetando um `LocationCredentialsModule` de teste
  via `LocationCredentialsProvider` (`PairingRedemptionForm.test.tsx`,
  `DevicePairingGate.test.tsx`, `LocationCredentialsAdminView.test.tsx`).

## Pontos de atenção / dívidas conhecidas

- O stream SSE do KDS (`EventSource`) não passa pelo `deviceFetch` — não pode
  enviar headers nem correr a lógica de revogação. Um token revogado que
  parta só o stream (e nenhuma outra chamada do KDS) não dispara o reload.
  Aceitável: as outras chamadas do KDS (`getDeliveries`, updates de status)
  passam por `deviceFetch` e apanham a revogação.
- O *string-match* exato em `DEVICE_AUTH_ERROR_MESSAGE` (`deviceFetch`) é
  frágil por natureza — não há código de erro dedicado no wire para
  distinguir "sem/token inválido/token revogado" de outros 401 nas mesmas
  rotas (ex.: PIN errado). Se o backend mudar essa mensagem, este handler
  para de funcionar silenciosamente.
- Os caminhos HTTP em `HttpLocationCredentialsApiAdapter` foram confirmados
  contra o controller real do backend
  (`location-credential.controller.ts`): `POST /api/location-credentials/pairing-codes`,
  `GET /api/location-credentials/locations/:locationId/tokens` (`locationId`
  é path param, não query param — `listTokens` usava `?locationId=` até esta
  correção), `DELETE /api/location-credentials/tokens/:tokenId` e
  `POST /api/location-credentials/redeem`.
- O port `CashClosingApiPort.api` (pass-through do módulo `cash-closings`)
  continua com `employeeId` no tipo `SubmitClosingParams` apesar de já não
  ter chamadores — dívida pré-existente, não tocada aqui, fora do âmbito
  deste ticket.
