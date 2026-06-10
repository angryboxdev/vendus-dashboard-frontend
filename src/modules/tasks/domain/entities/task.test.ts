import { describe, expect, it } from "vitest";
import { AlreadyCompletedError } from "./task-errors.ts";
import { EmptyTitleError } from "./task-errors.ts";
import { Task } from "./task.ts";
import { TaskTitle } from "./task-title.ts";

describe("Task", () => {
  it("creates a pending task", () => {
    const task = Task.create({ id: "1", title: "Buy milk" });
    expect(task.status).toBe("pending");
    expect(task.title.value).toBe("Buy milk");
  });

  it("complete() returns a new completed task", () => {
    const task = Task.create({ id: "1", title: "Buy milk" });
    const completed = task.complete();
    expect(completed.status).toBe("completed");
    expect(completed.id).toBe(task.id);
  });

  it("complete() is immutable — original stays pending", () => {
    const task = Task.create({ id: "1", title: "Buy milk" });
    task.complete();
    expect(task.status).toBe("pending");
  });

  it("complete() throws AlreadyCompletedError if already completed", () => {
    const task = Task.create({ id: "1", title: "Buy milk" });
    const completed = task.complete();
    expect(() => completed.complete()).toThrow(AlreadyCompletedError);
  });
});

describe("TaskTitle", () => {
  it("trims whitespace", () => {
    expect(TaskTitle.create("  hello  ").value).toBe("hello");
  });

  it("throws EmptyTitleError for blank string", () => {
    expect(() => TaskTitle.create("   ")).toThrow(EmptyTitleError);
  });

  it("throws EmptyTitleError for empty string", () => {
    expect(() => TaskTitle.create("")).toThrow(EmptyTitleError);
  });
});
