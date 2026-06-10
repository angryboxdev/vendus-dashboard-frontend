import { EmptyTitleError } from "./task-errors.ts";

export class TaskTitle {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(value: string): TaskTitle {
    const trimmed = value.trim();
    if (trimmed.length === 0) throw new EmptyTitleError();
    return new TaskTitle(trimmed);
  }

  get value(): string {
    return this._value;
  }
}
