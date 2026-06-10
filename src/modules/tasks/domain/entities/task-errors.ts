export class EmptyTitleError extends Error {
  constructor() {
    super("Task title cannot be empty");
    this.name = "EmptyTitleError";
  }
}

export class AlreadyCompletedError extends Error {
  constructor() {
    super("Task is already completed");
    this.name = "AlreadyCompletedError";
  }
}
