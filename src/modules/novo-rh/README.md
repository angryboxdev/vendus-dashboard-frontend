# Module: novo-rh

> Status: active (padrão novo) — em desenvolvimento
> Last updated: 2026-10-11

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

## Adapters

### Input

- `NovoRhLayout` + `NovoRhHomeView` → `/hr/novo`.
- `MfaGate` — só abre o Novo RH com sessão `aal2` (TK-3).
- `structure/StructureView` → `/hr/novo/estrutura`; `access/AccessView` → `/hr/novo/acessos`; `audit/AuditView` → `/hr/novo/auditoria`; `NotificationsBell` no cabeçalho.
- `settings/SettingsView` → `/hr/novo/configuracoes`: perfis por área, alterar valor (data de efeito, motivo, impacto se retroativo), alvos, valor por colaborador, histórico + CSV.

### Output

- `HttpSettingsApiAdapter` — usa `apiGetVersioned`/`apiWrite` (`src/lib/api.ts`): ETag lido e enviado em If-Match; Idempotency-Key em cada escrita.

## Design decisions (ADR summary)

- Área separada em vez de mexer nos ecrãs atuais (pedido do utilizador, 2026-10-11; ADR-0018 do backend).
- Visível só para Admin enquanto está em desenvolvimento.
- Textos via `t()` desde o início (pt-PT agora, es-ES depois — ADR-0023 do backend).

## How to test

`npx vitest run src/modules/novo-rh src/i18n`

## Known gaps / open debt

- Alvos de configuração por departamento/grupo ainda desligados no seletor (o backend já os aceita).
- Seletor de modo ainda só informativo (a organização de demonstração chega depois da Fase 1).
