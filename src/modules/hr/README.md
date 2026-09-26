# Módulo: hr

> Status: ativo
> Última atualização: 2026-09-26

## O que é e para que serve (perspectiva de negócio)

Área **Pessoas & Documentos** (RH-02) + **Visão Geral operacional** (RH-01).
Substitui a antiga entrada "Funcionários" por uma vista central do cadastro
de colaboradores, com sinais claros de completude de perfil, onboarding e
situação documental, um perfil 360º com dossiê documental versionado
(substituir nunca apaga a versão anterior), e um dashboard operacional de
entrada (KPIs de equipa/operação do dia/pendências, alertas prioritários e
uma fila de conferência de turnos).

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
1. Abre "Pessoas & Documentos" — vê KPIs (ativos, onboarding
   pendente, dados incompletos, documentos a expirar) e a lista
   de colaboradores com badges de estado de perfil/documentos
2. Clica num colaborador → perfil 360º (Resumo, Dados pessoais,
   Documentos, Contrato & Remuneração, Histórico)
3. Na tab Documentos, envia um novo documento por categoria
   (drag-and-drop), ou substitui um existente — a versão
   anterior fica preservada, nunca é apagada
4. Turnos/Pagamentos/Férias continuam a gerir-se nos seus
   ecrãs próprios (ligados a partir do Resumo) — não são
   duplicados aqui
```

## Propósito técnico

Consome os endpoints novos do backend (`/api/hr/people*`, módulo `hr`
hexagonal lá) para listar/gerir colaboradores e o dossiê documental
versionado, mais upload de foto de perfil. **Não é responsabilidade deste
módulo**: turnos, ponto, férias, pagamentos, kiosk, auditoria de ponto —
esses continuam 100% em `src/pages/hr/*` (legacy), reutilizados a partir do
Resumo via link simples para `/hr/employees/:id`.

## Conceitos do domínio

- **`Employee`** — colaborador (dados pessoais/contratuais + foto). IBAN/
  NIF/NISS/nº de identificação chegam já mascarados do backend quando o
  utilizador é `hr_viewer` (o frontend não faz mascaramento próprio, só
  exibe o que a API devolve).
- **`EmployeeDocument`** — uma versão de um documento numa categoria. `version`/
  `previousVersionId` formam a cadeia de versões; `displayStatus` já vem
  calculado do backend (`ok`/`expiring`/`expired`/`pending_validation`/
  `rejected`/`removed`).
- **Categorias de documento** — `DEFAULT_MANDATORY_CATEGORIES` replica a
  constante do backend (não configurável por organização nesta fase). O
  seletor de "nova categoria" na tab Documentos só mostra categorias **ainda
  não usadas** por aquele colaborador, para nunca bater no 409
  (`DocumentCategoryAlreadyExistsError`) — para reenviar uma categoria já
  existente, usa-se sempre "Substituir".

## Ports

### Saída (`HrApiPort`)

Um método por endpoint do backend — ver `domain/ports/out/hr-api.port.ts`.
`HttpHrApiAdapter` implementa-o sobre `src/lib/api.ts` (`apiGet`/`apiPost`/
`apiPatch`/`apiPostFormData`/`apiDeleteNoContent`).

## Adapters

### Entrada

- `PeopleListView` → lista (Mockup 01): KPIs, filtros (pesquisa/estado/
  vínculo/situação documental — **sem** filtro de "Local", `hr_employees`
  não é location-bearing), tabela com avatar, painel de "Pendências
  prioritárias".
- `EmployeeProfileView` → perfil 360º (Mockup 02) com 5 tabs (Resumo, Dados
  pessoais, Documentos, Contrato & Remuneração, Histórico). Cabeçalho com
  `AvatarUpload` (clique → upload imediato).
- `EmployeeDocumentsTab` → dossiê (Mockup 03): upload drag-and-drop,
  substituir/remover/ver histórico de versões por documento, alertas,
  histórico documental recente.
- `EmployeeHistoryTab` → histórico de auditoria paginado.
- `EmployeeDrawer` → formulário criar/editar colaborador (reutilizado nos
  dois modos).
- `components/Avatar` / `components/AvatarUpload` → avatar com fallback de
  iniciais (mesma convenção visual de `financial-base`'s `SupplierDetailView`)
  e overlay de upload.
- `OverviewView` (RH-01) → Visão Geral: 3 grupos de KPI cards (Equipa/
  Operação hoje/Pendências), cada um a ler o seu `BlockResult` próprio
  (nunca mostra `0` quando `status: "unavailable"`), painel de Alertas
  prioritários e painel "Hoje na operação". Atualiza a cada 60s
  (`refetchInterval`). Cards clicáveis linkam para `/hr/people` com
  filtros reais na URL, ou para `/hr/overview/shifts-to-review`.
- `ShiftsToReviewView` (RH-01) → drill-down "Turnos por conferir": tabs de
  prioridade com contagem, filtros (pesquisa/local — **sem** filtro de
  responsável, sem fonte real), tabela, paginação server-side.
- `ShiftReviewModal` (RH-01) → conferência de turno: reaproveita a forma do
  `AttendanceConferenceModal.tsx` legacy (estado/horas reais/minutos de
  atraso/notas), acrescenta um painel de análise (diferença entrada/saída,
  duração, tolerância, estado computado) e histórico de ocorrências —
  calculados localmente (funções puras, não importa lógica do backend).
  Confirmar chama a mesma rota legacy `PATCH /api/hr/shifts/:id/attendance`.
- `components/SeverityBadge` (RH-01) → Crítica/Alta/Média/Baixa, sempre
  texto + ícone + cor (nunca só cor).

### Saída

- `HttpHrApiAdapter` → `/api/hr/people*` (RH-02) + `/api/hr/overview*`
  (RH-01) + `PATCH /api/hr/shifts/:id/attendance` (rota legacy, chamada
  diretamente — nunca importa `src/pages/hr/hrApi.ts`).

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
- Teste manual: bloqueado até a migração do backend
  (`20260926120000_hr_people_documents.sql`) ser aplicada à BD real —
  até lá os endpoints `/api/hr/people*` dão erro em runtime.

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

## Known gaps / dívidas conhecidas

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
- **RH-01** — filtro "Local" na fila de conferência é conveniência do
  utilizador, não um limite de acesso — não existe hoje atribuição
  utilizador→loja em lado nenhum do sistema (ver README do backend).
