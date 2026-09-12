# Módulo: location-credentials

> Status: ativo
> Última atualização: 2026-09-12

## Propósito

Emparelha ecrãs sem operador (kiosk de check-in, `/fecho`, KDS) com uma Location,
substituindo o antigo `UNATTENDED_SCOPE` por um token de dispositivo por loja.
Cobre: geração/listagem/revogação de tokens (admin) e o formulário de resgate
de código que os três ecrãs partilham. NÃO é responsável por: aplicar a
autorização no servidor (isso é o backend, `requireDeviceAuth`), pela remoção
do `UNATTENDED_SCOPE` (ticket 06), nem por modelar uma entidade "Device" — o
domínio aqui só conhece o código de emparelhamento e o resumo de um token.

## Conceitos do domínio

- **PairingCode** — `{ code, expiresAt, description }`, TTL de 10 minutos.
  `remainingSeconds(now?)` e `isExpired(now?)` aceitam um `now` opcional
  (default `new Date()`) para serem determinísticos em teste. `description`
  (`string | null`) é opcional, definida uma única vez na geração do código
  (ticket 07) — não existe endpoint para editá-la depois.
- **DeviceTokenSummary** — `{ id, issuedAt, locationName, description }`, o que
  a UI de admin lista por loja. `locationName` vem do backend (ticket 05) e é
  só exibido — não é usado para nenhuma decisão do domínio, já que a lista já
  está filtrada por `locationId`. `description` (ticket 07) acompanha o token
  gerado a partir do código correspondente; tokens já emparelhados antes do
  ticket 07 vêm com `description: null`. O token em si nunca é devolvido de
  novo depois de resgatado.
- **Erros de domínio do resgate** — `InvalidPairingCodeError` (400),
  `PairingCodeNotFoundError` (404), `PairingCodeAlreadyUsedError` (409),
  `PairingCodeExpiredError` (410). Mapeiam 1:1 para os status HTTP do backend.

## Ports

### Entrada (use cases)

- `GeneratePairingCodePort` — `execute(locationId, description?): Promise<PairingCode>` — admin gera um código para uma loja, com uma descrição opcional (ticket 07).
- `ListActiveTokensPort` — `execute(locationId): Promise<DeviceTokenSummary[]>` — lista tokens ativos de uma loja.
- `RevokeTokenPort` — `execute(tokenId): Promise<void>` — revoga um token.
- `RedeemPairingCodePort` — `execute(code): Promise<void>` — troca um código por um token e persiste-o via `DeviceTokenStoragePort`; o token nunca é devolvido ao chamador.
- `GetPairingStatusPort` — `execute(): Promise<{ paired: boolean }>` — assíncrono. Chama sempre `LocationCredentialsApiPort.checkToken()`, com ou sem token local (ver ADR "Sem token local também chama o servidor" abaixo — supersede a versão anterior deste ticket, que tinha um atalho local). Se o servidor confirmar o token válido, reporta `paired: true`; se disser que é inválido/ausente, limpa-o do `DeviceTokenStoragePort` (no-op sem token local) e reporta `paired: false`. Ver também o ADR "`GetPairingStatusPort` é assíncrono" abaixo — supersede a decisão anterior de ser síncrono.

### Saída (dependências do domínio)

- `LocationCredentialsApiPort` — `generatePairingCode(locationId, description?)`, `listTokens`, `revokeToken` (autenticados, admin), `redeem` (público, dispositivo) e `checkToken(): Promise<boolean>` (dispositivo, revalida o token guardado contra `GET /api/location-credentials/tokens/me`) no mesmo port — reaproveita o precedente de `HttpCashClosingApiAdapter` de misturar chamadas autenticadas e públicas num único adapter.
- `DeviceTokenStoragePort` — `getToken()/setToken()/clearToken()` — port de saída próprio, separado do port de API. O domínio/use cases não sabem se o token veio de `fetch` ou de `localStorage`, e os testes de use case ficam livres de DOM. Este é o primeiro módulo do frontend a persistir uma credencial do lado do cliente — precedente documentado aqui.

## Adapters

### Entrada (UI)

- `useDevicePairing` (hook, `use-device-pairing.ts`) — chama `getPairingStatus.execute()` uma vez ao montar (agora assíncrono, ver ADR) e expõe `{ state: "checking" | "paired" | "unpaired", markPaired }`. `state` começa em `"checking"` até a promise resolver.
- `DevicePairingGate` — modelado em `ProtectedRoute.tsx`: `state === "checking"` não renderiza nada, `"unpaired"` mostra `PairingRedemptionForm`, `"paired"` renderiza `{children}`. Não desmonta/remonta os filhos entre re-renders.
- `PairingRedemptionForm` — exportado standalone para teste direto. Um único input de código; mapeia os 4 erros de domínio do resgate para mensagens em português; chama `onRedeemed()` no sucesso. Nunca mostra o token — o use case já o persiste internamente.
- `LocationCredentialsAdminView` — página `/admin/location-tokens`: `LocationSelect` (via `resolveLocationId`, não confia no timing do auto-select do picker) + input opcional "Descrição" (`maxLength=100`, placeholder "Ex.: Monitor da cozinha", ticket 07) + botão gerar (mostra o código em blocos por caractere, com um `<span>` `sr-only` do código completo para leitores de ecrã, botão "Copiar" via `navigator.clipboard`, contagem decrescente com `useCountdown` local ao componente, e a opção de gerar um novo código mesmo antes de expirar o atual) + tabela de tokens (`useQuery`, lista vazia = "nenhum dispositivo emparelhado nesta loja", não é erro; IDs longos são truncados no meio via `fmtDeviceId`, com o valor completo no `title`; coluna "Loja" mostra `locationName` tal como devolvido pelo backend, sem formatação; coluna "Descrição" mostra `t.description` ou "—" quando `null`) + revogar por linha (`confirm()` nativo, invalida só a query key da loja atual).

### Saída

- `HttpLocationCredentialsApiAdapter` — implementa `LocationCredentialsApiPort` com `apiGet`/`apiPost`/`apiDeleteNoContent` (bearer automático) para as operações de admin e `deviceFetch` para `redeem` e `checkToken` (`GET /api/location-credentials/tokens/me`, sem bearer, dispositivo). `checkToken()` resolve `true` num 200; num 401 resolve `false` — o único status em que `requireDeviceAuth` confirma o token como ausente/desconhecido/revogado; qualquer outro status resolvido (500 de um erro genuíno de lookup, 502/503 de um proxy durante um restart de deploy, etc.) faz `checkToken()` **lançar** em vez de resolver `false` — quem reage é só `GetPairingStatusUseCase`, que já tinha o `catch` certo para isto (ver ADR abaixo). `generatePairingCode` só inclui `description` no corpo do POST quando definida (ticket 07); `PairingCodeDto`/`DeviceTokenSummaryDto` incluem `description: string | null`.
- `LocalStorageDeviceTokenAdapter` — implementa `DeviceTokenStoragePort` sobre `localStorage` (chave `angrybox.deviceToken`).
- `deviceFetch` (`adapters/out/device-fetch.ts`) — wrapper de `fetch` para rotas gated por device token: só acrescenta o header `X-Device-Token`. Não inspeciona a resposta nem reage a 401 (ver ADR "`deviceFetch` não limpa nem recarrega em 401" abaixo) — devolve a `Response` tal como veio, e quem chama decide o que fazer com um `!res.ok`.
- `InMemoryLocationCredentialsApiAdapter` / `InMemoryDeviceTokenStorageAdapter` — fakes de teste (`withSeed`), como o `InMemoryTaskApiAdapter` do módulo `tasks`.

## Decisões de design (ADR resumido)

**Descrição opcional na geração de código (ticket 07) — trim no FE, regenerar reaproveita o valor.**
`GeneratePairingCodeUseCase.execute()` faz `trim()` na descrição e trata uma
string em branco como omitida (`undefined`), espelhando a semântica do
backend ("omitido → `null`") sem duplicar a validação estrita (1–100
carateres, rejeição de whitespace) — essa continua a ser só do backend; o FE
só evita o caso óbvio de mandar espaços. Não existe endpoint de
atualização/rename: a descrição é *write-once*, por isso não há UI de editar
depois de emparelhado. Em `LocationCredentialsAdminView`, o estado
`description` é local ao componente e não é limpo entre gerações — "Gerar
novo código" (regenerar antes de expirar, ou depois de expirado) reaproveita
o mesmo texto do input em vez de o limpar, pela estrutura já existente
(um único estado, sem distinguir "gerar" de "regenerar"); se o utilizador
quiser uma descrição diferente no novo código, edita o campo antes de
regenerar.

**Um único `LocationCredentialsApiPort` para admin + dispositivo.**
Mesmo precedente do `cash-closings`: em vez de dois ports de saída, um port
mistura chamadas autenticadas (bearer automático) e a chamada pública de
resgate. Mantém o módulo pequeno sem violar "sem fetch nos componentes".

**`DeviceTokenStoragePort` separado do port de API.**
O domínio não deve saber que um token de dispositivo é lido de `localStorage`.
Separar o port de armazenamento do port de API mantém os testes de use case
livres de DOM e deixa explícito que persistir uma credencial no cliente é uma
responsabilidade distinta de falar com o backend.

**`GetPairingStatusPort` é assíncrono — supersede a decisão anterior de ser síncrono.**
A versão original deste port só lia `localStorage` e nunca revalidava o
token contra o servidor: um token revogado no admin continuava a passar em
ecrãs sem operador (`/fecho`, `/kiosk`) até que outra chamada qualquer (ex.:
`/kds`) apanhasse um 401 e limpasse o `localStorage` por efeito colateral.
"Presença no `localStorage`" e "token ainda válido" são coisas diferentes, e
só o servidor sabe a segunda. Agora, com token local, `GetPairingStatusUseCase`
chama `LocationCredentialsApiPort.checkToken()` (backend:
`GET /api/location-credentials/tokens/me`, atrás de `requireDeviceAuth`)
antes de reportar `paired: true`; sem token local continua sem tocar a rede
— nada disto contradiz a razão original (evitar loading desnecessário num
ecrã já emparelhado), só que "já emparelhado" deixou de poder ser decidido
só localmente.

Fluxo de `GetPairingStatusUseCase.execute()`:
- Chama sempre `checkToken()`, com ou sem token local (ver ADR "Sem token
  local também chama o servidor" abaixo).
- `checkToken()` resolve `true` (200) → `{ paired: true }`.
- `checkToken()` resolve `false` (401) → limpa o token via
  `DeviceTokenStoragePort.clearToken()` (no-op se não havia token local) e
  devolve `{ paired: false }`. Este é o **único** lugar do módulo que limpa
  o token guardado — ver ADR abaixo sobre por que `deviceFetch` deixou de o
  fazer.
- `checkToken()` rejeita (erro de rede, ex. offline, **ou** um status
  resolvido que não é 200 nem 401 — 500 de um erro genuíno de lookup no
  backend, 502/503 de um proxy a meio de um restart de deploy;
  `HttpLocationCredentialsApiAdapter.checkToken()` lança nesses casos em vez
  de resolver `false`, exatamente para cair neste mesmo ramo) →
  **fail-open**: devolve `{ paired: true }` sem tocar no token guardado.
  Decisão deliberada: um kiosk offline (ou a meio de um soluço passageiro do
  backend) com um token que já foi válido não deve ficar bloqueado no
  formulário de resgate (que também precisa de rede) só por não conseguir
  confirmar o servidor agora — isso trocaria um bug raro (token revogado a
  passar por segundos/minutos) por um pior e mais frequente (ecrã de loja
  preso fora do ar em qualquer soluço de rede ou reinício de deploy). Um
  token realmente revogado (401) continua a ser apanhado na próxima vez que
  `GetPairingStatusUseCase.execute()` correr (tipicamente, o próximo mount de
  `DevicePairingGate` — recarregar a página, ou navegar de novo para o ecrã).
  Sem token local, este mesmo ramo fail-open aplica-se a um erro de rede ou
  status transitório — efeito aceite, ver ADR abaixo.

**`deviceFetch` não limpa nem recarrega em 401 — reverte a versão anterior.**
Antes, `deviceFetch` reagia a qualquer 401 cujo corpo desse *match* exato com
a mensagem de falha de auth de dispositivo: limpava o token guardado e fazia
`window.location.reload()`. Isto corria em **toda** chamada gated por device
token, incluindo o polling do KDS a cada ~5s — um único soluço passageiro do
backend (ex.: um erro de BD devolvido como 401 com essa mesma mensagem, corrigido
à parte no backend) apagava um token válido e não-expirável, e devolvia o
ecrã ao formulário de resgate sem motivo real. Pior: manter o `reload()` mas
tirar só a limpeza do token não resolveria — `checkToken()` (chamado por
`GetPairingStatusUseCase` a cada mount) também passa por `deviceFetch`, por
isso, numa indisponibilidade sustida, cada mount voltaria a apanhar 401 e a
recarregar, criando um ciclo de reloads sem fim enquanto o backend estivesse
em baixo. Por isso `deviceFetch` deixou de inspecionar a resposta: devolve a
`Response` tal como veio, e quem chama trata o `!res.ok` como já fazia (ex.:
`getDeliveries` lança e o `useQuery` do KDS simplesmente tenta de novo no
próximo poll). A limpeza do token continua a ser responsabilidade exclusiva
de `GetPairingStatusUseCase`, que já tinha o mecanismo certo: confirma contra
o endpoint dedicado (`checkToken()`) e falha aberto em erro de rede. Efeito
aceite: um token realmente revogado a meio de uma sessão longa (KDS, kiosk,
`/fecho`) não é apanhado de imediato — as chamadas seguintes desse ecrã
simplesmente continuam a falhar (visível como erro) até o próximo mount de
`DevicePairingGate` (recarregar a página, navegar de novo para o ecrã). Isto
já era verdade para o stream SSE do KDS (ver "Pontos de atenção" abaixo);
agora vale para todas as chamadas do módulo, não só o SSE.

**Sem token local também chama o servidor — supersede o atalho local anterior.**
`GetPairingStatusUseCase.execute()` deixou de ter o atalho
`if (storage.getToken() === null) return { paired: false }`: chama sempre
`checkToken()`, mesmo sem token guardado. Motivo: o backend tem um
kill-switch manual de último recurso (`DEVICE_AUTH_BYPASS_UNATTENDED`, env
var, desligado por omissão) que, quando ligado, aceita **qualquer** pedido de
device-auth — incluindo um sem header `X-Device-Token` nenhum — caindo para
um `UNATTENDED_SCOPE` fixo. Um ecrã cujo token guardado foi apagado (ex.: por
um bug já corrigido) nunca teria hipótese de beneficiar deste kill-switch
enquanto o atalho local devolvesse `{ paired: false }` sem tocar a rede — o
pedido nunca chegava ao backend para o kill-switch decidir. `deviceFetch`
já lida bem com a ausência de token: `deviceTokenHeader()`
(`local-storage-device-token.adapter.ts`) devolve `{}` quando não há token
guardado, por isso o pedido sai sem o header `X-Device-Token`, nunca com um
valor inválido nem falhando localmente — chega ao backend como um caso
normal de "token ausente".
Comportamento com o kill-switch desligado (default, caminho normal): sem
token local, `checkToken()` continua a resolver `false` (o backend responde
401 por token ausente, o mesmo `requireDeviceAuth` de sempre), o token
guardado não existe para limpar, e `{ paired: false }` é reportado — igual
ao que o atalho antigo já dava, sem regressão. O custo aceite é um round-trip
de rede extra em todo mount de um ecrã nunca emparelhado (antes, zero
chamadas; agora, uma). Com o kill-switch ligado, o mesmo pedido sem token
passa a resolver `true`, e o ecrã reporta `paired: true` sem lançar — é
exactamente o caso que esta mudança destranca.
Nota histórica: existia aqui uma ressalva sobre `GET
/api/location-credentials/tokens/me` devolver `200` para qualquer pedido sem
token (fallback de scaffolding do então `UNATTENDED_SCOPE` sempre ativo,
ticket 06). Esse fallback incondicional já foi removido — o que existe hoje
é o kill-switch acima, explícito e desligado por omissão — por isso deixou
de ser verdade que "sem token nenhum ainda devolve 200 hoje" em geral; só
devolve com o kill-switch ligado.

**Seam legado: ficheiros antigos importam funções simples do módulo.**
`cashClosingApi.ts`, `kdsApi.ts`, o `kioskScan` de `hrApi.ts` e
`KioskDisplayPage.tsx` são módulos/páginas não migrados que já chamam `fetch`
diretamente ou lêem o token guardado fora da DI de qualquer módulo, anteriores
a este ticket. Migrá-los para os use cases do módulo implicaria mover
`CashClosingPage`/`KdsPage`/`KioskCheckinPage`/`KioskDisplayPage` para o padrão
hexagonal — fora do âmbito (o README de `cash-closings` já documenta
`CashClosingPage` como legado pendente de migração). Estes ficheiros importam
diretamente as **funções simples exportadas** de `device-fetch.ts`
(`deviceFetch`) e `local-storage-device-token.adapter.ts`
(`deviceTokenHeader`, `getStoredDeviceToken`) — nunca o use case, nunca o
contexto React. Isto é uma exceção deliberada e temporária, não um padrão a
reutilizar noutro sítio.

**Token do próprio ecrã propagado via QR (`deviceToken` na URL de checkin).**
`KioskDisplayPage` (o tablet fixo, normalmente emparelhado) lê o seu próprio
token com `getStoredDeviceToken()` e acrescenta-o como query param
`deviceToken` na URL codificada no QR — omitido quando o ecrã ainda não está
emparelhado, preservando o comportamento anterior. `KioskCheckinPage` corre
no telemóvel de quem faz scan, cujo `localStorage` está normalmente vazio, por
isso não pode confiar em `deviceFetch`/`deviceTokenHeader` (que só leem o
`localStorage` do próprio dispositivo). Em vez disso, lê o parâmetro
`deviceToken` da sua própria URL e passa-o a `kioskScan(...)`, que — só quando
`deviceToken` é passado — faz `fetch` direto com o header `X-Device-Token`
montado explicitamente a partir desse valor, contornando `deviceFetch` (sem
`deviceToken`, cai no caminho antigo via `deviceFetch`/`localStorage`,
inalterado). Não muda o formato de `GET /kiosk/daily-token` nem o corpo de
`POST /kiosk/scan` — só o transporte do token já existente (query param no QR
→ header no scan).

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
  sem rede nem DOM. `InMemoryLocationCredentialsApiAdapter.withSeed({ tokenCheck })`
  controla a resposta de `checkToken()` (`"valid" | "invalid" | "error"`,
  default `"valid"`) para exercitar os três caminhos do
  `GetPairingStatusUseCase`. Inclui, sem token local: `checkToken()` a
  resolver `false` (kill-switch desligado, 401 normal → `paired: false`,
  `checkToken` chamado) e a resolver `true` (kill-switch ligado →
  `paired: true`, sem lançar) — ver ADR "Sem token local também chama o
  servidor".
- `device-fetch.test.ts` — `deviceFetch` isolado, com `fetch` e
  `window.location` mockados (`vi.stubGlobal`): cobre o header
  `X-Device-Token`, e que um 401 (com ou sem o corpo de falha de auth de
  dispositivo) não limpa o `localStorage` nem chama `reload()` — só devolve a
  `Response` ao chamador.
- `http-location-credentials-api.adapter.test.ts` — `checkToken()` isolado,
  com `fetch` mockado: 200 resolve `true`, 401 resolve `false`, e 500/502/503
  lançam (em vez de resolver `false`) — a distinção de que depende o
  fail-open de `GetPairingStatusUseCase`.
- UI/hooks: Testing Library, injetando um `LocationCredentialsModule` de teste
  via `LocationCredentialsProvider` (`PairingRedemptionForm.test.tsx`,
  `DevicePairingGate.test.tsx`, `LocationCredentialsAdminView.test.tsx`).

## Pontos de atenção / dívidas conhecidas

- Um token revogado a meio de uma sessão longa (KDS, kiosk, `/fecho`) não é
  apanhado de imediato: `deviceFetch` não reage a 401 (ver ADR "`deviceFetch`
  não limpa nem recarrega em 401"), e a revalidação de
  `GetPairingStatusUseCase` só corre ao montar `DevicePairingGate`. Até esse
  próximo mount, as chamadas desse ecrã (incluindo o stream SSE do KDS, que
  nunca passou por `deviceFetch`) simplesmente continuam a falhar/401 —
  visível como erro, sem voltar por si só ao formulário de resgate.
- A revalidação de `GetPairingStatusUseCase` falha aberta (`paired: true`)
  num erro de rede ao chamar `checkToken()`, para não bloquear um kiosk
  offline com um token que já foi válido. Efeito: um token revogado
  enquanto o dispositivo está offline só é detetado no próximo mount de
  `DevicePairingGate` já com rede de volta.
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
