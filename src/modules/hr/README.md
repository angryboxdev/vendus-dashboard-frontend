# Módulo: hr

> Status: ativo
> Última atualização: 2026-09-27

## O que é e para que serve (perspectiva de negócio)

Área **Pessoas** (RH-02, antes "Pessoas & Documentos" — renomeada e
reorganizada em abas Colaboradores/Documentos pela task "Melhorar Visão
Geral e reorganizar Pessoas") + **Visão Geral operacional** (RH-01) +
**Escalas & Turnos** (RH-03). Substitui a antiga entrada "Funcionários"
por uma vista central do cadastro de colaboradores, com sinais claros de
completude de perfil, onboarding e situação documental, um perfil 360º com
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
1. Abre "Pessoas" (aba Colaboradores) — vê KPIs (ativos, onboarding
   pendente, dados incompletos, documentos a expirar) e a lista
   de colaboradores com badges de estado de perfil/documentos
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
férias/pedidos, pagamentos, kiosk, auditoria de ponto — esses continuam
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

## Ports

### Saída (`HrApiPort`)

Um método por endpoint do backend — ver `domain/ports/out/hr-api.port.ts`.
`HttpHrApiAdapter` implementa-o sobre `src/lib/api.ts` (`apiGet`/`apiPost`/
`apiPatch`/`apiPostFormData`/`apiDeleteNoContent`).

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
  documental do que junto de "Novo colaborador").
- `EmployeeProfileView` → perfil 360º (Mockup 02) com 5 tabs (Resumo, Dados
  pessoais, Documentos, Contrato & Remuneração, Histórico). Cabeçalho com
  `AvatarUpload` (clique → upload imediato). Lê agora também `?category=`
  (além do já existente `?tab=`) — vindo de "Pessoas > Documentos" ou do
  drawer da Visão Geral, pré-seleciona a categoria no formulário de
  upload da aba Documentos.
- `EmployeeDocumentsTab` → dossiê (Mockup 03): upload drag-and-drop,
  substituir/remover/ver histórico de versões por documento, alertas,
  histórico documental recente. Aceita agora `initialCategory` (prop nova)
  — pré-seleciona a categoria e corrige o checkbox "Obrigatório" assim que
  `listDocumentCategories` resolve.
- `EmployeeHistoryTab` → histórico de auditoria paginado.
- `EmployeeDrawer` → formulário criar/editar colaborador (reutilizado nos
  dois modos).
- `components/Avatar` / `components/AvatarUpload` → avatar com fallback de
  iniciais (mesma convenção visual de `financial-base`'s `SupplierDetailView`)
  e overlay de upload.
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
- `AttendanceView` (novo, Fase 2 "Assiduidade, Correções, Ausências e
  Fecho Mensal") → substitui `src/pages/hr/HrReportPage.tsx` (legacy,
  deixado órfão de rota — mesma cautela já usada com
  `HrEmployeesPage.tsx`). Rota `/hr/assiduidade` (`/hr/relatorio` antigo
  passa a `<Navigate replace>` para lá — preserva o link existente).
  3 tabs — **Conferência** (funcional), **Resumo mensal**/**Horas &
  saldos** ("em construção", ver Known gaps): KPIs do topo (turnos com
  pendência/atrasos/horas realizadas/planeadas/saldo), seletor de mês
  (`?year=&month=`), lista de pendências à esquerda + `AttendanceIssueDetailPanel`
  à direita, e `MonthlyClosureBar` no rodapé.
- `AttendanceIssueDetailPanel` (novo) → "Planeado/Registado/Resultado" +
  "Ações do gestor" (adicionar/corrigir entrada ou saída, marcar
  ausência, confirmar, observação) — o botão de submissão só ativa depois
  de o campo "Motivo da correção" ter texto (nunca opcional, task secção
  12). Mostra também o histórico de correções já aplicadas a este turno.
- `MonthlyClosureBar` (novo) → status do fecho mensal: bloqueadores com
  atalho direto para a Conferência (secção 21), "Fechar período"
  desativado enquanto houver bloqueadores, "Reabrir período" exige motivo
  explícito antes de confirmar (secção 23).
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
  (RH-01) + `/api/hr/schedules*` (RH-03) + `PATCH /api/hr/shifts/:id/attendance`,
  `GET /api/hr/leave/overview`, `GET /api/hr/leave/holidays` (rotas legacy,
  chamadas diretamente — nunca importa `src/pages/hr/hrApi.ts`).

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

### Filtro de "Local" omitido na lista

O Mockup 01 mostra um seletor "Todos os locais" — `hr_employees` não tem
`location_id` (confirmado no table-registry do backend), colaboradores
pertencem à organização como um todo, não a uma loja específica.

### Categorias/contagens que o mockup mostra mas o backend não calcula

Sem "+N vs. mês anterior" nos KPIs, sem contagem entre parênteses no badge
de documentos da lista, sem checklist de onboarding granular — todos
dependem de dados que o backend ainda não persiste (ver README do módulo
`hr` no backend, secção "Known gaps").

## Como testar

- `npx tsc --noEmit -p tsconfig.app.json` e `npx eslint src/modules/hr`.
- `npx vitest run src/modules/hr` (ainda sem testes automatizados nesta
  fase — ver "Known gaps").
- Teste manual: as migrações do backend já foram todas aplicadas e
  confirmadas na BD real (2026-09-27) — falta só o acesso a um browser
  nesta sessão para o fazer.

### RH-01 — cards sem destino real ficam sem link

"Pagamentos pendentes" não é clicável — não existe página de lista global
de pagamentos (só por colaborador, dentro do perfil). "Ver agenda
completa" nunca aparece — não existe essa rota. "Escalados/Presentes/
Atrasos/Ausentes hoje" linkam para `/hr/calendar`, mas essa página legacy
não aceita parâmetros — o link não pré-filtra nada, só abre a fonte.

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

`AttendanceIssueDetailPanel` desativa o botão de submissão enquanto
`reason.trim()` estiver vazio — mas isto é só UX, não segurança: o
backend (`CorrectShiftAttendanceUseCase`) rejeita com
`AttendanceCorrectionReasonRequiredError` de qualquer forma, mesmo que
alguém contorne o frontend. O frontend nunca é a única validação.

### Fase 2 — Resumo mensal/Horas & saldos mostram "em construção", nunca dados incompletos ou zerados

As 2 abas ainda não têm use case/dados por trás (Fase B, próxima ronda) —
mostrar `0`/`—` em todos os campos seria indistinguível de "sem
atividade este mês", enganoso. Preferiu-se um aviso explícito de que a
funcionalidade ainda não existe, seguindo a mesma regra já usada noutras
partes do módulo (nunca mostrar `0` como fallback técnico quando a fonte
real está indisponível/incompleta).

## Known gaps / dívidas conhecidas

- **Fase 2 — Resumo mensal/Horas & saldos completos, migração de Férias
  & Ausências, e exportação Excel/CSV ficam para rondas seguintes**
  (confirmado com o utilizador antes de começar) — mostram "em
  construção" em vez de dados incompletos.
- **Fase 2 — sem testes automatizados de UI** para
  `AttendanceView`/`AttendanceIssueDetailPanel`/`MonthlyClosureBar` —
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
