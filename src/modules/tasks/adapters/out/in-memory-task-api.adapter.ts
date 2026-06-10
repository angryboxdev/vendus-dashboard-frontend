import { Task, type TaskStatus } from "../../domain/entities/task.ts";
import { TaskTitle } from "../../domain/entities/task-title.ts";
import type { TaskApiPort } from "../../domain/ports/out/task-api.port.ts";

/**
 * In-memory implementation of TaskApiPort.
 * Use this adapter in tests and offline development.
 * Swap HttpTaskApiAdapter ↔ InMemoryTaskApiAdapter in tasks.module.ts.
 */
export class InMemoryTaskApiAdapter implements TaskApiPort {
  private store: Task[];

  constructor(seed: Task[] = []) {
    this.store = [...seed];
  }

  fetchAll(): Promise<Task[]> {
    return Promise.resolve([...this.store]);
  }

  create(task: Task): Promise<Task> {
    this.store.push(task);
    return Promise.resolve(task);
  }

  update(task: Task): Promise<Task> {
    this.store = this.store.map((t) => (t.id === task.id ? task : t));
    return Promise.resolve(task);
  }

  /** Helper to seed tasks from plain objects (useful in tests). */
  static withSeed(
    items: { id: string; title: string; status?: TaskStatus; createdAt?: Date }[],
  ): InMemoryTaskApiAdapter {
    const tasks = items.map((item) =>
      Task.reconstitute({
        id: item.id,
        title: TaskTitle.create(item.title),
        status: item.status ?? "pending",
        createdAt: item.createdAt ?? new Date(),
      }),
    );
    return new InMemoryTaskApiAdapter(tasks);
  }
}
