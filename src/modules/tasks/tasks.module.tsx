import { createContext, useContext, type ReactNode } from "react";
import { HttpTaskApiAdapter } from "./adapters/out/http-task-api.adapter.ts";
// To use the in-memory adapter (offline / tests), swap the import below:
// import { InMemoryTaskApiAdapter } from "./adapters/out/in-memory-task-api.adapter.ts";
import { CreateTaskUseCase } from "./application/use-cases/create-task.use-case.ts";
import { CompleteTaskUseCase } from "./application/use-cases/complete-task.use-case.ts";
import { ListTasksUseCase } from "./application/use-cases/list-tasks.use-case.ts";
import type { CreateTaskPort } from "./domain/ports/in/create-task.port.ts";
import type { CompleteTaskPort } from "./domain/ports/in/complete-task.port.ts";
import type { ListTasksPort } from "./domain/ports/in/list-tasks.port.ts";

export interface TasksModule {
  listTasks: ListTasksPort;
  createTask: CreateTaskPort;
  completeTask: CompleteTaskPort;
}

/**
 * Composition root: wires the concrete adapter into the use cases.
 *
 * To swap providers, replace HttpTaskApiAdapter with InMemoryTaskApiAdapter
 * (or any other TaskApiPort implementation) — that is the ONLY change needed.
 */
function buildModule(): TasksModule {
  // ── Change this line to swap the data provider ──────────────────────────
  const api = new HttpTaskApiAdapter();
  // const api = new InMemoryTaskApiAdapter();
  // ────────────────────────────────────────────────────────────────────────

  return {
    listTasks: new ListTasksUseCase(api),
    createTask: new CreateTaskUseCase(api),
    completeTask: new CompleteTaskUseCase(api),
  };
}

const TasksContext = createContext<TasksModule | null>(null);

export function TasksProvider({ children, module: mod }: { children: ReactNode; module?: TasksModule }) {
  const value = mod ?? buildModule();
  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasksModule(): TasksModule {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasksModule must be used inside TasksProvider");
  return ctx;
}
