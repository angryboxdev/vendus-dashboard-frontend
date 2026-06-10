import { Task } from "../../domain/entities/task.ts";
import type { CreateTaskPort } from "../../domain/ports/in/create-task.port.ts";
import type { TaskApiPort } from "../../domain/ports/out/task-api.port.ts";

export class CreateTaskUseCase implements CreateTaskPort {
  private readonly api: TaskApiPort;
  constructor(api: TaskApiPort) {
    this.api = api;
  }

  async execute(title: string): Promise<Task> {
    const task = Task.create({ id: crypto.randomUUID(), title });
    return this.api.create(task);
  }
}
