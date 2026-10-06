# Módulo: employee-portal

> Status: ativo
> Última atualização: 2026-10-06

## Propósito
Portal do Colaborador (`/portal`, mobile-first, PWA instalável): o próprio
colaborador vê o próximo turno e regista Entrada/Saída, com geolocalização
lida **só no momento da picagem**. Não é um segundo sistema: lê e escreve nas
mesmas entidades do Hub através das rotas `/api/me/*` do backend (módulo `hr`).
NÃO é responsável por dar acesso (isso é a ficha do colaborador, módulo `hr`)
nem pela zona de picagem (Local, módulo `locations`).
Spec e tickets: backend `.scratch/portal-colaborador/`.

## Conceitos do domínio
- `PortalHome` — próximo turno publicado, estado da picagem de hoje
  (`not_in | in | done | no_shift`), ação do botão (`in | out | null`),
  motivo quando ainda não é possível (ex.: `TOO_EARLY`) e a política GPS do
  local (`off | warn | block`). Calculado no servidor com as mesmas regras da
  picagem.
- `ClientLocation` — leitura crua do telemóvel (`latitude/longitude/accuracyM`)
  ou o motivo de não a ter (`permission_denied | unavailable | timeout`). O
  servidor decide dentro/fora — o cliente nunca envia "estou dentro".
- `PunchResult` — hora **do servidor**, resultado da zona, `flagged`
  (aceite mas assinalada) e `replay` (pedido repetido, nada novo gravado).
- Erros: `PunchRefusedError` (409 com `code`), `PortalNotLinkedError`,
  `PortalOfflineError` (sem rede — nunca há picagem offline).
- `portal-text.service` — textos PT-PT (dia relativo, horário, estado,
  recusas, confirmação, aviso de localização).

## Ports
### Entrada (use cases)
- `GetPortalHomeUseCase` — Início.
- `RegisterPunchUseCase` — lê a localização só se a política ≠ `off`, uma vez;
  envia com a chave de idempotência; numa falha de rede repete UMA vez com a
  mesma chave.
### Saída (dependências do domínio)
- `PortalApiPort` — `GET /api/me`, `POST /api/me/punches`.
- `GeolocationPort` — uma leitura (`readOnce`), nunca lança.

## Adapters
### Entrada (UI)
- `PortalLayout` — cabeçalho + navegação inferior (Início, Escala,
  Documentos, Ausências, Perfil); no 1º acesso com palavra-passe temporária
  mostra só `SetPasswordView`; liga o manifest/ícones/service worker.
- `PortalHomeView` (+ `usePortalHome`) — próximo turno, estado e botão.
- `PortalProfileView`, `SetPasswordView`, `PortalComingSoonView` (Escala,
  Documentos, Ausências — tickets 07–09).
### Saída
- `HttpPortalApiAdapter` — `lib/api`; traduz 409/403/rede para os erros do domínio.
- `BrowserGeolocationAdapter` — `navigator.geolocation.getCurrentPosition`
  (alta precisão, `maximumAge: 0`, timeout 12 s). Nunca `watchPosition`.

## Decisões de design (ADR resumido)
- **Uma chave por intenção**: o `PortalHomeView` guarda a chave enquanto a
  intenção não termina — novo toque depois de falha de rede reutiliza-a (o
  servidor devolve o que já gravou); recusa de negócio ou sucesso fecham a
  intenção.
- **Sem GPS com política `off`** (minimização). Com política ativa, aviso
  curto de transparência junto do botão.
- **PWA sem dependências**: `public/portal.webmanifest` (scope `/portal`),
  ícones em `public/portal/` (gerados, a trocar pelo logótipo oficial),
  `public/portal-sw.js` sem cache (só instalabilidade). Manifest e meta
  tags iOS só são injetados nas páginas do Portal — a área de gestão não é
  instalável.
- **Papel `employee`**: `ProtectedRoute` leva-o para `/portal` em qualquer
  outra rota; o backend recusa-lhe na mesma tudo fora de `/api/me`.

## Como testar
- `npx vitest run src/modules/employee-portal`
- No telemóvel: ver `.scratch/portal-colaborador/issues/06-teste-no-telemovel.md` (backend).

## Pontos de atenção / dívidas conhecidas
- Escala, Documentos/Recibos e Ausências ainda são "em breve" (tickets 07–09).
- Sem notificações (ticket 10, adiado).
- Ícones provisórios.
