import { AlreadyCompletedError } from "./task-errors.ts";
import { TaskTitle } from "./task-title.ts";

export type TaskStatus = "pending" | "completed";

export interface TaskProps {
  id: string;
  title: TaskTitle;
  status: TaskStatus;
  createdAt: Date;
}

export class Task {
  readonly id: string;
  readonly title: TaskTitle;
  readonly status: TaskStatus;
  readonly createdAt: Date;

  private constructor(props: TaskProps) {
    this.id = props.id;
    this.title = props.title;
    this.status = props.status;
    this.createdAt = props.createdAt;
  }

  static create(props: { id: string; title: string; createdAt?: Date }): Task {
    return new Task({
      id: props.id,
      title: TaskTitle.create(props.title),
      status: "pending",
      createdAt: props.createdAt ?? new Date(),
    });
  }

  static reconstitute(props: TaskProps): Task {
    return new Task(props);
  }

  complete(): Task {
    if (this.status === "completed") throw new AlreadyCompletedError();
    return Task.reconstitute({ ...this, status: "completed" });
  }
}
