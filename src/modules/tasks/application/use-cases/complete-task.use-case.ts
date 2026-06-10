import type { Task } from "../../domain/entities/task.ts";
import type { CompleteTaskPort } from "../../domain/ports/in/complete-task.port.ts";
import type { TaskApiPort } from "../../domain/ports/out/task-api.port.ts";

export class CompleteTaskUseCase implements CompleteTaskPort {
  constructor(private readonly api: TaskApiPort) {}

  async execute(taskId: string): Promise<Task> {
    const tasks = await this.api.fetchAll();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    const completed = task.complete();
    return this.api.update(completed);
  }
}
