# Módulo: calendar

> Status: ativo
> Última atualização: 2026-10-06

## Propósito
Aba **Empresa & Estrutura → Calendário & Eventos** (`/empresa/calendario`):
o calendário corporativo único (feriados, eventos empresariais e prazos de
validade dos documentos da Empresa), em vista Mês ou Semana, com filtros e
o bloco "Próximos eventos importantes". Não gere documentos (um prazo leva
à aba Documentos) nem altera Escalas/Férias.

## Conceitos do domínio
- **`CalendarItem`** — espelho do backend: `holiday` | `event` | `deadline`,
  data, título, Local (vazio = empresa inteira), prioridade (eventos e
  prazos), tipo de feriado, categoria/visibilidade do evento.
- `calendar-grid.service.ts` — semanas a começar à segunda, grelha do mês,
  intervalo a pedir ao backend, títulos ("Outubro 2026", "14 OUT"); datas
  em UTC para não dependerem do fuso do browser.

## Ports
### Entrada (use cases)
- `CalendarUseCases` — listar, próximos importantes, guardar/remover
  feriado, pré-visualizar/importar feriados, guardar/cancelar evento (finos:
  as regras vivem no backend).
### Saída (dependências do domínio)
- `CalendarApiPort` — `/api/calendar*`.

## Adapters
### Entrada (UI)
- `useCalendarItems`, `useUpcomingImportant`, `useCalendarMutations`,
  `useHolidayImportPreview` (react-query).
- `CalendarView` — navegação, Mês/Semana, filtros (Todos/Feriados/Eventos/
  Prazos, Local, Prioridade), legenda, próximos importantes.
- `CalendarDialogs` — `EventDrawer`, `HolidayDrawer`, `ImportHolidaysModal`
  (pré-visualização "Novo"/"Já existe"; repetir nunca duplica).
### Saída
- `HttpCalendarApiAdapter`.

## Decisões de design (ADR resumido)
- **Permissões como o backend** — feriados e importação só admin (afetam as
  Escalas); eventos gestores e admins; restantes só leem.
- **Prazo de documento abre a aba Documentos** — o prazo é derivado do
  documento; editá-lo é renovar o documento, nunca mexer no calendário.
- **Sem segundo calendário** — o Dashboard futuro deve usar
  `GET /api/calendar` (task §5).

## Como testar
- `npx vitest run src/modules/calendar`

## Pontos de atenção / dívidas conhecidas
- Eventos de vários dias não existem (um evento = um dia), como na task.
- Importação automática só para Portugal (D5 no backend).
