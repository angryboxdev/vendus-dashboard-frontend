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

Página de entrada e, nas próximas fases, os ecrãs do novo modelo. Só o Admin
a vê por agora (`/hr/novo` → `"admin"` em `access-ui.service.ts`). Primeiro
módulo a usar a base de i18n (`src/i18n`).

## Domain concepts

- `RoadmapPhase` (`number`, `status`) e `ROADMAP` — estado das fases; atualizar quando uma fase passa o gate.
- `DataMode` — `real` | `demo`.

## Ports

Ainda sem ports: a Fase 0 não tem dados do backend. Os ports (HTTP) entram
com os primeiros endpoints do Novo RH na Fase 1.

## Adapters

### Input

- `NovoRhHomeView` → rota `/hr/novo`.

## Design decisions (ADR summary)

- Área separada em vez de mexer nos ecrãs atuais (pedido do utilizador, 2026-10-11; ADR-0018 do backend).
- Visível só para Admin enquanto está em desenvolvimento.
- Textos via `t()` desde o início (pt-PT agora, es-ES depois — ADR-0023 do backend).

## How to test

`npx vitest run src/modules/novo-rh src/i18n`

## Known gaps / open debt

- Seletor de modo ainda só informativo (a organização de demonstração chega depois da Fase 1).
