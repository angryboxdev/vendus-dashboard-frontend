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

- **Modo Real / Demonstração** — Real usa a organização verdadeira; Demonstração usa uma organização só com dados fictícios (disponível depois da Fase 1).
- **Fase** — etapa da task; só avança depois de aprovada.

---

## Technical purpose

Moldura com separadores (Visão geral | Configurações | Estrutura | Acessos | Auditoria), sino de notificações e ecrã de MFA à entrada. Só o Admin
a vê por agora (`/hr/novo` → `"admin"` em `access-ui.service.ts`). Primeiro
módulo a usar a base de i18n (`src/i18n`).

## Domain concepts

- `RoadmapPhase` (`number`, `status`) e `ROADMAP` — estado das fases; atualizar quando uma fase passa o gate.
- `DataMode` — `real` | `demo`.
- `settings.ts` — contrato do motor de configurações (definições, perfis, alvos, valores, valor efetivo com origem/herdado, histórico).
- `settings-format.service.ts` — formatar/converter valores por tipo; chaves de texto por nível e área.

## Ports

### Output

- `SettingsApiPort` — `/api/novo-rh/settings` (+ listas de colaboradores e locais para os alvos).
- `MfaPort` — MFA TOTP do Supabase (estado, ativar, confirmar).
- `StructureApiPort`, `AccessGovernanceApiPort`, `AuditApiPort`, `NotificationsApiPort` (`governance-api.port.ts`).
- `PeopleApiPort` — `/api/novo-rh/people` e `/api/novo-rh/catalog` (Fase 2).
- `TimeApiPort` — `/api/novo-rh/time` (Fase 3).
- `RostersApiPort` — `/api/novo-rh/rosters` e `/api/me/roster` (Fase 7).
- `TimeBankApiPort` — `/api/novo-rh/time-bank` (Fase 6).
- `AbsencesApiPort` — `/api/novo-rh/absences`; `MyAbsencesApiPort` — `/api/me/absences` e `/api/me/approvals` (Fase 5).
- `AttendanceApiPort` — `/api/novo-rh/attendance`; `MyClockApiPort` — `/api/me/clock`; `PunchQueueStoragePort` — onde fica a fila offline (Fase 4).

## Adapters

### Input

- `NovoRhLayout` + `NovoRhHomeView` → `/hr/novo`.
- `MfaGate` — só abre o Novo RH com sessão `aal2` (TK-3).
- `rosters/RostersView` → `/hr/novo/escalas`: Escala (grelha de 2 semanas, clicar para pôr o modelo, rascunho tracejado, alterar/retirar publicado com motivo, publicar com avisos a confirmar ou bloqueios, em massa, histórico de versões), Modelos de turno, Trocas (gestão), O meu horário (turnos publicados, propor/aceitar trocas).
- `time-bank/TimeBankView` → `/hr/novo/banco-de-horas`: saldo e histórico (KPIs, corte, ledger com acumulado ao segundo, ajustes lançados hoje), excedente por validar, compensar (limitado ao máximo — RE-28), ajustar, sincronizar; horas categorizadas com fator.
- `absences/AbsencesView` → `/hr/novo/ausencias`: Para aprovar (caixa do aprovador, nível e escalonamento), Pedidos (filtrar, atribuir, cancelar — aprovada exige motivo), Saldos (movimentos, ajuste com motivo, compensar feriados trabalhados), Tipos (valores seguros, sem valores legais), Fluxos de aprovação (níveis com pessoas/papéis, recurso; nível vazio não grava), As minhas.
- `attendance/AttendanceView` → `/hr/novo/assiduidade`: Dias (totais do motor, marcações, corrigir com motivo, ajustes, recalcular), Incidentes (corrigido / validar horas / dispensar com comentário), Pedidos de correção (aprovar / recusar com motivo), O meu ponto (picar com fila offline, recusar correções no prazo, pedir correção). O Portal do Colaborador continua no registo atual (ADR-0027 do backend).
- `time/TimeView` → `/hr/novo/tempo`: Horários (fixos/flexíveis, versões, aplicar a), Feriados (calendários por centro, importar nacionais "a confirmar", confirmar, eliminar com impacto), Férias (configuração, sem limite por omissão), Tempo teórico por colaborador.
- `people/PeopleListView` → `/hr/novo/pessoas` (lista no âmbito, criar, importar CSV com simulação, exportar); `people/PersonView` → `/hr/novo/pessoas/:id` (Dados com privacidade por campo e motivo nos sensíveis, Contratos, Organização/transferência, Responsáveis, Remuneração, Campos da empresa, Regras pessoais, Documentos); `structure/CatalogSections` (convénios, complementos/benefícios, campos personalizados).
- `structure/StructureView` → `/hr/novo/estrutura`; `access/AccessView` → `/hr/novo/acessos`; `audit/AuditView` → `/hr/novo/auditoria`; `NotificationsBell` no cabeçalho.
- `settings/SettingsView` → `/hr/novo/configuracoes`: perfis por área, alterar valor (data de efeito, motivo, impacto se retroativo), alvos, valor por colaborador, histórico + CSV.

### Output

- `HttpSettingsApiAdapter` — usa `apiGetVersioned`/`apiWrite` (`src/lib/api.ts`): ETag lido e enviado em If-Match; Idempotency-Key em cada escrita.
- `HttpAbsencesApiAdapter`, `HttpMyAbsencesApiAdapter`.
- `HttpTimeBankApiAdapter`.
- `HttpRostersApiAdapter`.
- `HttpAttendanceApiAdapter`, `HttpMyClockApiAdapter` (a marcação usa o `clientEventId` como Idempotency-Key), `LocalStoragePunchQueue` (só ids e tipo; em memória se o navegador não deixar guardar).

## Design decisions (ADR summary)

- Área separada em vez de mexer nos ecrãs atuais (pedido do utilizador, 2026-10-11; ADR-0018 do backend).
- Visível só para Admin enquanto está em desenvolvimento.
- Textos via `t()` desde o início (pt-PT agora, es-ES depois — ADR-0023 do backend).

## How to test

`npx vitest run src/modules/novo-rh src/i18n`

## Known gaps / open debt

- Alvos de configuração por departamento/grupo ainda desligados no seletor (o backend já os aceita).
- Seletor de modo ainda só informativo (a organização de demonstração chega depois da Fase 1).
