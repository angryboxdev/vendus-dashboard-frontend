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
  recusas, confirmação, aviso de localização) e regras de apresentação da
  consulta (semana de segunda a domingo, período dos recibos, vencido / a
  vencer em 30 dias, etiquetas das ausências).

## Ports
### Entrada (use cases)
- `GetPortalHomeUseCase` — Início.
- `RegisterPunchUseCase` — lê a localização só se a política ≠ `off`, uma vez;
  envia com a chave de idempotência; numa falha de rede repete UMA vez com a
  mesma chave.
- `PortalEngagementUseCase` (onda 6 do Novo RH) — comunicados e documentos enviados (os que pedem ação primeiro), tarefas (abertas por prazo), solicitações (recusa se faltar resposta obrigatória), quem está, banco de horas e a contagem para "Mais".
- `PortalSelfServiceUseCase` — escala, colegas, documentos, URL de download e
  ausências do próprio (o servidor filtra pela sessão).
### Saída (dependências do domínio)
- `PortalApiPort` — `GET /api/me`, `POST /api/me/punches`, `GET /api/me/shifts`,
  `/me/shifts/:id/coworkers`, `/me/documents`, `/me/documents/:id/download-url`,
  `/me/leave`.
- `PortalEngagementApiPort` — `/api/me/announcements`, `/me/document-distributions`, `/me/ops-tasks`, `/me/custom-requests`, `/me/whos-in` (rotas do Novo RH).
- `GeolocationPort` — uma leitura (`readOnce`), nunca lança.

## Adapters
### Entrada (UI)
- `PortalLayout` — cabeçalho + navegação inferior (Início, Escala,
  Documentos, Ausências, Perfil); no 1º acesso com palavra-passe temporária
  mostra só `SetPasswordView`; liga o manifest/ícones/service worker.
- `PortalHomeView` (+ `usePortalHome`) — próximo turno, estado e botão.
- `PortalScheduleView` — semana a semana (só publicados), "Quem trabalha
  comigo" por turno (nome curto + cargo + horário, carregado ao abrir).
- `PortalDocumentsView` — Recibos (por período, "OUT 2026") e Documentos com
  aviso de vencido / a vencer em 30 dias; "Abrir" pede o URL assinado.
- `PortalLeaveView` (separador **Pedidos**) — `PortalRequestsSection` (Justificar falta → RH, com comprovativo opcional; Pedir folga → gerente; lista com estado, motivo da decisão e cancelar enquanto pendente) + ausências do ano (só consulta; sem saldo nem feriados).
- `DocumentsAlert` (Início) — aviso de documentos vencidos/a vencer que pode substituir.
- `PortalProfileView`, `SetPasswordView`.
- Onda 6 (separador **Mais**, `/portal/mais`): `PortalNewsView` (`/portal/comunicados` — documentos enviados e comunicados com "Confirmo que li"), `PortalTasksView` (`/portal/tarefas`), `PortalCustomRequestsView` (`/portal/solicitacoes`), `PortalTeamView` (`/portal/equipa`); Perfil passou para dentro de "Mais". O Banco de horas saiu do Portal a pedido do utilizador (2026-10-19); o endpoint `/api/me/time-bank` continua no backend.
### Saída
- `HttpPortalEngagementApiAdapter` — erros RFC 7807 do Novo RH → `PortalRequestError` com a mensagem do servidor; escritas com `Idempotency-Key`.
- `HttpPortalApiAdapter` — `lib/api`; traduz 409/403/404/rede para os erros do domínio.
- `ModeAwarePortalApiAdapter` (Fase 2 do Portal ligado ao Novo RH) — lê uma vez `GET /api/me/portal-mode` (interruptor `time_tracking.portal.uses_novo_rh`, por organização ou centro) e delega no adapter certo; se a leitura falhar, fica o sistema de sempre.
- `HttpNovoRhPortalApiAdapter` — o mesmo contrato sobre o Novo RH: ponto `/api/me/clock`, escala `/api/me/roster` (+ colegas), pedidos `/api/me/absences` com os tipos «Folga» e «Falta justificada» (`/api/me/absences/portal-types`; motivo no comentário «motivo — texto»; anexo por `/api/me/absence-attachments`); documentos delegados no adapter de sempre (motor partilhado). Mapeamentos puros em `domain/services/novo-rh-portal.service.ts`.
- `BrowserGeolocationAdapter` — `navigator.geolocation.getCurrentPosition`
  (alta precisão, `maximumAge: 0`, timeout 12 s). Nunca `watchPosition`.

## Decisões de design (ADR resumido)
- **Área do colaborador do Novo RH = Portal** (2026-10-12): os colaboradores entram em `/portal`, não em `/hr/novo`; as funções da onda 6 sem equivalente antigo ficam aqui. Ponto, ausências e escala continuam nas rotas antigas até à decisão de arranque do Novo RH (dois sistemas de ponto em paralelo).
- **Documento enviado: confirmar só depois de abrir** — abrir regista "aberto" no servidor (prova).
- **Novo pedido + calendário de período** (2026-10-08, mockup): um só cartão "Novo pedido" com Tipo (Folga / Justificar falta). O Período da folga abre `PeriodSheet` (folha de baixo, calendário de intervalo: 1.º toque início, 2.º fim; sem dias passados; máx. 7 dias — `period-picker.service`) em vez de dois campos de data, que no iPhone deixavam o "Até" ficar antes do "De". Lista em "Pedidos recentes".
- **Substituir documento** (ticket 11): só quando o servidor diz `canReplace` (vencido / a vencer em 30 dias, sem envio pendente). PDF ou foto; depois de enviado fica "Em validação pelo RH" e não há remover; uma rejeição mostra o motivo.
- **Pedidos** (ticket 12): a aprovação de uma folga não mexe na escala — o gerente ajusta à mão (decisão 2026-10-07).
- **Download no iPhone**: "Abrir" abre a janela no próprio toque e só depois
  lhe dá o URL assinado — o Safari iOS bloqueia `window.open` feito depois de
  um `await`.
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
- Portal sobre o Novo RH (Fase 2): sem geofence nem «bloqueado porque…» no Início (o servidor recusa e a mensagem aparece ao picar); a nota da decisão do gestor ainda não é mostrada; o centro do turno é o principal da ficha.
