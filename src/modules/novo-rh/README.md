# Module: novo-rh

> Status: active (padrão novo) — em desenvolvimento
> Last updated: 2026-10-12

---

## What it is and what it's for (business perspective)

Entrada **"Novo RH"** no menu de Recursos Humanos: a área onde se vê o novo
modelo de RH e assiduidade a ser construído, fase a fase (task RH faseada),
**sem misturar** com os ecrãs e os dados do RH atual. Quando estiver completo
e validado, pode passar a ser o RH principal (decisão à parte).

**The problem it solves:**
Acompanhar e testar o desenvolvimento novo sem arriscar o RH que está em uso.

**Key concepts for the business:**

- **Modo Real / Demonstração** — Real usa a organização verdadeira; Demonstração usa uma organização fictícia na mesma base de dados (criada por um Admin no próprio ecrã, alterável à vontade), que nunca aparece no modo Real nem nas outras áreas.
- **Fase** — etapa da task; só avança depois de aprovada.

---

## Technical purpose

Moldura com a navegação MVP (`screens.registry.ts`: 6 áreas — Visão geral | Colaboradores | Escalas | Assiduidade | Ausências | Documentos — com 🔔 Pedidos (`inbox/InboxButton`, gaveta com as mesmas ações da Caixa) e ⚙ Configurações à direita; separadores dentro da área: Assiduidade = Conferência/Registos de ponto/Banco de horas/Fecho/Relatórios, Colaboradores = Lista/Transferências/Relatórios, Ausências = Ausências/Relatórios, Configurações = Geral/Estrutura/Entidades/Acessos/Convites/Alertas/Auditoria; Comunicados, Tarefas e o catálogo completo de relatórios ficam fora do menu mas abrem por ligação/pesquisa; caminhos antigos `/tempo`, `/banco-de-horas`, `/fecho`, `/transferencias` redirecionam com query e hash — `LEGACY_REDIRECTS`; só navegação, permissões inalteradas), sino de notificações e ecrã de MFA à entrada. Só o Admin
a vê por agora (`/hr/novo` → `"admin"` em `access-ui.service.ts`). Primeiro
módulo a usar a base de i18n (`src/i18n`).

## Domain concepts

- `DataMode` (`real` | `demo`) — modo de dados do Novo RH. O plano por fases saiu da Visão geral (todas as fases concluídas, 2026-10-13).
- `DataMode` — `real` | `demo`.
- `settings.ts` — contrato do motor de configurações (definições, perfis, alvos, valores, valor efetivo com origem/herdado, histórico).
- `settings-format.service.ts` — formatar/converter valores por tipo; chaves de texto por nível e área.

## Ports

### Output

- `SettingsApiPort` — `/api/novo-rh/settings` (+ listas de colaboradores e locais para os alvos; em Demonstração vêm de `/api/novo-rh/people` e `/api/novo-rh/catalog/locations`).
- `InboxApiPort` — `GET /api/novo-rh/inbox`, `POST /api/novo-rh/inbox/decide` (caixa de pedidos, FE-050).
- `OverviewApiPort` — `GET /api/novo-rh/overview/plan?from&to` (planeado da equipa) e `GET /api/novo-rh/overview?date=` (Painel do dia: KPIs, pessoas com estado e atraso, por centro, 7 dias, pendentes, feriados).
- `DemoApiPort` — `GET/POST /api/novo-rh/demo` (estado / criar a organização fictícia); `DataModeStorePort` — modo escolhido.
- `MfaPort` — MFA TOTP do Supabase (estado, ativar, confirmar).
- `StructureApiPort`, `AccessGovernanceApiPort`, `AuditApiPort`, `NotificationsApiPort` (`governance-api.port.ts`).
- `PeopleApiPort` — `/api/novo-rh/people` e `/api/novo-rh/catalog` (Fase 2).
- `TimeApiPort` — `/api/novo-rh/time` (Fase 3).
- `AnnouncementsApiPort`, `AlertsApiPort`, `WorkspaceApiPort`, `ReportsApiPort` (`engagement-api.port.ts`, Fase 9).
- `PeriodsApiPort` — `/api/novo-rh/periods` (Fase 8).
- `RostersApiPort` — `/api/novo-rh/rosters` e `/api/me/roster` (Fase 7).
- `TimeBankApiPort` — `/api/novo-rh/time-bank` (Fase 6).
- `AbsencesApiPort` — `/api/novo-rh/absences`; `MyAbsencesApiPort` — `/api/me/absences` e `/api/me/approvals` (Fase 5).
- `AttendanceApiPort` — `/api/novo-rh/attendance`; `MyClockApiPort` — `/api/me/clock`; `PunchQueueStoragePort` — onde fica a fila offline (Fase 4).

## Adapters

### Input

- `inbox/InboxView` → `/hr/novo/pedidos` (FE-050): tipos com contadores, segmentos (a minha decisão / outras / todas), procurar, antiguidade destacada a partir de 7 dias, pedido próprio sem botões (RE-22), aprovar/recusar um ou vários (recusa com motivo ≥ 5 caracteres) e resultado por pedido.
- `attendance/ClockTypesPanel` (Assiduidade → Tipos de registo, FE-105): formação, deslocação, teletrabalho — remuneração sempre escolhida, máximo por dia, dias e horas bloqueados; o registo normal aparece sempre como primeira linha. Em "O meu ponto", "Começar: <tipo>" envia `clockTypeId` (também pela fila offline).
- `attendance/BreakTypesPanel` (Assiduidade → Pausas, FE-103): catálogo de pausas — remuneração sempre escolhida (paga / não paga / híbrida com minutos pagos por dia), duração máxima, janela, usos por dia, dias; alterar exige motivo; arquivar. Em "O meu ponto", com catálogo, a pausa escolhe-se pelo nome (`breakTypeId` vai na marcação e na fila offline).
- `attendance/TeamDayPanel` (Assiduidade → Dia da equipa, separador inicial; FE-030): linha 0–24 h por pessoa com o planeado tracejado, só faltas e atrasos, detalhe no `PersonDayDrawer`. `attendance/IncidentsPanel`: filtro por tipo e resolução em lote (FE-033).
- `time/TeamPlanPanel` (Tempo → Planeado da equipa, separador inicial; FE-031): 1 ou 2 semanas, horário/feriado/ausência por dia, quem não tem planeamento primeiro.
- `time-bank/TimeBankView` → separador Todos (FE-034): saldos de todos, ordenar, total; clicar abre o histórico.
- `absences/CalendarPanel` (Ausências → Calendário, separador inicial; FE-035): mês com aprovadas e pendentes, feriados e ausentes por dia; atribuir a mesma ausência a vários (em dias) com resultado por pessoa.
- `overview/OverviewDashboard` (topo da Visão geral): números do dia clicáveis como filtro, lista de colaboradores (faltas e atrasos primeiro; procurar, filtrar por centro), pendentes com ligação à caixa certa, por centro, últimos 7 dias, próximos feriados; atualiza a cada minuto e permite escolher um dia passado. `overview/PersonDayDrawer`: horário vs. entrada, marcações do dia, últimos 7 dias, ligações à ficha e à assiduidade (`/hr/novo/assiduidade?employeeId=` abre já essa pessoa).
- `NovoRhLayout` + `NovoRhHomeView` → `/hr/novo` (com `DataModeSwitch`: Real/Demonstração, criar com confirmação).
- `DemoModeBanner` (faixa em todo o Novo RH em Demonstração, com "Voltar ao modo Real"); `DemoAccessNotice` substitui Acessos em Demonstração.
- `MfaGate` — só abre o Novo RH com sessão `aal2` (TK-3).
- `engagement/AnnouncementsView` → `/hr/novo/comunicados` (FE-060/061/062 — gerir: criar com contagem de destinatários (todos, centros, departamentos, pessoas), lista com estado, pesquisa e progresso de leituras/confirmações, publicar, versão nova, duplicar, eliminar rascunho, arquivar, lembrar quem falta (um por dia), exportar prova de leitura em CSV, relatório filtrado por estado; os meus: ler/confirmar); `engagement/AlertsView` → `/hr/novo/alertas` (lista com tratar/fechar com nota, avaliar agora; regras com dono, prazo e escalonamento); `engagement/WorkspaceView` → `/hr/novo/tarefas` (tarefas com checklist, solicitações personalizadas, quem está); `engagement/ReportsView` → `/hr/novo/relatorios` (ver e CSV).
- `periods/PeriodsView` → `/hr/novo/fecho`: Períodos (criar por organização/centro, verificar pendentes, fechar com exceção explícita, fechos com diferenças, exportar salários/faturação, pedir reabertura), Reaberturas (dupla aprovação), Transferências (ficheiros de 24 h).
- `rosters/RostersView` → `/hr/novo/escalas`: Escala (grelha de 2 semanas, clicar para pôr o modelo, rascunho tracejado, alterar/retirar publicado com motivo, publicar com avisos a confirmar ou bloqueios, em massa, histórico de versões), Modelos de turno, Trocas (gestão), O meu horário (turnos publicados, propor/aceitar trocas).
- `time-bank/TimeBankView` → `/hr/novo/banco-de-horas`: saldo e histórico (KPIs, corte, ledger com acumulado ao segundo, ajustes lançados hoje), excedente por validar, compensar (limitado ao máximo — RE-28), ajustar, sincronizar; horas categorizadas com fator.
- `absences/AbsencesView` → `/hr/novo/ausencias`: Para aprovar (caixa do aprovador, nível e escalonamento), Pedidos (filtrar, atribuir, cancelar — aprovada exige motivo), Saldos (movimentos, ajuste com motivo, compensar feriados trabalhados), Tipos (valores seguros, sem valores legais), Fluxos de aprovação (níveis com pessoas/papéis, recurso; nível vazio não grava), As minhas.
- `attendance/AttendanceView` → `/hr/novo/assiduidade`: Dias (totais do motor, marcações, corrigir com motivo, ajustes, recalcular), Incidentes (corrigido / validar horas / dispensar com comentário), Pedidos de correção (aprovar / recusar com motivo), O meu ponto (picar com fila offline, recusar correções no prazo, pedir correção). O Portal do Colaborador continua no registo atual (ADR-0027 do backend).
- `time/TimeView` → `/hr/novo/tempo`: Horários (fixos/flexíveis, versões, aplicar a), Feriados (calendários por centro, importar nacionais "a confirmar", confirmar, eliminar com impacto), Férias (configuração, sem limite por omissão), Tempo teórico por colaborador.
- `people/PeopleListView` → `/hr/novo/pessoas` (FE-011: números de topo que filtram — total, ficha a completar, sem local; filtros por centro e cargo guardados no endereço; colunas à escolha guardadas no navegador; criar, importar CSV com simulação, exportar); `people/PersonView` → `/hr/novo/pessoas/:id` (cabeçalho com iniciais, cargo, local e admissão; Dados com privacidade por campo e motivo nos sensíveis, Contratos, Organização/transferência, Responsáveis, Remuneração, **Ponto, Ausências, Horário e Banco de horas** — os ecrãs das áreas fixados na pessoa (`fixedEmployeeId`) —, **Estatísticas** do mês (FE-023), Campos da empresa, Regras pessoais, Documentos, **Histórico** de alterações pela auditoria (FE-014), **Acesso** — conta, perfil e âmbitos, gerir em Utilizadores/Acessos (FE-016); históricos de cargo e salarial derivados da auditoria em Organização e Remuneração (FE-015, FE-018)); `people/NewPersonDrawer` — assistente em 4 passos (identificação com aviso de ficha parecida, trabalho, contrato e horário opcionais, resumo; FE-012); `structure/CatalogSections` (convénios, complementos/benefícios, campos personalizados).
- `structure/StructureView` → `/hr/novo/estrutura`; `access/AccessView` → `/hr/novo/acessos`; `audit/AuditView` → `/hr/novo/auditoria`; `NotificationsBell` no cabeçalho.
- `settings/SettingsHubView` → `/hr/novo/configuracoes?tema=` (FE-090): menu por tema — Assiduidade, Jornada e teórico, Banco de horas, Escalas, Valores legais, Notificações, Segurança e visibilidade — cada um com as regras do perfil geral do domínio (`ProfilePanel` filtrado por `settings-topics.service`; cria o perfil geral se faltar); Catálogos e Empresa/locais/papéis como atalhos para os ecrãs que já os gerem; "Perfis e exceções" = `SettingsView`. Um teste garante que cada parâmetro do catálogo do backend cai em exatamente um tema.
- `settings/SettingsView` → `/hr/novo/configuracoes`: perfis por área, alterar valor (data de efeito, motivo, impacto se retroativo), alvos, valor por colaborador, histórico + CSV.

### Output

- `HttpSettingsApiAdapter` — usa `apiGetVersioned`/`apiWrite` (`src/lib/api.ts`): ETag lido e enviado em If-Match; Idempotency-Key em cada escrita.
- `HttpAbsencesApiAdapter`, `HttpMyAbsencesApiAdapter`.
- `HttpTimeBankApiAdapter`.
- `HttpRostersApiAdapter`.
- `HttpPeriodsApiAdapter` (o download pede primeiro o link com token).
- `http-engagement-api.adapters.ts` (comunicados, alertas, espaço de trabalho, relatórios).
- `HttpOverviewApiAdapter`, `HttpInboxApiAdapter`.
- `HttpDemoApiAdapter`, `LocalStorageDataModeStore`, `novoRhModeHeaders` (cabeçalho `X-Novo-RH-Mode: demo` só nos pedidos `/api/novo-rh/*`, ligado em `src/lib/api.ts` via `setRequestHeaderProvider`).
- `HttpAttendanceApiAdapter`, `HttpMyClockApiAdapter` (a marcação usa o `clientEventId` como Idempotency-Key), `LocalStoragePunchQueue` (só ids e tipo; em memória se o navegador não deixar guardar).

## Design decisions (ADR summary)

- Área separada em vez de mexer nos ecrãs atuais (pedido do utilizador, 2026-10-11; ADR-0018 do backend).
- Visível só para Admin enquanto está em desenvolvimento.
- Textos via `t()` desde o início (pt-PT agora, es-ES depois — ADR-0023 do backend).
- Modo Demonstração (ADR-0034 do backend): o browser só envia o cabeçalho; o backend decide a organização fictícia (só Admin). O cabeçalho liga-se de forma síncrona no `NovoRhProvider` e, ao trocar, apagam-se as queries `["novo-rh", …]` e os ecrãs voltam a montar — nada de um modo aparece no outro. Acessos, notificações e "O meu ponto" usam sempre a conta real.
- Fotos: `photoUrl` vem da lista de colaboradores (`settings.listEmployees`, real = `/api/hr/people`, demo = `/api/novo-rh/people`) e da ficha; os ecrãs usam `useEmployeePhotos()` e o `Avatar` do kit (iniciais se não houver foto ou o URL expirar). A demonstração usa ilustrações CC0 em `public/demo-avatars/` (ver o LICENSE.md da pasta).
- Escalas (Design System): vista "Turnos" = uma linha por modelo (barra na cor do tipo, horário, horas do período) com as fotos de quem faz o turno em cada dia; sem escalas, a grelha dá lugar a um estado vazio com "Nova escala".
- Escalas abrem na visão macro (`RostersOverview`, `GET /rosters/summary`): todas as escalas por local/grupo, com funcionários, estado e última publicação; escolher uma abre a grelha.
- Escalas — sobreposições: a API recusa (422) turnos que se sobreponham a outro do mesmo colaborador, também em rascunho; a grelha assinala a vermelho os que já existiam (`overlappingIds`).
- Escalas — edição direta (`use-roster-editing.ts`, regras puras em `roster-edit.service.ts`): arrastar um turno para outro dia mostra "Mover | Copiar" na própria célula; arrastar por vários dias pinta-os (retângulo pessoas × dias) e copia para todos; clicar/arrastar em dias vazios escolhe-os (com um modelo escolhido em "Atribuir turnos", atribui-o logo, em massa); Ctrl+C copia o turno sob o rato (ou o aberto) e Ctrl+V cola nos dias escolhidos. Sem endpoints novos: cada turno é criado com `addShift` (as regras e avisos continuam na API); "mover" = criar no novo dia e depois retirar o original (com motivo se já estava publicado — a API publica logo essa remoção). Funciona igual em dados reais e na demonstração.
- Modelos de turno: as horas escolhem-se no relógio (`TimePicker` do kit), sem escrever.
- Visão geral = Dashboard executivo (`adapters/in/dashboard`, regras em `dashboard.service.ts`; backend ADR-0036): um `OperationalSnapshot` (`GET /dashboard/snapshot`, polling 60 s só com a aba visível) alimenta resumo "Hoje" (frase determinística), Requer atenção, Estado da equipa (7 categorias: a trabalhar, remoto, pausa, terminaram, por entrar, férias, ausentes — faltas contam em ausentes; donut SVG, animação única com `animate()`/rAF fora do estado React, respeita movimento reduzido), Estado das unidades (agregação no servidor) e Cobertura; listas só a pedido (`/team`, gaveta), detalhe da unidade em gaveta. Registo de widgets (`WIDGETS`: ids estáveis, tamanhos permitidos, fonte disponível, permissão) — vagas e artigos sem fonte não aparecem; Avaliações Google (`GoogleReviews.tsx`, `/api/novo-rh/google-reviews`): média ponderada e nota por local, avaliações a pedido com autor e "Ver no Google", gaveta "Ligar locais ao Google" (pesquisa + escolha; servidor exige `company.locations` MANAGE); sem chave no servidor mostra "não configurado". Personalizar: rascunho local (arrastar nativo + subir/descer por teclado, ocultar, tamanhos predefinidos), Guardar = um `PUT /dashboard/layout` só com metadados. O painel anterior fica em `/hr/novo/painel-anterior` durante a validação.
- Escalas — edição rápida: modelo escolhido em "Atribuir turnos" (`paint`, o único estado) acompanha o cursor (`PlacementPreview`: um `pointermove`, posição por `requestAnimationFrame` fora do estado React, `pointer-events: none`); Esc / fechar o painel / mudar de escala ou período cancelam. Desfazer/Refazer (`use-edit-history.ts`, regras em `edit-history.service.ts`): só deltas (ids + inverso), máx. 30, em memória; publicar, mudar de escala ou período limpam. `×` nos turnos pendentes (CSS `group-hover`, sem estado por cartão). Linha da pessoa: nome é link para a ficha (por id); a célula e o `⋯` abrem o mesmo menu (ver funcionário, limpar pendentes do período — `POST /rosters/:id/clear-pending`, uma só operação, reversível com `POST /rosters/:id/shifts/restore`). Escala e semana ficam na URL (`?escala=&semana=`) para voltar ao mesmo sítio.

## How to test

`npx vitest run src/modules/novo-rh src/i18n`

## Known gaps / open debt

- Alvos de configuração por departamento/grupo ainda desligados no seletor (o backend já os aceita).
- Não há "recomeçar" a demonstração (registos append-only no backend).
- Onda 1 do pacote FE: falta aprovação parcial de excedente (FE-053), anular ausências em lote e atribuir em lote tipos em horas (FE-035), barra de pré-visualização do recálculo do banco de horas (FE-034).
