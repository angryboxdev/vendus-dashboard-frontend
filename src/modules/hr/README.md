# Módulo: hr

> Status: ativo
> Última atualização: 2026-10-06 (Base Organizacional — recibos de vencimento, ticket 10)

## O que é e para que serve (perspectiva de negócio)

Área **Colaboradores** (RH-02 — antes "Pessoas & Documentos", depois
"Pessoas"; renomeada para Colaboradores com abas Lista | Cargos |
Documentos na Base Organizacional) + **Visão Geral operacional** (RH-01) +
**Escalas & Turnos** (RH-03). Substitui a antiga entrada "Funcionários"
por uma vista central do cadastro de colaboradores, com sinais claros de
completude dos dados do perfil e situação documental, um perfil 360º com
dossiê documental versionado (substituir nunca apaga a versão anterior), um
dashboard operacional de entrada (KPIs de equipa/operação do dia/pendências,
alertas prioritários, um drawer sobreposto que explica cada pendência sem
sair da Visão Geral, e uma fila de conferência de turnos), e agora também o
**planeamento da escala** em si: criar/editar/duplicar/publicar turnos,
escala base semanal por colaborador e rotações automáticas entre 2
colaboradores da mesma função. Desde a Fase 2 ("Assiduidade, Correções,
Ausências e Fecho Mensal"), fecha também o ciclo planeado→realizado:
**Assiduidade** (conferência do planeado vs. registado, correção
estruturada pelo gestor com motivo obrigatório) e **Fecho mensal**
(bloqueia/reabre um período).

**O problema que resolve:**
A lista antiga não mostrava quem tinha o perfil incompleto nem que
colaborador tinha documentos a expirar — era preciso abrir um a um. A
gestão de documentos era um simples upload/download/apagar, sem categoria,
validade, estado ou histórico — substituir um ficheiro destruía a versão
anterior.

**Fluxo do ponto de vista do negócio:**

```
RH/Gerente
────────────────────────────────────────────────────
1. Abre "Colaboradores" (aba Lista) — vê KPIs (ativos, dados
   incompletos, documentos a expirar) e a lista de colaboradores
   com cargo, local principal e badges de dados/documentos;
   filtra por cargo e por local
2. Clica num colaborador → perfil 360º (Resumo, Dados pessoais,
   Documentos, Contrato & Remuneração, Histórico)
3. Na aba Documentos de "Pessoas" (visão de TODOS os
   colaboradores), ou dentro do perfil de 1 colaborador, envia
   um novo documento por categoria (drag-and-drop), ou substitui
   um existente — a versão anterior fica preservada, nunca é
   apagada
4. Na Visão Geral, clica num KPI de pendência ("Dados
   incompletos", "Documentos em falta"/"a expirar") — abre um
   drawer que explica o problema sem sair da página, com atalho
   direto para o colaborador ou para "Pessoas > Documentos"
5. Turnos/Pagamentos/Férias continuam a gerir-se nos seus
   ecrãs próprios (ligados a partir do Resumo) — não são
   duplicados aqui
```

## Propósito técnico

Consome os endpoints novos do backend (`/api/hr/people*`, `/api/hr/schedules*`,
módulo `hr` hexagonal lá) para listar/gerir colaboradores, o dossiê
documental versionado, upload de foto de perfil, e agora turnos
planeados/escala base/rotações. Duas leituras (ausências e feriados, para
sobrepor no calendário) chamam rotas legacy diretamente
(`GET /api/hr/leave/overview`, `GET /api/hr/leave/holidays`), sem importar
`src/pages/hr/hrApi.ts` — mesmo padrão já usado por `confirmShiftAttendance`.
**Não é responsabilidade deste módulo**: registar presença real/ponto, gerir
férias/pedidos, pagamentos, kiosk (exceto o PIN de kiosk do colaborador, ver Decisões de design), auditoria de ponto — esses continuam
100% em `src/pages/hr/*` (legacy), reutilizados a partir do Resumo via link
simples para `/hr/employees/:id`. `/hr/calendar` (legacy, só leitura)
continua acessível por URL mas saiu do menu — `/hr/schedules` é a entrada
nova.

## Conceitos do domínio

- **`Employee`** — colaborador (dados pessoais/contratuais + foto). IBAN/
  NIF/NISS/nº de identificação chegam já mascarados do backend quando o
  utilizador é `hr_viewer` (o frontend não faz mascaramento próprio, só
  exibe o que a API devolve).
- **`EmployeeDocument`** — uma versão de um documento numa categoria. `version`/
  `previousVersionId` formam a cadeia de versões; `displayStatus` já vem
  calculado do backend (`ok`/`expiring`/`expired`/`pending_validation`/
  `rejected`/`removed`).
- **Categorias de documento** — só as 3 de identificação (Cartão de
  Cidadão/Título de Residência/Passaporte) continuam fixas no código
  (`IDENTIFICATION_DOCUMENT_CATEGORIES`, `employee-document.ts`) — o mesmo
  requisito "ou" do backend, decisão confirmada com o utilizador. Todas as
  restantes são configuráveis por organização
  (`DocumentCategoryDefinition`, `api.listDocumentCategories()`), geridas
  pelo botão "Categorias de documentos" em Pessoas & Documentos
  (`DocumentCategoriesModal.tsx`) — nome, obrigatória ou não, cargo(s) a que
  se aplica, tipos de ficheiro aceites. O seletor de "nova categoria" na tab
  Documentos filtra por cargo do colaborador e só mostra categorias **ainda
  não usadas** por ele, para nunca bater no 409
  (`DocumentCategoryAlreadyExistsError`) — para reenviar uma categoria já
  existente, usa-se sempre "Substituir".
- **`WorkShift`** (RH-03) — turno planeado. `status: draft | published`
  (rascunho vs. publicado — "Turnos por publicar" no painel de alertas);
  `source: manual | base_schedule | rotation` (proveniência — só
  informativo no frontend, a proteção contra reaplicação silenciosa vive no
  backend). `attendanceStatus` (quando existe) é o que desenha a bolinha
  "Conferido" no calendário; sem ele, a bolinha reflete `status`
  (cinza=rascunho, laranja=publicado por conferir). Desde a task **"Novo
  Turno Padrão Semanal"**, ganhou `endsNextDay` (turno noturno),
  `secondStartTime`/`secondEndTime` (2º período de um turno repartido) e
  `seriesId` (turno pertence a uma série recorrente, ou `null` = avulso/já
  destacado). Só informativo/de exibição no frontend — toda a validação
  (ordem de horas, sobreposição, mutualmente exclusivo repartido+noturno)
  vive no backend.
- **`WeeklyDayRule`/`RepeatMode`/`PlannedOccurrence`** ("Novo Turno Padrão
  Semanal") — o mesmo vocabulário do backend (`shift-recurrence.service`),
  usado por `ShiftSeriesForm` para montar o pedido de preview/criação. Um
  padrão é uma lista de regras (dias da semana + 1-2 períodos cada) e um
  modo de repetição (`none`/`weeks`/`until_date`).
- **`BaseScheduleCell`** (RH-03) — uma célula (dia da semana 0..6) do modelo
  semanal de um colaborador, editada na grelha do `BaseScheduleModal.tsx`.
- **`ShiftRotation`** (RH-03) — rotação semanal entre 2 colaboradores da
  mesma função, alternando Turno A/Turno B. `ShiftRotationsPanel.tsx` é um
  separador dentro da mesma página (`SchedulesView.tsx`), não uma rota
  própria — decisão da própria task ("sem criar um módulo separado").
- **`AttendanceRulesConfig`/`AttendanceOccurrenceKind`** (Fase 2.1 —
  "Regras de Assiduidade, Tolerâncias e Conferência") — configuração
  global (organização inteira, sem regras por colaborador/função/local
  nesta fase) de tolerância de entrada/saída antecipada, limite de
  ausência e janelas de marcação, com histórico versionado por vigência
  (`AttendanceRuleChangeEntry`: valor anterior/novo, data de início de
  vigência, quem alterou). `AttendanceOccurrenceKind` classifica cada
  ocorrência (`late_entry`/`early_exit`/`no_entry`/`no_exit`/`absence`/
  `unscheduled_presence`/`conflict`/`before_window`/`incomplete_period`/
  `ok`) — sempre calculado pelo backend (task, secção 16: o frontend
  nunca deriva tolerância/atraso, só apresenta).
- **`MonthlyAttendanceSummaryRow`** — 1 linha por colaborador com o
  agregado do mês (turnos/pendentes/planeadas/realizadas/dias em
  atraso/horas em atraso/ausências/saldo/**estado**), usada pela aba
  "Por colaborador".
- **`AttendanceEmployeeDetailResult`** (evolução "Por Colaborador") — KPIs
  + extrato diário completo de 1 colaborador, usado pela ficha
  "Assiduidade — Nome" (`AttendanceEmployeeDetailView`).

## Ports

### Saída (`HrApiPort`)

Um método por endpoint do backend — ver `domain/ports/out/hr-api.port.ts`.
`HttpHrApiAdapter` implementa-o sobre `src/lib/api.ts` (`apiGet`/`apiPost`/
`apiPatch`/`apiPostFormData`/`apiDeleteNoContent`).

### Entrada (`SetEmployeeKioskPinPort`)

Único input port do módulo (as vistas chamam `HrApiPort` diretamente).
`SetEmployeeKioskPinUseCase` valida o PIN (exatamente 4 dígitos,
`domain/entities/kiosk-pin.ts`) antes de chamar `HrApiPort.setEmployeeKioskPin`.
Exposto em `HrModule.setEmployeeKioskPin` (composition root `hr.module.tsx`).

## Adapters

### Entrada

- `PeopleTabs` (novo, task "Melhorar Visão Geral e reorganizar Pessoas") →
  navegação por abas do módulo "Pessoas" (antes "Pessoas & Documentos"):
  **Colaboradores | Documentos** — Admissão fica de fora por pedido
  explícito do utilizador ("para já ignora a criação de admissão"). Rotas
  próprias (`/hr/people` continua a ser Colaboradores — não virou
  redirect, para não partir os muitos deep-links existentes —, e
  `/hr/people/documentos` é nova), não abas geridas por `useState`.
- `PeopleListView` → aba **Colaboradores** (Mockup 01): KPIs clicáveis
  (funcionam como filtros locais — "Dados incompletos" filtra
  `profileComplete=incomplete`; "Documentos a expirar" abre a aba
  Documentos já filtrada), filtros (pesquisa/estado/vínculo/situação
  documental — **sem** filtro de "Local", `hr_employees` não é
  location-bearing), tabela a usar a largura toda (o painel "Pendências
  prioritárias" foi removido daqui — centralizado agora no drawer da
  Visão Geral, ver mais abaixo).
- `PeopleDocumentsView` (novo) → aba **Documentos**: 1 linha por
  (colaborador × requisito documental), cobrindo válidos/a
  expirar/expirados/em falta — não só pendências. KPIs de estado
  clicáveis como filtro local, filtro por documento e por colaborador
  (pesquisa por nome). "Ver" (documento existente) abre o download direto
  (`api.getEmployeeDocumentDownloadUrl`); "Adicionar" (em falta) navega
  para o perfil do colaborador já na aba Documentos e categoria certos
  (`?tab=documentos&category=...`) — nunca reimplementa o upload aqui,
  única fonte continua a ser `EmployeeDocumentsTab`. O botão "Categorias
  de documentos" mudou-se para aqui (fazia mais sentido junto da gestão
  documental do que junto de "Novo colaborador"). Ticket 10: coluna e
  filtro **Período** (só recibos) e botão **Importar recibos** (só admin)
  → `ImportPayslipsModal`.
- `ImportPayslipsModal` (ticket 10) → período (mês anterior por omissão) +
  vários PDFs → pré-visualização Arquivo | Colaborador | Período | Estado
  (`api.previewPayslipImport`) → confirmar → gravar
  (`api.importPayslips`, os PDFs são reenviados). Regras puras em
  `payslip-import.service.ts`.
- `EmployeeProfileView` → perfil 360º (Mockup 02) com 5 tabs (Resumo, Dados
  pessoais, Documentos, Contrato & Remuneração, Histórico). Cabeçalho com
  `AvatarUpload` — clicar no círculo da foto **expande-a em ecrã inteiro**
  quando existe foto (clicar fora fecha); upload/troca da foto passou a um
  link de texto próprio "Alterar foto" por baixo do círculo (antes era o
  próprio clique no círculo que abria o seletor de ficheiro — mudado a
  pedido do utilizador, para não misturar "ver" com "trocar"). Sem foto
  ainda definida, o círculo (com as iniciais) continua a abrir o seletor
  de ficheiro diretamente, não há nada para expandir. Lê agora também
  `?category=` (além do já existente `?tab=`) — vindo de "Pessoas >
  Documentos" ou do drawer da Visão Geral, pré-seleciona a categoria no
  formulário de upload da aba Documentos. A secção "Outras áreas"
  (Turnos/Pagamentos/Férias) foi removida — os 3 links apontavam para
  `/hr/employees/:id` (rota legacy sem relação real com essas áreas,
  reportado pelo utilizador como "leva para um lugar errado"); nenhuma
  dessas áreas tem hoje uma página própria para linkar a partir daqui.
- `EmployeeDocumentsTab` → dossiê (Mockup 03): upload drag-and-drop,
  substituir/remover/ver histórico de versões por documento, alertas,
  histórico documental recente. Aceita agora `initialCategory` (prop nova)
  — pré-seleciona a categoria e corrige o checkbox "Obrigatório" assim que
  `listDocumentCategories` resolve.
- `EmployeeHistoryTab` → histórico de auditoria paginado.
- `EmployeeDrawer` → formulário criar/editar colaborador (reutilizado nos
  dois modos).
- `components/Avatar` / `components/AvatarUpload` → avatar com fallback de
  iniciais (mesma convenção visual de `financial-base`'s `SupplierDetailView`).
  `AvatarUpload` combina 2 ações distintas: clicar no círculo expande a
  foto (lightbox, `fixed inset-0`, fecha ao clicar no fundo — `stopPropagation`
  no `<img>` para não fechar ao clicar na própria foto); "Alterar foto"
  (link de texto) abre o seletor de ficheiro.
- `OverviewView` (RH-01) → Visão Geral: 3 grupos de KPI cards (Equipa/
  Operação hoje/Pendências), cada um a ler o seu `BlockResult` próprio
  (nunca mostra `0` quando `status: "unavailable"`), painel de Alertas
  prioritários e painel **"Hoje na operação"** (task "Melhorar Hoje na
  operação"). Atualiza a cada 60s (`refetchInterval`). Cards de KPI que
  não são pendências continuam a linkar diretamente (`to`, `Link`) — ex:
  "Funcionários ativos" → `/hr/people`, "Turnos por conferir" →
  `/hr/overview/shifts-to-review`. Os 3 cards de **pendência** ("Dados
  incompletos", "Documentos em falta" — novo — e "Documentos a expirar")
  passam a abrir o `PendencyDrawer` (`onClick`, não `to`) em vez de
  navegar — task "Melhorar Visão Geral e reorganizar Pessoas", secção 6:
  "abrir primeiro um drawer lateral, sem sair da Visão Geral".
- `PendencyDrawer` (novo) → painel sobreposto à direita (overlay + `role="dialog"`,
  mesmo padrão visual de `ShiftReviewModal`) que explica uma pendência sem
  sair da Visão Geral. Reaproveita `api.getKpis()` (a MESMA `queryKey`
  `["hr-people-kpis"]` que "Pessoas" já usava) e filtra
  `priorityPendencies` pelo `kind` correspondente ao card clicado — nunca
  uma 2ª agregação. Estado do drawer vive no URL (`?panel=missing-
  fields|missing-documents|expiring-documents`) — Back funciona, refresh
  preserva o contexto, é deep-linkável (secção 13). Cada linha de
  colaborador abre o perfil (`/hr/people/:id`); para pendências
  documentais, quando o registo tem `expiresAt`, mostra "Expira em N
  dias". Botão "Ver todos em Pessoas" leva à aba certa já filtrada
  (Colaboradores para dados incompletos; Documentos, com `?status=`, para
  as 2 pendências documentais).
  - **"Hoje na operação"** — colunas Funcionário | Estado | Turno hoje |
    Situação | Local, dentro de um contentor com `max-h-80 overflow-y-auto`
    (cabeçalho `sticky`) — o backend já não corta a lista a 5 linhas, por
    isso é o próprio painel que ganha scroll interno em vez de esticar a
    página (pedido explícito: não alterar o resto do layout da Visão
    Geral). `state` vem já traduzido do backend
    (`OperationStateBadge`/`OPERATION_STATE_LABELS` só fazem cor+rótulo em
    PT, uma badge por estado). Clicar no **nome** navega para
    `/hr/schedules?employeeId=...` (a escala desse colaborador, não mais
    o perfil — pedido da task "abrir Turnos/Assiduidade"). Clicar na
    **situação** de uma linha com `reviewShiftId` faz `api.getShiftToReview`
    e abre `ShiftReviewModal` diretamente (mesmo modal já usado por
    `ShiftsToReviewView`) — o `locationId` cru (bug do print do
    utilizador) foi substituído por `locationName`, já resolvido pelo
    backend.
  - **"Hoje na operação refinado"** (task do mesmo nome) — o nome mostrado
    é um nome curto (`computeShortNames()`: 1º + último nome, ou 1º + 2º +
    último quando 2+ linhas colidem no mesmo nome curto), com o nome
    completo sempre disponível no `title` (tooltip); o texto do botão
    continua a navegar para a escala, como antes. Quando a linha tem
    `situationWarning` (ex: "1º turno sem entrada"), aparece uma 2ª linha
    menor, prefixada com "⚠" (nunca só cor), abaixo da Situação — clicável
    para a escala do colaborador quando a linha não tiver já um
    `reviewShiftId` a abrir a conferência (as duas ações nunca competem na
    mesma linha).
- `ShiftsToReviewView` (RH-01) → drill-down "Turnos por conferir": tabs de
  prioridade com contagem, filtros (pesquisa/local — **sem** filtro de
  responsável, sem fonte real), tabela, paginação server-side.
- `ShiftReviewModal` (RH-01) → conferência de turno: reaproveita a forma do
  `AttendanceConferenceModal.tsx` legacy (estado/horas reais/minutos de
  atraso/notas), acrescenta um painel de análise (diferença entrada/saída,
  duração, tolerância, estado computado) e histórico de ocorrências —
  calculados localmente (funções puras, não importa lógica do backend).
  Confirmar chama a mesma rota legacy `PATCH /api/hr/shifts/:id/attendance`.
  Reutilizado agora por dois pontos de entrada: `ShiftsToReviewView` (a
  fila paginada) e `OverviewView` (drill-down direto por `shiftId`, via
  `api.getShiftToReview`) — o componente em si não sabe qual dos dois o
  abriu, recebe sempre o mesmo `ShiftToReview` já carregado.
- `components/SeverityBadge` (RH-01) → Crítica/Alta/Média/Baixa, sempre
  texto + ícone + cor (nunca só cor).
- `DocumentCategoriesModal` → CRUD das categorias de documento
  configuráveis (nome, obrigatória, cargo(s), tipos de ficheiro aceites) —
  aberto por um botão em `PeopleDocumentsView` (mudou-se de
  `PeopleListView` para aqui — task "Melhorar Visão Geral e reorganizar
  Pessoas", secção 4: "categorias de documentos" é gestão documental, não
  gestão de colaboradores). Desativar (nunca apagar) para de exigir/
  sugerir a categoria sem tocar nos documentos já enviados nela.
- `AttendanceView` (Fase 2 "Assiduidade, Correções, Ausências e Fecho
  Mensal"; **reduzida a 2 tabs** pela task "Simplificar Assiduidade em
  Conferência + Fecho Mensal") → substitui `src/pages/hr/HrReportPage.tsx`
  (legacy, deixado órfão de rota). Rota `/hr/assiduidade`
  (`/hr/relatorio` antigo passa a `<Navigate replace>` para lá). Só
  **Conferência** e **Fecho mensal** — "Por colaborador" deixou de ser
  uma aba própria (absorvida por Fecho mensal) e "Horas & saldos" foi
  removida por completo (redundante com o que já aparece nas outras 2,
  task secção 20; nunca chegou a sair de "em construção"). Seletor de mês
  (`?year=&month=`) e "⚙ Configurar regras" continuam no cabeçalho. O
  antigo grid de 6 `KpiCard` deu lugar a uma linha compacta só na aba
  Conferência: "N por conferir · N possíveis ausências · N sem saída · N
  conflitos" (task secção 3 — nunca cards). A aba Conferência mantém os 2
  filtros primários empilhados (**Por conferir | Resolvidos | Todos**,
  `reviewStatus`) e os chips por `occurrenceKind`, atalhos de data,
  pesquisa por nome e filtro de local, tal como antes — só a
  apresentação do resumo no topo e o nº de tabs mudou. Clicar em
  "Resolver"/"Ver" abre `AttendanceIssueResolutionModal`. **Redesign do
  Fecho Mensal**: a pesquisa da Conferência (`search`) passou a aceitar
  um valor inicial via `?q=` — usado pelo link "Ver conferência
  completa" da nova `AttendanceEmployeeDetailView` para pré-preencher o
  nome do colaborador (`?tab=conferencia&q=<nome>`); `locationId`
  também passou a ser passado como prop (com o respetivo setter) para
  `AttendanceMonthlyClosureView`, que ganhou o seu próprio seletor de
  loja em vez de só herdar o valor.
- `AttendanceIssueResolutionModal` (Fase 2.1, substitui
  `AttendanceIssueDetailPanel` — painel lateral fixo vira modal, seguindo
  o mockup) → "Planeado/Registado" + diferença + 3 tabs internas (Ação/
  Observações/Histórico). 5 ações do gestor (`keep_as_is`/`fix_times`/
  `justify_no_impact`/`mark_absence`/`remove_marking` — substituem o
  conjunto mais granular da Fase 2, ver Decisões de design), cada uma com
  um aviso curto da consequência. O botão de submissão só ativa depois de
  o campo "Motivo" ter texto (nunca opcional, task secção 12). Também
  reaproveitado, sem alterações de lógica, pela ficha individual
  (`AttendanceEmployeeDetailView`) — nunca 2 fluxos de resolução; ganhou
  mais uma invalidação (`["hr-attendance-employee-detail"]`) para que a
  lista de pendências dessa página se atualize assim que uma é
  resolvida, sem precisar de recarregar.
- `AttendanceRulesModal` (Fase 2.1) → "⚙ Configurar regras" no cabeçalho
  de `AttendanceView`. 3 tabs: Regras gerais (5 tolerâncias/janelas em
  minutos + "Início do controlo de assiduidade" + caixa "Exemplo
  prático", calculada localmente só como preview de UI), Aplicação
  (texto estático — task proíbe regras por colaborador/função/local
  nesta fase), Histórico de alterações (`AttendanceRuleChangeEntry[]` —
  só os 5 campos numéricos, `controlStartDate` não entra nesse
  histórico, ver README do backend).
- `AttendanceMonthlyClosureView` (substitui `AttendancePeopleSummaryView`
  + `MonthlyClosureBar` numa só aba — "nunca 2 fluxos de resolução
  distintos") → aba "Fecho mensal". **Redesenhada por completo** pela
  task "Redesign completo do Fecho Mensal" (a versão anterior tinha 11
  colunas e reaproveitava muito da estética "cheia de cards" da
  Conferência — a task pediu uma hierarquia mais executiva, ver Decisões
  de design): resumo compacto do período (nome do mês, "N colaboradores
  · N prontos · N com pendências", barra de progresso fina, badge de
  estado) + filtro Todos/Prontos/Com pendências + pesquisa + seletor de
  loja (**novo** — antes só herdava o filtro de loja da Conferência sem
  ter controlo próprio) + tabela de **8 colunas** (Colaborador com
  cargo por baixo do nome/Conferência/Planeado/Realizado/Ocorrências/
  Saldo/Estado/Ação — reduzida das 11 anteriores, "Pendências"/"Dias
  atraso"/"H. atraso"/"Ausências" fundidas numa única célula
  "Ocorrências"). O ratio "Conferência X/Y" e a célula "Ocorrências" são
  só reapresentação de campos que já existiam
  (`plannedShiftsCount - pendingCount`, `absenceDaysCount`/
  `lateDaysCount`/`lateMinutesTotal`) — nenhum endpoint novo. Estado por
  colaborador **colapsado a 2 valores** (`isReady(row) = row.pendingCount
  === 0` → "Pronto"/"Com pendências"), mais um 3º valor visual
  ("Fechado") quando o período inteiro já foi fechado — sobrepõe o
  estado de todas as linhas, já que nesse momento ninguém tem pendências
  por definição (o fecho já as bloqueava). Saldo mostra "Por calcular" +
  "aguarda conferência" enquanto `pendingCount > 0`. "Fechar mês" só
  existe a nível do período inteiro (nunca um botão por colaborador),
  desativado enquanto `blockerCount > 0` com `title` explicando o
  motivo, e pede confirmação (`window.confirm`) antes de executar.
  "Reabrir período" reaproveita a UX inline (input de motivo +
  confirmar/cancelar) que já existia em `MonthlyClosureBar`. Bordas
  `border-[#F5C992]/40` (âmbar, usadas em quase todo o resto do módulo)
  trocadas por `border-stone-200` **só nesta view** — pedido explícito
  do utilizador ("bordas amarelas em praticamente todos os elementos"),
  deliberadamente não propagado a `AttendanceView`/Conferência (fora do
  âmbito da task, evita mudar o visual de uma área que não foi pedida).
- `AttendanceEmployeeDetailView` — rota
  `/hr/assiduidade/colaborador/:employeeId?year=&month=`. **Reescrita
  por completo** pela mesma task: a versão anterior mostrava o extrato
  diário completo do mês (9 KPIs, filtros
  Todos/Pendentes/Atrasos/Ausências/Conferidos, todas as linhas
  incluindo "Regular") — praticamente uma cópia da Conferência, só que
  filtrada a um colaborador. A task pediu que esta página responda só
  "o que falta resolver para fechar este colaborador?": breadcrumb
  (Assiduidade / Fecho mensal / Nome) + "← Voltar ao fecho mensal";
  **1 card "Resumo do mês"** subdividido (Planeado/Realizado/Saldo +
  "N turnos conferidos" + "N ausências · N atrasos" — nunca 9 cards
  separados); **lista só das pendências**
  (`rows.filter(reviewStatus === "pending")`, nunca as linhas
  "Regular" — mesma chamada `getEmployeeAttendanceDetail` de sempre, só
  filtrada de outra forma, sem endpoint novo), com paginação simples
  ("Ver mais N pendências ↓" a partir de 8 linhas) e coluna "Tipo"
  (badge derivado de `occurrenceKind`, nova função local
  `OCCURRENCE_TYPE_LABEL`); "Ver conferência completa →" que leva a
  `/hr/assiduidade?tab=conferencia&q=<nome>` (novo parâmetro `?q=` lido
  por `AttendanceView` como valor inicial da pesquisa — ver abaixo).
  Quando não há pendências: banner "✓ Conferência concluída — pronto
  para fechar" + botão que volta ao Fecho mensal geral — **nunca** um
  "Fechar mês do colaborador" que fingisse uma ação real (decisão
  tomada com o utilizador, ver README do backend: não existe nem vai
  existir fecho por colaborador nesta task). Quando o mês inteiro já
  está fechado: estado read-only "✓ {mês} fechado — Fechado por X em
  data", sem lista nem botões. Resolver uma pendência continua a
  reaproveitar o MESMO `AttendanceIssueResolutionModal` da Conferência
  — nunca duplica o workflow.
- `SchedulesView` (RH-03) → página "Escalas & Turnos": tabs "Calendário" /
  "Turnos rotativos" / **"Alertas e ações"** (esta última passou de painel
  lateral fixo a tab própria — pedido do utilizador: liberta a largura do
  calendário quando não há alertas para ver, em vez de reservar sempre
  ~280px de coluna. Sem alertas, a tab mostra "Sem alertas no período
  visível.", igual ao que já acontecia no painel); vista Mês (grelha 6
  semanas) e Semana (7 dias), navegação anterior/hoje/seguinte, filtro por
  colaborador/loja, legenda de estados, botão "+" por dia para criar turno
  ali. Na vista Semana, um botão **"Ações da semana ▾"** ("Repetir escala
  pelo calendário") abre um menu com "Repetir escala" (`RepeatScheduleWeekModal`,
  período por omissão 4 semanas), "Copiar semana (alternar turnos)" (o
  mesmo modal, mas com "Alternar turnos" pré-ligado e período pré-definido
  para 1 semana — ver decisão abaixo) e "Limpar semana" (abre
  `ClearShiftsModal` com `employeeId` = filtro de colaborador ativo, ou
  `null` = todos os colaboradores da semana). Só aparece na vista Semana
  (pedido literal da task: "Não implementar ainda na vista Mês").
  - **Visualização: Detalhada | Compacta** (task "Visualização Detalhada e
    Compacta") — seletor ao lado de Mês/Semana, funciona nas duas vistas,
    preferência guardada em `localStorage` **separadamente por Mês e por
    Semana** (`hr-schedules-visual-mode-{month|week}`). **Detalhada**
    (por omissão) é o calendário de sempre: célula de dia com turnos
    (nome + bolinha de estado + horário) + ausências sobrepostas (cor por
    tipo) + feriado — um turno com 2º período (repartido) mostra os dois
    horários na mesma linha, separados por `|`, cada um com a sua própria
    bolinha (corrigido um bug em que só o 1º horário aparecia — pedido
    explícito do utilizador). **Compacta** mostra, por dia: contagem de
    escalados/ausências/conflitos, até 2 turnos resumidos e "+N mais";
    clicar num dia (a célula inteira é clicável nesta vista, nunca na
    Detalhada) abre o painel **"Resumo do dia"** (`DaySummaryPanel.tsx`) à
    direita — o calendário volta a 100% da largura assim que o painel
    fecha (`grid-cols-1` sem coluna reservada, nunca espaço vazio). Trocar
    de vista preserva filtros/local/data selecionada; sair da Compacta
    fecha o painel. A vista Compacta só corta a exibição, nunca o
    carregamento — os turnos "escondidos" pelo "+N mais" não chegam a ser
    montados no DOM (`slice(0,2)` antes do `.map`), evitando renderizar
    centenas de cartões só para os esconder.
  - `DaySummaryPanel` — data, 3 números (Escalados/Conflitos/Ausências,
    "Escalados" conta colaboradores únicos, nunca períodos), lista **1
    item por colaborador nesse dia** (task "Consolidar turnos repartidos
    no Resumo do dia" — `consolidateByEmployee()` junta todos os períodos
    de todos os turnos do colaborador nesse dia, quer venham de 1 registo
    repartido, quer de 2+ turnos avulsos, nunca duplica a linha), com
    local resolvido (só uma vez quando todos os períodos partilham o
    mesmo local; um por período quando não), badge "Turno repartido"
    quando há 2+ períodos sem sobreposição, ou "⚠ Conflito de horário"
    (nunca ambos) quando há. Aviso "N conflito(s) detetado(s)" a nível do
    dia (KPI, fonte diferente — ver decisão de design abaixo) continua
    quando aplicável. 2 ações: "Abrir dia" (muda para a vista Semana
    ancorada nesse dia) e "Editar escala" (abre o `ShiftDrawer` em modo
    criação para esse dia — não existe hoje um "editor de dia inteiro",
    esta é a ação mais próxima já suportada). Nunca muta dados ao abrir;
    clicar num colaborador com **1 só turno** (o caso comum, incluindo
    repartido de 1 registo) abre o `ShiftDrawer` de edição normal; com
    **2+ turnos avulsos** abre antes "Abrir dia" (o `ShiftDrawer` só edita
    1 registo de cada vez — mostrar todos os períodos passa pelo
    calendário da semana, não por um editor multi-turno que não existe).
    Os cartões de alerta
  (cobertura/sobreposição/turnos por publicar) mostram-se agora numa
  grelha responsiva (1-3 colunas) em vez de empilhados numa coluna
  estreita — cabem mais por linha com a largura toda disponível. "Atribuir
  turno →" num alerta de cobertura muda para a tab "Calendário" e abre logo
  o `ShiftDrawer` nessa data (antes bastava abrir o drawer, já estava tudo
  na mesma tela). Clicar num turno abre o `ShiftDrawer` já
  em modo edição — decisão deliberada: **não há menu de contexto
  "ver/editar/duplicar" separado** (o mockup pede um); duplicar/apagar
  vivem dentro do próprio drawer de edição, um clique a mais mas um
  componente a menos. Lê `?employeeId=`/`?date=` da URL (`useSearchParams`)
  para pré-filtrar o filtro de colaborador/a data-âncora ao abrir — usado
  pelo clique no nome em "Hoje na operação" (Visão Geral), mas serve
  qualquer outro ponto de entrada futuro que queira abrir já filtrado.
- `ShiftDrawer` → criar/editar turno: colaborador (só na criação),
  data/horas/loja/pausa/notas, tipo de turno (direto/repartido, com 2º
  período) + "Termina no dia seguinte" (turno noturno), "publicar após
  guardar", e em modo edição, "duplicar para…" + "apagar turno" (com
  confirmação inline). Editar um turno que pertence a uma série
  (`seriesId` não nulo) mostra um seletor de âmbito ("Somente este turno" /
  "Este turno e os seguintes" / "Toda a série") — a data deixa de ser
  editável nos dois últimos âmbitos (o backend não suporta mover datas em
  lote). O checkbox "Repetir semanalmente" (N semanas, mesmo dia da semana)
  foi **substituído** por "Repetir este horário", que abre `ShiftSeriesForm`
  em vez de continuar dentro do próprio drawer (ver abaixo) — pedido
  explícito da task "Novo Turno Padrão Semanal".
- `ShiftSeriesForm` ("Novo Turno Padrão Semanal") — o formulário de padrão
  semanal recorrente: uma ou mais regras "dias da semana + horário" (turno
  direto ou repartido, "+ Adicionar outro horário" para dias com horários
  diferentes), modo de repetição (só esta semana/N semanas com atalhos
  1-4/até uma data), botão "Pré-visualizar" que chama
  `api.previewWorkShiftSeries` e mostra a contagem
  (disponíveis/conflitos/ignorados) + uma lista de ocorrências com estado
  por cor, e só depois disso os botões "Guardar rascunho"/"Criar N
  turnos" ficam ativos — qualquer alteração ao formulário invalida o
  preview anterior, forçando pré-visualizar de novo antes de criar (garante
  que o que se cria é sempre o que se pré-visualizou). Com conflitos, um
  checkbox opcional "Criar também os N em conflito" ativa `force: true` —
  nunca ultrapassa férias/ausência/feriado, essas continuam sempre
  ignoradas.
- `ClearShiftsModal` — "Limpar turnos" em lote (âmbito Dia ou Semana para
  o colaborador do filtro ativo; para limpar uma série inteira, o ponto de
  entrada é "Limpar toda a série" dentro do `ShiftDrawer`, ao editar um
  turno dessa série), sempre com um passo de confirmação explícito antes
  de apagar — o passo de confirmação mostra literalmente "Tens a certeza
  que queres limpar a escala? Os turnos serão apagados permanentemente."
  (pedido explícito do utilizador). Desde "Repetir escala pelo
  calendário", `employeeId` é opcional: `null` limpa a semana toda para
  **todos** os colaboradores (âmbito colapsa só para "Semana" nesse caso —
  "Um dia" só faz sentido por colaborador), respeitando o filtro de loja
  ativo no calendário quando presente.
- `RepeatScheduleWeekModal` ("Repetir escala pelo calendário") — copia os
  turnos reais da semana visível (não um formulário — o que já está
  montado no calendário) para as semanas seguintes: "Semana inteira" ou
  "Dias selecionados" (picker de dias da semana), lista de colaboradores
  encontrados na semana de origem (todos selecionados por omissão, dá para
  desmarcar), período (1-4 semanas com atalhos, personalizado, ou até uma
  data), botão "Pré-visualizar" que chama `api.previewRepeatCalendarWeek`
  e mostra o destino real (`targetStartDate → targetEndDate`), a contagem
  agregada (previstos/conflitos/ignorados) e por colaborador, mais uma
  lista combinada de ocorrências (data + colaborador + horário + estado) —
  qualquer alteração ao formulário invalida o preview, forçando
  pré-visualizar de novo antes de criar. Checkbox "Criar também os N em
  conflito" (`force`), nunca ultrapassa férias/ausência/feriado. Busca os
  colaboradores da semana através de uma query própria
  (`hr-work-shifts-week-actions`) que ignora os filtros de
  colaborador/loja do calendário — repetir a escala nunca deve ficar
  limitado ao filtro que por acaso está ativo no ecrã. Checkbox **"Alternar
  turnos entre os colaboradores selecionados"** (`rotateEmployees`) — em
  vez de cada colaborador repetir o seu próprio horário, cada um passa a
  receber o horário do seguinte na lista (2 colaboradores = troca simples;
  mostra "Ordem da troca: A → B → A" para nunca ser ambíguo qual troca com
  qual); exige ≥2 colaboradores selecionados. É o que dá um propósito
  próprio a "Copiar semana" (`defaultRotate`), que antes fazia
  exatamente o mesmo que "Repetir escala".
- `BaseScheduleModal` → grelha de 7 células (Seg..Dom) por colaborador,
  edição inline por célula (Folga ou horário+loja), "Aplicar esta escala à
  semana" com checkbox opcional "sobrepor turnos já editados manualmente".
- `ShiftRotationsPanel` → separador dentro de `SchedulesView` (não uma rota
  própria — pedido explícito da task): criar rotação (função, 2
  colaboradores elegíveis dessa função, Turno A/B — cada um com o seu
  próprio toggle "Direto"/"Repartido" e 2º período independente —, loja,
  data de início), tabela de rotações mostrando o horário completo de cada
  padrão (`formatPattern`, inclui o 2º período quando existe), pré-visualizar
  (2 semanas, agora com o horário real de cada padrão, não só o nome de
  quem o faz — pedido explícito do utilizador)/aplicar/pausar-retomar.

### Saída

- `HttpHrApiAdapter` → `/api/hr/people*` (RH-02) + `/api/hr/overview*`
  (RH-01) + `/api/hr/schedules*` (RH-03) + `/api/hr/attendance/*`
  (Fase 2 + 2.1, incluindo `rules`/`rules/history`/`summary`, ver Known
  gaps) + `PATCH /api/hr/shifts/:id/attendance`, `GET /api/hr/leave/overview`,
  `GET /api/hr/leave/holidays` (rotas legacy, chamadas diretamente — nunca
  importa `src/pages/hr/hrApi.ts`) + `PATCH /api/hr/employees/:id/kiosk-pin`
  (legacy, `setEmployeeKioskPin`) + `/api/hr/payslips/import*` (ticket 10).

## Decisões de design

### Coexistência com o legacy `src/pages/hr/*`

As tabs "Turnos" e "Pagamentos" saem do novo perfil — o Resumo mostra só
3 cards leves ("Turnos"/"Pagamentos"/"Férias") que linkam para
`/hr/employees/:id`, a página legacy intacta, onde essas áreas continuam
totalmente funcionais. Evita duplicar lógica que a própria task RH-02 diz
explicitamente não ser âmbito desta mudança.

### Sem "Solicitar atualização" nem "Gerar dossiê"

O Mockup 02 mostra estes dois botões no cabeçalho do perfil — omitidos
nesta fase por não terem endpoint correspondente no backend. Preferível a
simular um botão que não faz nada.

### Base Organizacional — Colaboradores, Cargos e Local principal

- **Pessoas → Colaboradores** (menu, títulos, breadcrumbs); abas **Lista |
  Cargos | Documentos**. As rotas mantêm-se (`/hr/people`,
  `/hr/people/documentos`; nova `/hr/people/cargos`) — nenhum deep-link
  parte.
- **Cargos** (`PositionsView`, `usePositions`/`useManagePositions`):
  criar/editar/ativar/inativar, nº de colaboradores ativos; nunca apagar;
  `hr_viewer` só lê. Nome duplicado ("preparador" = "Preparador") vem do
  backend como 409. Cargo ≠ permissão.
- **Função → Cargo no formulário** (`EmployeeDrawer`): o seletor "Função"
  passou a "Cargo" (obrigatório); o `jobRole` deixa de ser enviado — o
  backend deriva-o da categoria operacional do cargo (D4). Escalas e
  Assiduidade continuam a mostrar a categoria (`JOB_ROLE_LABELS`) — não
  são alteradas nesta fase.
- **Local principal + outros locais autorizados** no formulário, na Lista
  (coluna + filtro "Local", só quando há mais de um local) e no perfil.
  Só se oferecem cargos/locais ativos, mais o valor atual mesmo que
  inativo (`assignableOptions`) — mesma regra do backend. Os nomes
  resolvem-se no cliente (`positionNameOf`/`locationNameOf`) a partir de
  `usePositions` e do `useLocations` global.
- **Âmbito das categorias** (ticket 03): `DocumentCategoriesModal` tem
  "Âmbito" (Colaborador / Empresa / Ambos); numa categoria só da Empresa os
  campos Obrigatório e Cargos não se aplicam. As categorias são as mesmas
  da aba Empresa & Estrutura → Documentos (módulo `documents`).
- **Recibos de vencimento** (ticket 10): categoria periódica
  (`requiresPeriod`, definida pelo backend). No perfil, escolher "Recibo
  de vencimento" troca "Obrigatório" por **Período** (Mês/Ano) e a
  categoria continua disponível depois do 1.º envio (um por período). Um
  recibo já existente no período (409 `period_already_exists`) mostra
  "Já existe um recibo deste colaborador para este período." com
  **Cancelar** / **Substituir versão** — nunca duplica. Na importação em
  massa, só os "Identificado" são gravados sem intervenção: "Rever" exige
  escolher o colaborador e "Já existe" exige escolher Substituir versão;
  o mesmo colaborador duas vezes no lote bloqueia a confirmação. Só admin
  (dados salariais).
- **Resumo do perfil**: "Dados do perfil: X% completos" (só dados
  cadastrais — documentação conta à parte) e **sem card nem KPI de
  Onboarding** (não existe workflow de onboarding — task §19/§20).

### Categorias/contagens que o mockup mostra mas o backend não calcula

Sem "+N vs. mês anterior" nos KPIs, sem contagem entre parênteses no badge
de documentos da lista, sem checklist de onboarding granular — todos
dependem de dados que o backend ainda não persiste (ver README do módulo
`hr` no backend, secção "Known gaps").

### PIN de Kiosk no perfil (aba "Dados pessoais")

Cartão "PIN de Kiosk" em `EmployeeProfileView`, só visível para
`useAuth().user.role === "admin"` (o backend também exige admin). Abre um
modal com PIN de 4 dígitos; colisão devolve "Este PIN já está em uso por
outro funcionário", mostrado no modal. **Limitação**: o `Employee` do novo
módulo `hr` do backend não expõe `hasKioskPin`, por isso o cartão não sabe
se já existe PIN ao abrir — só mostra "PIN configurado" após definir na
sessão atual. Quando o backend expuser o campo, ler dele.

## Como testar

- `npx tsc --noEmit -p tsconfig.app.json` e `npx eslint src/modules/hr`.
- `npx vitest run src/modules/hr` (`SetEmployeeKioskPinUseCase`, Cargos,
  aplicabilidade de documentos e importação de recibos).
- Teste manual: as migrações do backend já foram todas aplicadas e
  confirmadas na BD real (2026-09-27) — falta só o acesso a um browser
  nesta sessão para o fazer.

### RH-01 — cards sem destino real ficam sem link

"Ver agenda completa" nunca aparece — não existe essa rota.
"Escalados/Presentes/Atrasos/Ausentes hoje" linkam para `/hr/calendar`,
mas essa página legacy não aceita parâmetros — o link não pré-filtra
nada, só abre a fonte. **"Pagamentos pendentes" foi removido** (task
"Simplificar Assiduidade em Conferência + Fecho Mensal", secção 22): já
não era clicável (não existe página de lista global de pagamentos, só
por colaborador, dentro do perfil) e a task pediu removê-lo sem
substituir por outro card — não há lógica de payroll implementada neste
módulo.

### RH-01 — tolerância de atraso duplicada como constante local

`LATE_TOLERANCE_MINUTES = 10` está replicado no `ShiftReviewModal` (mesmo
valor do backend) só para exibição — não há endpoint para ler constantes
de domínio. Se o valor mudar no backend, tem de mudar aqui também.

### RH-03 — turnos com retângulo colorido por colaborador + filtro por badge + Exportar PDF (paridade com o legacy)

A primeira versão de `SchedulesView` desenhou os turnos como uma linha
simples com bolinha+nome+hora, e o filtro de colaborador como um `<select>`
— pedido do utilizador para reverter à identificação visual do calendário
legacy (`HrCalendarPage.tsx`): cada colaborador tem uma cor pastel
consistente (`PALETTE`, mesmas 8 cores/ordem do legacy, atribuída por
`colorById` = ordem alfabética dos ativos), o turno é um retângulo com essa
cor de fundo, e o filtro passa a ser badges coloridos clicáveis (mesma cor
do colaborador) acima do calendário, com "Todos" a limpar o filtro — em vez
do dropdown. O nome mostrado no retângulo é só **primeiro nome + primeiro
apelido** (`shortName()`), nunca o nome completo — cabe sempre no
retângulo, ao contrário do legacy (que trunca com "…" quando o nome tem 3+
partes). O botão "Exportar PDF" também volta, reaproveitando
`exportGeneralSchedulePdf` (`src/utils/schedulePdf.ts`, o mesmo motor
jsPDF/autoTable do legacy) através de 3 funções de mapeamento
(`toLegacyEmployee`/`toLegacyShift`/`toLegacyLeave`) que só preenchem com
significado real os campos que essa função efetivamente lê (`id`,
`fullName`, `workDate`, `startTime`, `endTime`, `employeeId`,
`attendance?.status`, datas de férias) — o resto fica com placeholders
inofensivos, já que a função nunca os lê. Reutiliza a ferramenta de
formatação PDF, não o serviço/API legacy.

### RH-03 — sem menu de contexto "ver detalhe/editar/duplicar"

O mockup pede um menu de 3 ações ao clicar num turno. Implementado como um
único clique que abre o `ShiftDrawer` já em modo edição (que já tem
"duplicar para…" e "apagar" dentro de si) — um componente a menos, um
clique extra para duplicar/apagar. Se o volume de turnos crescer muito e
isto se tornar lento na prática, vale a pena reconsiderar.

### "Novo Turno Padrão Semanal" — "padrão da semana" como lista de regras, não uma grelha de 7 linhas

O documento de referência mostra 2 fluxos: um horário único repetido (Seg/
Qua/Sex às 09h-17h) e uma "semana completa" com uma linha por dia da semana,
cada uma com o seu próprio horário. Em vez de construir duas UIs distintas
(uma para cada fluxo), `ShiftSeriesForm` usa **uma única representação**:
uma lista de regras "dias da semana + 1-2 períodos", com "+ Adicionar outro
horário" para adicionar mais regras. O caso simples é 1 regra com vários
dias selecionados; o caso "semana completa com horários diferentes" é
várias regras, cada uma com 1 dia (ou um pequeno grupo). Funcionalmente
equivalente ao mockup (mesmo resultado: `N` turnos com os horários certos
em cada dia), só não é uma grelha literal de 7 linhas fixas — decisão de
âmbito para não duplicar formulário/estado, dado o volume do resto da
task. Se o utilizador achar a lista de regras menos intuitiva que a grelha
na prática, vale a pena reconsiderar como um passo isolado.

### "Novo Turno Padrão Semanal" — pré-visualização por lista, não por mini-calendário

O mockup mostra um mini-calendário mensal colorido como pré-visualização.
`ShiftSeriesForm` mostra antes uma lista cronológica (data + horário(s) +
estado, com uma bolinha colorida por estado) — a mesma informação, sem
construir um segundo componente de calendário só para isto (o calendário
principal de `SchedulesView` já é bastante específico ao seu próprio
layout de mês/semana para ser reaproveitado diretamente aqui). Cobre a
mesma necessidade funcional (ver cada ocorrência e o seu estado antes de
confirmar); é uma simplificação visual, documentada aqui para não passar
por descuido.

### "Novo Turno Padrão Semanal" — sem chave de idempotência dedicada no cliente

O botão "Criar N turnos" desativa-se assim que a mutação fica pendente
(`createMutation.isPending`), o que já cobre o caso mais comum de
duplo-clique acidental. Não há, além disso, nenhum mecanismo de
deduplicação do lado do cliente (ex: token gerado localmente) — a rede de
segurança final é a deteção de sobreposição do próprio backend (ver README
do backend, mesma secção): um reenvio acidental do mesmo pedido reporta os
turnos já criados como `conflict`, nunca duplica.

### "Melhorar Hoje na operação" — scroll interno em vez de paginação

O backend já não corta a lista (ver README do backend) — mas o pedido
explícito do utilizador foi "não alterar a formatação da página, a nova
informação precisa caber no pequeno espaço do quadrante". Em vez de
paginação (que exigiria estado extra e botões dentro de um painel já
apertado), o quadro ganhou `max-h-80 overflow-y-auto` com cabeçalho
`sticky` — cabe sempre no mesmo espaço visual, e continua a mostrar a
equipa toda com scroll, sem esconder ninguém.

### "Melhorar Hoje na operação" — clique no nome vai para a escala, não para o perfil

Antes deste pedido, o nome do funcionário em "Hoje na operação" abria
`/hr/people/:id` (o perfil). A task pede explicitamente "abrir Turnos/
Assiduidade" ao clicar no nome — mudou-se o destino para
`/hr/schedules?employeeId=...`, a página de escalas já filtrada por esse
colaborador. Perder o link direto ao perfil a partir daqui foi uma escolha
deliberada: o utilizador ainda chega ao perfil pela lista `PeopleListView`
normal, e o pedido explícito era sobre turnos, não cadastro.

### "Melhorar Hoje na operação" — drill-down de conferência não passa pela lista paginada

Clicar numa situação com "Requer conferência" chama
`api.getShiftToReview(shiftId)` e abre `ShiftReviewModal` diretamente —
não navega para `/hr/overview/shifts-to-review` nem tenta pré-filtrar essa
vista por URL (essa vista, hoje, não lê nenhum parâmetro da URL — ver
README do backend, mesma decisão documentada dos dois lados). Mais
simples e mais rápido para o utilizador (1 clique, sem esperar uma lista
paginada carregar só para abrir 1 item dela).

### "Hoje na operação refinado" — nome curto usa a mesma convenção de `SchedulesView`/`DaySummaryPanel`, com desambiguação

`computeShortNames()` calcula 1º + 2º nome para cada linha visível — a
mesma regra já usada por `shortName()` em `SchedulesView.tsx`/
`DaySummaryPanel.tsx` (não 1º + último nome, que foi a versão inicial
desta ronda e causava exatamente o problema que se queria evitar: o mesmo
colaborador aparecia com um nome diferente em "Hoje na operação" vs. na
escala, ex: "Gabriel Gomes" na escala e "Gabriel Souza" na Visão Geral,
para um colaborador chamado "Gabriel Gomes Souza"). Só quando 2+ linhas
colidem no mesmo nome curto é que essas linhas específicas ganham também
o último nome. Não tenta encontrar o corte *mínimo* que distingue cada
colisão (ex: 2 colaboradores com o mesmo último nome continuam a colidir
mesmo depois de estendido) — o nome completo está sempre no `title` como
rede de segurança, e o volume de equipa deste painel não justifica um
algoritmo mais elaborado.

### "Hoje na operação refinado" — aviso secundário nunca some por baixo do clique de conferência

Uma linha pode ter, ao mesmo tempo, `reviewShiftId` (abre a conferência) e
`situationWarning` (aviso de inconsistência anterior). Em vez de escolher
só um dos dois destinos para o clique, cada linha do painel trata as duas
ações como independentes: a Situação continua a abrir a conferência
quando `reviewShiftId` existe, e o aviso só ganha o seu próprio clique
(para a escala do colaborador) quando **não** há conferência pendente —
nunca sobrepõe o clique mais urgente (conferir o turno) com um destino
diferente.

### "Melhorar Visão Geral e reorganizar Pessoas" — drawer agrupa por pendência (detalhe), não por colaborador

O mockup da task (secção 7) ilustra o drawer "Dados incompletos" agrupado
por COLABORADOR, com uma lista de campos em falta por baixo de cada nome.
A API (`priorityPendencies`) já agrupa pelo padrão inverso — por
`kind`+`detail` (ex: "Contacto de emergência por confirmar"), com a lista
de colaboradores afetados por baixo — porque é assim que "Pessoas" já
consumia esse endpoint antes desta task (painel "Pendências
prioritárias", agora removido de lá mas com a mesma forma de dados
reaproveitada no drawer). Re-agrupar por colaborador no frontend exigiria
"desagrupar" e voltar a agrupar só para o drawer, sem nenhum ganho de
informação (os mesmos factos, noutra ordem visual) — mantido o
agrupamento por detalhe, que é o que a única fonte de dados já dá.

### "Melhorar Visão Geral e reorganizar Pessoas" — `/hr/people` continua Colaboradores, nunca um redirect

Uma alternativa mais "limpa" seria `/hr/people` redirecionar para
`/hr/people/colaboradores`. Não foi essa a escolha: dezenas de sítios já
linkam para `/hr/people?filtro=valor` (cards da Visão Geral, o próprio
drawer novo, `EmployeeProfileView`) — fazer `/hr/people` deixar de
renderizar a lista quebraria todos esses links ou exigiria propagar query
params através de um redirect. Manter `/hr/people` como a própria rota da
aba Colaboradores custou zero migração e mantém os filtros existentes
(`?status=`, `?profileComplete=`, `?documentSituation=`) a funcionar
exatamente como antes.

### "Melhorar Visão Geral e reorganizar Pessoas" — "Ver" na aba Documentos nunca passa pelo perfil

Para um documento já existente (`ok`/`expiring`/`expired`), "Ver" chama
diretamente `api.getEmployeeDocumentDownloadUrl` e abre o ficheiro numa
nova aba — não navega para o perfil do colaborador só para chegar lá.
Só "Adicionar" (categoria em falta, sem documento nenhum) navega para o
perfil, porque aí genuinamente precisa do formulário de upload completo
(`EmployeeDocumentsTab`), que não se justifica duplicar só para a aba
Documentos.

### "Repetir escala pelo calendário" — reaproveita o mesmo padrão visual/preview de "Novo Turno Padrão Semanal"

`RepeatScheduleWeekModal` segue deliberadamente a mesma linguagem visual e
o mesmo fluxo de `ShiftSeriesForm` (pré-visualizar → invalida com qualquer
alteração → só depois "Guardar rascunho"/"Criar N turnos") — o utilizador
já viu este padrão noutro sítio do mesmo módulo, não precisa de aprender
um segundo. As diferenças ficam só onde o domínio é realmente diferente:
lista de colaboradores a incluir/excluir (não existe em "Novo Turno") e
"Semana inteira"/"Dias selecionados" em vez de um único conjunto de regras
manuais.

### "Repetir escala pelo calendário" — "Ações da semana" só na vista Semana

Pedido literal da task: "Não implementar ainda na vista Mês." A ação
"Repetir escala"/"Copiar semana"/"Limpar semana" sempre opera sobre a
semana **visível** (`mondayOf(anchorDate)`), o que só faz sentido sem
ambiguidade quando a vista já é uma única semana — na vista Mês, "a
semana visível" não é um conceito único (a grelha mostra várias).

### "Visualização Detalhada e Compacta" — reaproveita o `days.map` já existente, sem duplicar a grelha

Em vez de dois componentes de calendário separados, a mesma grelha 7-colunas
(`days.map(...)`, já partilhada entre Mês e Semana) ganhou um `if
(visualMode === "compact") return (...)` logo no início do corpo do
`.map`, devolvendo um JSX diferente para essa célula. Mês+Compacta e
Semana+Compacta saem "de graça" da mesma alteração — não foi preciso
nenhum código específico por combinação vista×visualização, cumprindo a
task ("funciona tanto em Mês quanto em Semana").

### "Visualização Detalhada e Compacta" — sem tabela/campo novo, só leitura do que já existe

"Escalados"/"Ausências"/"Conflitos" no resumo compacto e no
`DaySummaryPanel` são todos derivados de dados **já carregados** para a
página (`shiftsByDate`, `leavesByDate`, e uma nova agregação local
`conflictsByDate` a partir de `alerts.overlaps`, que já vinha de
`getScheduleAlerts`) — zero pedidos novos ao backend, zero N+1 por dia
(pedido explícito da task, secção 11).

### "Consolidar turnos repartidos no Resumo do dia" — badge de conflito e badge de repartido nunca aparecem juntos

Um colaborador com 2+ períodos sobrepostos no mesmo dia é, ao mesmo tempo,
tecnicamente "2+ períodos" (critério do badge "Turno repartido") e um
conflito de horário — mas mostrar os dois badges na mesma linha
comunicaria mal a gravidade (a task ilustra o caso de conflito só com o
aviso, sem o badge neutro de "repartido" ao lado). `hasConflict` tem
prioridade: quando há sobreposição, só aparece "⚠ Conflito de horário";
"Turno repartido" só aparece quando 2+ períodos existem **sem** nenhum
par sobreposto entre si.

### "Consolidar turnos repartidos no Resumo do dia" — consolidação é só de exibição, nunca funde os registos de origem

`consolidateByEmployee()` agrupa `WorkShift[]` num view-model local
(`ConsolidatedEmployeeDay`) — não cria nenhum registo novo nem edita os
turnos existentes (task, secção 10: "não alterar dados existentes
desnecessariamente"). O `shifts: WorkShift[]` original fica sempre
acessível dentro do item consolidado, é o que decide o destino do clique
(1 turno → `ShiftDrawer`; 2+ turnos avulsos → "Abrir dia", ver acima).

### "Visualização Detalhada e Compacta" — "Editar escala" abre criação de turno, não um editor de dia inteiro

Não existe hoje nenhum conceito de "editar o dia todo de uma vez" no
backend nem no resto do frontend — só "criar 1 turno"/"editar 1 turno"/
as ações em lote já existentes (Repetir/Copiar/Limpar semana). O botão
"Editar escala" do `DaySummaryPanel` abre por isso o `ShiftDrawer` em modo
criação pré-preenchido com essa data — a ação mais próxima já suportada,
em vez de inventar um editor de dia que não tem onde persistir.

### RH-03 — ausências/feriados sobrepostos no calendário são só leitura

`listLeaveOverview`/`listPublicHolidays` (rotas legacy) alimentam os pills
de férias/baixa/feriado no calendário novo, mas criar/editar uma
ausência/feriado continua exclusivamente em `/hr/ferias` (legacy) — RH-03
não pediu isso, só pediu mostrá-los "no próprio dia".

### Fase 2 ("Assiduidade, Correções, Ausências e Fecho Mensal") — 3 ficheiros em vez do plano original de mais componentes

O plano inicial previa `AttendanceIssuesList`/`AttendanceIssueDetailPanel`/
`MonthlyClosureBar` como componentes totalmente separados; a lista de
pendências acabou por ficar inline dentro de `AttendanceView.tsx` (só o
detalhe e a barra de fecho justificavam ficheiro próprio, pela
complexidade de estado/mutações) — evita 1 ficheiro extra só para passar
props para baixo sem lógica própria. Se a lista crescer (filtros,
paginação), extrair nessa altura.

### Fase 2 — motivo obrigatório é aplicado no frontend E no backend

`AttendanceIssueDetailPanel` (renomeado `AttendanceIssueResolutionModal`
na Fase 2.1) desativa o botão de submissão enquanto
`reason.trim()` estiver vazio — mas isto é só UX, não segurança: o
backend (`CorrectShiftAttendanceUseCase`) rejeita com
`AttendanceCorrectionReasonRequiredError` de qualquer forma, mesmo que
alguém contorne o frontend. O frontend nunca é a única validação.

### Fase 2 — Resumo mensal/Horas & saldos mostram "em construção", nunca dados incompletos ou zerados

*(Superseded — ver "Simplificar Assiduidade em Conferência + Fecho
Mensal" abaixo. Mantido por contexto histórico: a decisão de nunca
mostrar `0`/`—` como fallback técnico quando uma fonte está
indisponível continua válida noutras partes do módulo, mesmo que estas
2 abas específicas já não existam separadamente.)*

As 2 abas ainda não tinham use case/dados por trás nesta ronda — mostrar
`0`/`—` em todos os campos seria indistinguível de "sem atividade este
mês", enganoso. Preferiu-se um aviso explícito de que a funcionalidade
ainda não existia, seguindo a mesma regra já usada noutras partes do
módulo.

### "Simplificar Assiduidade em Conferência + Fecho Mensal" — 2 abas em vez de 3, "Horas & saldos" removida, não adiada

A task seguinte já tinha o "Resumo mensal" implementado (Fase 2.1, como
"Por colaborador") quando pediu explicitamente reduzir Assiduidade a só
2 abas: fundir "Por colaborador" dentro de "Fecho mensal" (nunca 2
fluxos de resolução para o mesmo colaborador, secção 6) e **remover**
"Horas & saldos" por completo — não adiar para outra ronda, a própria
task considera-a redundante com o que já aparece nas outras 2 (secção
20). Por isso `AttendancePeopleSummaryView.tsx` e `MonthlyClosureBar.tsx`
foram apagados (a lógica de ambos foi absorvida por
`AttendanceMonthlyClosureView.tsx`, ver Components acima) em vez de
ficarem órfãos como `HrReportPage.tsx`/`HrEmployeesPage.tsx` — não havia
nenhuma rota nem link a apontar para eles fora do próprio
`AttendanceView.tsx`, que também deixou de os importar.

### Fase 2.1 ("Regras de Assiduidade, Tolerâncias e Conferência") — contrato implementado no backend na mesma sessão

O contrato foi inicialmente desenhado sem acesso ao backend (campos
opcionais, degradação para "Indisponível"). Numa sessão seguinte, o
caminho do backend foi confirmado e todo o contrato foi implementado lá
(classificador de tolerância, `hr_attendance_rules`, `hr_attendance_corrections`
com o novo `AttendanceCorrectionType`) — os campos
`occurrenceKind`/`diffMinutes`/`reviewStatus` em `AttendanceIssueRow` e os
KPIs de tolerância voltaram a ser **obrigatórios** nos tipos (o backend
calcula-os sempre, mesmo sem nenhuma regra configurada — usa defaults).
Só as 2 migrações SQL (`hr_attendance_rules`/troca do CHECK constraint de
correções) ficam pendentes de aplicação manual no Supabase — até lá, só
"Configurar regras" mostra "Indisponível" (única tela que precisa mesmo
de ler/escrever `hr_attendance_rules` diretamente). A Conferência, "Por
colaborador" e a ficha individual **não** dependem dessas migrações —
o backend tem `.catch(() => [])` nas chamadas novas em TODOS os use
cases que as usam (ver README do backend, corrigido depois de uma
regressão real ter sido detetada só em "Por colaborador").

### Fase 2.1 — novo conjunto de ações de correção substitui o anterior

`AttendanceCorrectionType` passa de 6 valores granulares
(`add_entry`/`add_exit`/`fix_entry`/`fix_exit`/`confirm`/`observation`)
para 5 que batem com o mockup de resolução (`keep_as_is`/`fix_times`/
`justify_no_impact`/`mark_absence`/`remove_marking`) — `fix_times` cobre
entrada e saída num único fluxo (os 2 campos de hora, preenche-se só o
que se corrige) em vez de 4 ações separadas. Mudança de contrato aceitável
porque não há consumo deste tipo fora deste módulo.

### Fase 2.1 — Conferência muda de mestre-detalhe para tabela + modal

A Fase 2 tinha lista de pendências + painel lateral fixo
(`AttendanceIssueDetailPanel`). O mockup da Fase 2.1 mostra uma tabela
(paridade com "Resumo mensal"/outras listagens do módulo) + um modal de
resolução — seguido à risca (mockup como fonte da verdade, mesmo padrão já
usado nos Mockups 01/02/03 de RH-02).

### Fase 2.1 — "Mais filtros" omitido, "Exportar" é só CSV client-side

O mockup mostra um botão "Mais filtros" sem nenhuma especificação
funcional na task — omitido (mesma regra já usada no módulo: preferível
não simular um botão que não faz nada, ver decisão "Sem 'Solicitar
atualização'..." acima). "Exportar" no Resumo mensal não depende de
endpoint novo: gera um CSV a partir dos dados já carregados na tabela
(`Blob`/`URL.createObjectURL`), sem replicar a formatação das exportações
legacy (`schedulePdf.ts`).

### "Assiduidade — Conferência, Por Colaborador e Horas & Saldos" (evolução) — Conferência ganha filtro primário por estado de revisão

`reviewStatus` já existia por linha (Fase 2.1); esta evolução só expõe um
filtro primário `Por conferir | Resolvidos | Todos` acima das chips de
ocorrência (task, secção 2: "Turnos regulares não devem aparecer em Por
conferir" — por omissão a aba abre em "Por conferir", nunca em "Todos").
Os KPIs do topo (calculados pelo backend) já vêm só sobre pendentes — o
frontend não precisa de recalcular nada, só de mostrar.

### "Por Colaborador" — nome clicável abre uma ficha nova, nunca o perfil de "Pessoas"

O mockup podia sugerir reaproveitar `EmployeeProfileView` (perfil geral),
mas a task pede especificamente uma ficha de ASSIDUIDADE (KPIs de
turnos/horas/atraso + extrato diário + `Resolver`), sem nenhuma relação
com dados pessoais/documentais. `AttendanceEmployeeDetailView` é uma
página nova, própria do domínio de Assiduidade — mesmo padrão de rota já
usado por `/hr/people/:id`, mas semanticamente independente.

### "Por Colaborador" — filtros de função/vínculo do mockup ficam de fora

Nem a task (texto) pede, nem o endpoint atual (`getMonthlyAttendanceSummary`)
devolve cargo/tipo de vínculo por colaborador — juntar isso exigiria uma
2ª chamada ao módulo `people` só para filtrar uma tabela, sem pedido
explícito. Fica para uma ronda futura se o utilizador confirmar a
necessidade.

## Known gaps / dívidas conhecidas

- **Evolução "Por Colaborador" — sem filtro de função/vínculo** na aba
  "Por colaborador" (o mockup mostra "Todas as funções"/"Todos os
  vínculos"/"Mais filtros") — ver Design decisions.
- **Evolução "Por Colaborador" — ficha individual não mostra "Folga"**
  para dias sem turno nenhum (o mockup mostra essas linhas) — o backend
  não sintetiza essas linhas ainda (ver README do backend, mesmo Known
  gap).
- ~~**Fase 2.1 — contrato pendente de implementação no backend**~~ —
  implementado (ver decisão acima). **2 migrações SQL continuam
  pendentes de aplicação manual** (`hr_attendance_rules`, troca do CHECK
  constraint de `hr_attendance_corrections`) — até lá, só "Configurar
  regras" mostra "Indisponível". Conferência, "Por colaborador" e a ficha
  individual já funcionam normalmente mesmo sem elas (todos os use cases
  que tocam nas tabelas novas têm `.catch(() => [])`).
- **Fase 2.1 — "Aplicação" (dentro de "Configurar regras") sem CRUD**:
  pedido explícito da task (secção 3: não criar regras por
  colaborador/função/local nesta fase) — a tab mostra só um texto
  estático.
- **Fase 2.1 — sem testes automatizados**: mesma dívida já aceite e
  documentada para todo o resto do módulo (zero testes hoje) — manter
  consistência em vez de introduzir um padrão de teste isolado só para
  esta feature.
- **Fase 2.1 — "Exportar" do Resumo mensal é só CSV, sem Excel/XLSX**: já
  estava listado como fora do âmbito ("exportação Excel/CSV ficam para
  rondas seguintes", ver entrada "Fase 2" abaixo) — o CSV client-side
  cobre a necessidade imediata sem dependência nova.

- ~~**Fase 2 — Resumo mensal completo fica para ronda seguinte**~~ —
  implementado na Fase 2.1 (`AttendanceMonthlySummaryView`, ver acima),
  ainda pendente de dados reais até o backend implementar
  `getMonthlyAttendanceSummary` (ver "contrato pendente" acima). **Horas &
  saldos completo, migração de Férias & Ausências, e exportação
  Excel/XLSX continuam para rondas seguintes** — mostram "em construção"/
  usam CSV simples em vez de dados incompletos ou uma dependência nova.
- **Fase 2 — sem testes automatizados de UI** para
  `AttendanceView`/`AttendanceIssueResolutionModal`/`MonthlyClosureBar` —
  mesma dívida já aceite para o resto do módulo; `tsc`/`eslint`/`build`
  passam, mas não verificam comportamento real no ecrã (sem acesso a
  browser nesta sessão).
- **Fase 2 — `HrReportPage.tsx` (legacy) fica órfão de rota**, não foi
  apagado — mesma cautela já usada com `HrEmployeesPage.tsx`, limpeza
  futura depois de confirmar que nada mais aponta para lá.
- **"Melhorar Visão Geral e reorganizar Pessoas" — aba Admissão não
  construída**: pedido explícito do utilizador para ignorar essa parte
  desta ronda ("para já ignora a criação de admissão, nao vejo necessario
  na nossa operação"). `PeopleTabs` só tem Colaboradores/Documentos.
- **"Melhorar Visão Geral e reorganizar Pessoas" — `PeopleDocumentsView`
  sem paginação server-side**: carrega todas as linhas
  (`api.getDocumentOverview()`) de uma vez e filtra no cliente — aceitável
  para o volume de equipa atual, mas não escala indefinidamente.
- Sem testes automatizados para este módulo ainda (nem adapter HTTP, nem
  componentes) — não existe um padrão de teste de adapter HTTP estabelecido
  no frontend (nem `financial-base` nem `invoices` têm), e os componentes
  são substanciais o suficiente para merecerem testes próprios numa
  iteração futura.
- `HrEmployeesPage.tsx` (lista legacy) fica órfã de rota mas não foi
  apagada — limpeza futura, depois de confirmar que nada mais a referencia.
- Sem paginação real de servidor para o filtro `documentSituation` (o
  backend já documenta esta simplificação no seu próprio README).
- **RH-01** — "Admissões este mês" no card da Visão Geral linka para
  `/hr/people?status=active` (aproximado, sem filtro exato por mês de
  admissão — não construído nesta fase).
- **"Consolidar turnos repartidos no Resumo do dia" — deteção de
  sobreposição por comparação de strings "HH:mm"**: um turno noturno
  (`endsNextDay`) combinado com outro turno do mesmo colaborador no mesmo
  dia civil pode escapar à deteção de conflito nesse item (caso raro,
  documentado em código — ver `consolidateByEmployee()` em
  `DaySummaryPanel.tsx`).
- **RH-01** — filtro "Local" na fila de conferência é conveniência do
  utilizador, não um limite de acesso — não existe hoje atribuição
  utilizador→loja em lado nenhum do sistema (ver README do backend).
- **"Hoje na operação refinado" — sem testes automatizados de UI** para
  `computeShortNames()`/a renderização do aviso secundário em
  `OverviewView.tsx` — mesma dívida já aceite para o resto do módulo;
  `tsc`/`eslint`/`build` verificam tipos, não o comportamento real no
  ecrã (sem acesso a browser nesta sessão).
- **"Hoje na operação refinado" — desambiguação de nomes não é mínima**:
  ver Decisões de design acima (`computeShortNames()`).
- **RH-03** — sem "Pedidos de troca" no painel de alertas (sem fonte real,
  ver README do backend). Sem testes automatizados de UI para
  `SchedulesView`/`ShiftDrawer`/`BaseScheduleModal`/`ShiftRotationsPanel`
  (mesma dívida já aceite para o resto do módulo). Rotações limitadas a 2
  participantes (MVP da task). "Escala base" só é acessível com exatamente
  1 colaborador selecionado no filtro (o botão só aparece nessa condição) —
  aplicar a vários colaboradores de uma vez não tem UI, teria de ser feito
  um de cada vez.
- ~~RH-03 — migração ainda não aplicada (`20260926180000_hr_schedules.sql`)~~
  e ~~"Novo Turno Padrão Semanal" — migração ainda não aplicada
  (`20260927120000_hr_shift_series.sql`)~~ — ambas aplicadas e confirmadas
  (2026-09-27, verificado diretamente na BD real pelo backend). Teste
  manual em concreto continua por fazer nesta sessão por não haver acesso
  a browser — `tsc`/`eslint`/`vitest`/`build` passam todos, mas isso
  verifica correção de tipos/build, não o comportamento real no ecrã.
- **"Novo Turno Padrão Semanal" — "padrão da semana" como lista de regras**
  e **pré-visualização por lista** em vez dos 2 desenhos literais do
  documento de referência — ver Decisões de design acima.
- **"Novo Turno Padrão Semanal" — sem atalhos de produtividade**: a task
  menciona como opcional "horários recentes", "copiar semana anterior" e
  "guardar/aplicar modelos" — nenhum foi implementado nesta ronda (a task
  já os marca como opcionais, "sem hardcode de regras de negócio"; dado o
  volume do resto do pedido, ficaram de fora). Se se tornarem um pedido
  real, o backend já expõe tudo o que é preciso (`previewWorkShiftSeries`
  aceita qualquer padrão arbitrário) — seria só trabalho de UI.
- **"Novo Turno Padrão Semanal" — sem testes automatizados** para
  `ShiftSeriesForm`/`ClearShiftsModal`/as alterações a `ShiftDrawer` — mesma
  dívida já aceite para o resto deste módulo.
- **"Melhorar Hoje na operação" — migração já aplicada**: esta task não
  precisou de nenhuma migração nova (só leu colunas já existentes) — ao
  contrário das duas entradas acima, não há nada pendente de aplicação
  manual aqui.
- **"Melhorar Hoje na operação" — sem testes automatizados** para as
  alterações a `OverviewView.tsx`/`SchedulesView.tsx` — mesma dívida já
  aceite para o resto deste módulo (ver primeira entrada desta lista).
- **"Melhorar Hoje na operação" — teste manual bloqueado**: sem acesso a
  browser nesta sessão, o fluxo completo (badges de estado, scroll do
  painel, clique no nome → escala filtrada, clique na situação → modal de
  conferência) não foi verificado visualmente — só `tsc`/`eslint`/
  `vitest`/`build`, que verificam tipos/build, não o resultado visual.
- **"Melhorar Turnos Rotativos" — migração pendente**
  (`20260927140000_hr_shift_rotations_split.sql`, backend) — criar uma
  rotação com turno repartido dá erro em runtime até isso ser aplicado.
- **"Repetir escala pelo calendário" — sem testes automatizados** para
  `RepeatScheduleWeekModal.tsx`/o menu "Ações da semana"/as alterações a
  `ClearShiftsModal.tsx` — mesma dívida já aceite para o resto do módulo.
- **"Repetir escala pelo calendário" e "Melhorar Turnos Rotativos" —
  teste manual bloqueado**: sem acesso a browser nesta sessão. A migração
  de rotações também ainda não foi aplicada (ver acima) — mais uma razão
  para o turno repartido em rotações não poder ser testado em ambiente
  real já.
- **"Alternar turnos" ("Copiar semana") — ordem de rotação segue a ordem
  de clique**: ao desmarcar e voltar a marcar um colaborador, ele passa
  para o fim da ordem (é assim que um `Set` de JavaScript itera). O
  formulário mostra sempre "Ordem da troca: A → B → A" antes de criar,
  precisamente para tornar isto visível — mas não há forma de reordenar
  manualmente sem desmarcar/marcar de novo. Suficiente para o caso de 2
  colaboradores (ordem não importa nesse caso — é sempre uma troca
  simétrica); com 3+ pode exigir alguma tentativa e erro para obter a
  ordem exata pretendida.
- **"Visualização Detalhada e Compacta" — sem testes automatizados**
  para `DaySummaryPanel.tsx`/o toggle Detalhada-Compacta/a correção do
  turno repartido no calendário — mesma dívida já aceite para o resto do
  módulo.
- **"Visualização Detalhada e Compacta" — teste manual bloqueado**: sem
  acesso a browser nesta sessão, o fluxo completo (alternar vista,
  persistência da preferência entre reloads, abrir/fechar o Resumo do dia
  e o recálculo de largura) não foi verificado visualmente.
