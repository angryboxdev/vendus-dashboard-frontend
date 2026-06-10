import type { Task } from "../../entities/task.ts";

export interface TaskApiPort {
  fetchAll(): Promise<Task[]>;
  create(task: Task): Promise<Task>;
  update(task: Task): Promise<Task>;
}
