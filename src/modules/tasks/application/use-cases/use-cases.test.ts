import { describe, expect, it } from "vitest";
import { InMemoryTaskApiAdapter } from "../../adapters/out/in-memory-task-api.adapter.ts";
import { CompleteTaskUseCase } from "./complete-task.use-case.ts";
import { CreateTaskUseCase } from "./create-task.use-case.ts";
import { ListTasksUseCase } from "./list-tasks.use-case.ts";
import { AlreadyCompletedError } from "../../domain/entities/task-errors.ts";

function makeAdapter(seed: Parameters<typeof InMemoryTaskApiAdapter.withSeed>[0] = []) {
  return InMemoryTaskApiAdapter.withSeed(seed);
}

describe("ListTasksUseCase", () => {
  it("returns empty list when no tasks exist", async () => {
    const useCase = new ListTasksUseCase(makeAdapter());
    expect(await useCase.execute()).toEqual([]);
  });

  it("returns all seeded tasks", async () => {
    const useCase = new ListTasksUseCase(
      makeAdapter([{ id: "1", title: "Task A" }, { id: "2", title: "Task B" }]),
    );
    const result = await useCase.execute();
    expect(result).toHaveLength(2);
  });
});

describe("CreateTaskUseCase", () => {
  it("persists a new pending task", async () => {
    const adapter = makeAdapter();
    const useCase = new CreateTaskUseCase(adapter);
    const task = await useCase.execute("Write tests");
    expect(task.title.value).toBe("Write tests");
    expect(task.status).toBe("pending");
    const all = await adapter.fetchAll();
    expect(all).toHaveLength(1);
  });

  it("rejects empty title from the domain", async () => {
    const useCase = new CreateTaskUseCase(makeAdapter());
    await expect(useCase.execute("   ")).rejects.toThrow("cannot be empty");
  });
});

describe("CompleteTaskUseCase", () => {
  it("marks a task as completed", async () => {
    const adapter = makeAdapter([{ id: "abc", title: "Do it" }]);
    const useCase = new CompleteTaskUseCase(adapter);
    const completed = await useCase.execute("abc");
    expect(completed.status).toBe("completed");
  });

  it("throws when task not found", async () => {
    const useCase = new CompleteTaskUseCase(makeAdapter());
    await expect(useCase.execute("missing")).rejects.toThrow("Task not found");
  });

  it("throws AlreadyCompletedError when already done", async () => {
    const adapter = makeAdapter([{ id: "abc", title: "Do it", status: "completed" }]);
    const useCase = new CompleteTaskUseCase(adapter);
    await expect(useCase.execute("abc")).rejects.toThrow(AlreadyCompletedError);
  });
});
