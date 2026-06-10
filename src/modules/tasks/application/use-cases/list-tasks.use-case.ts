import type { Task } from "../../domain/entities/task.ts";
import type { ListTasksPort } from "../../domain/ports/in/list-tasks.port.ts";
import type { TaskApiPort } from "../../domain/ports/out/task-api.port.ts";

export class ListTasksUseCase implements ListTasksPort {
  private readonly api: TaskApiPort;
  constructor(api: TaskApiPort) {
    this.api = api;
  }

  execute(): Promise<Task[]> {
    return this.api.fetchAll();
  }
}
