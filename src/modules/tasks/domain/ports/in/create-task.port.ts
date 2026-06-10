import type { Task } from "../../entities/task.ts";

export interface CreateTaskPort {
  execute(title: string): Promise<Task>;
}
