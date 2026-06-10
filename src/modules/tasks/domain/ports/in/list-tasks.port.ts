import type { Task } from "../../entities/task.ts";

export interface ListTasksPort {
  execute(): Promise<Task[]>;
}
