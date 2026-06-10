import type { Task } from "../../entities/task.ts";

export interface CompleteTaskPort {
  execute(taskId: string): Promise<Task>;
}
