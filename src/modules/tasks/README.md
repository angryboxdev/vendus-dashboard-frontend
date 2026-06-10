# Módulo: tasks

> Status: ativo
> Última atualização: 2026-06-10

## Propósito

Gestão de tarefas (criar, listar, concluir). Serve como **módulo de referência** da
arquitetura hexagonal no frontend: demonstra a estrutura completa de domínio, ports,
use cases, adapters e composition root. Não é responsabilidade deste módulo
autenticar o utilizador nem gerir notificações.

## Conceitos do domínio

- **Task** — entidade imutável com `id`, `title` (value object), `status`
  (`pending` | `completed`) e `createdAt`. O método `complete()` devolve uma nova
  instância; lança `AlreadyCompletedError` se já estiver concluída.
- **TaskTitle** — value object que garante título não vazio (lança `EmptyTitleError`).
- **Erros de domínio** — `EmptyTitleError` e `AlreadyCompletedError`, lançados pelo
  próprio domínio, sem dependência de framework.

## Ports

### Entrada (use cases)

- `ListTasksPort` — `execute(): Promise<Task[]>` — devolve todas as tarefas.
- `CreateTaskPort` — `execute(title: string): Promise<Task>` — valida título e
  persiste nova tarefa.
- `CompleteTaskPort` — `execute(taskId: string): Promise<Task>` — conclui uma tarefa
  existente; delega invariante ao domínio.

### Saída (dependências do domínio)

- `TaskApiPort` — `fetchAll()`, `create(task)`, `update(task)` — contrato de acesso
  a dados. O domínio e os use cases conhecem apenas esta interface; nenhuma
  implementação concreta é referenciada fora do composition root.

## Adapters

### Entrada (UI)

- `useTasks` (hook) — consome os três use cases via `useTasksModule`; expõe
  `tasks`, `loading`, `error`, `createTask`, `completeTask`, `reload`.
- `TasksView` (componente) — renderiza lista e formulário de criação; sem lógica de
  negócio nem chamadas HTTP diretas.

### Saída

- `HttpTaskApiAdapter` — implementa `TaskApiPort` com `fetch` nativo para
  `/api/tasks` (proxiado pelo Vite para `http://localhost:3333`).
- `InMemoryTaskApiAdapter` — implementa `TaskApiPort` com um array em memória.
  Intercambiável com `HttpTaskApiAdapter`; usado em testes e desenvolvimento offline.

## Decisões de design (ADR resumido)

### Injeção por interface e troca de provedor

Os use cases recebem `TaskApiPort` no construtor — nunca instanciam adapters
diretamente. O **único sítio** que conhece a implementação concreta é
`tasks.module.ts` (composition root). Para trocar de provedor (HTTP → in-memory ou
vice-versa) basta alterar uma linha nesse ficheiro:

```ts
// Linha no composition root:
const api = new HttpTaskApiAdapter();   // produção
// const api = new InMemoryTaskApiAdapter(); // testes / offline
```

Nos testes de UI, o `TasksProvider` aceita um `module` opcional, o que permite
injectar um módulo wired com `InMemoryTaskApiAdapter` sem tocar no composition root
de produção e sem mockar rede.

### Imutabilidade da entidade

`Task` não tem setters. `complete()` devolve uma nova instância via
`Task.reconstitute()`. Isto garante que os testes de invariantes são determinísticos
e que os use cases nunca mutam estado partilhado acidentalmente.

### Sem React Query neste módulo

O estado de loading/error é gerido manualmente no hook `useTasks` para manter a
dependência do domínio e dos use cases a zero de React. Se o projeto decidir adoptar
React Query aqui, o uso case continua inalterado — só o hook muda.

## Como testar

```bash
# Todos os testes do módulo (rápidos, sem rede):
npm test -- src/modules/tasks

# Modo watch:
npm run test:watch -- src/modules/tasks
```

- **Domínio/use cases** — testes unitários puros, com `InMemoryTaskApiAdapter` como
  fake do port de saída.
- **UI** — testes com Testing Library, plugando `InMemoryTaskApiAdapter` no
  `TasksProvider`. Nenhuma chamada de rede.

## Pontos de atenção / dívidas conhecidas

- `CompleteTaskUseCase` faz um `fetchAll` para encontrar a tarefa antes de a
  concluir. Se o backend expuser um endpoint `GET /api/tasks/:id`, adicionar
  `findById` ao `TaskApiPort` e actualizar os adapters.
- O `TasksView` é propositadamente minimalista (sem paginação, filtros ou feedback
  de erro por tarefa). Expande conforme a necessidade do produto.
