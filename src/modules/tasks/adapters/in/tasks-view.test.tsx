import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { InMemoryTaskApiAdapter } from "../out/in-memory-task-api.adapter.ts";
import { CompleteTaskUseCase } from "../../application/use-cases/complete-task.use-case.ts";
import { CreateTaskUseCase } from "../../application/use-cases/create-task.use-case.ts";
import { ListTasksUseCase } from "../../application/use-cases/list-tasks.use-case.ts";
import { TasksProvider } from "../../tasks.module.tsx";
import { TasksView } from "./tasks-view.tsx";
import type { TasksModule } from "../../tasks.module.tsx";

/**
 * Builds the module wired to an InMemoryTaskApiAdapter.
 * This demonstrates the composition root swap: no HTTP calls, no mocking.
 */
function buildTestModule(
  seed: Parameters<typeof InMemoryTaskApiAdapter.withSeed>[0] = [],
): TasksModule {
  const api = InMemoryTaskApiAdapter.withSeed(seed);
  return {
    listTasks: new ListTasksUseCase(api),
    createTask: new CreateTaskUseCase(api),
    completeTask: new CompleteTaskUseCase(api),
  };
}

function renderWithModule(mod: TasksModule) {
  return render(
    <TasksProvider module={mod}>
      <TasksView />
    </TasksProvider>,
  );
}

describe("TasksView", () => {
  it("renders the task list from the in-memory adapter", async () => {
    const mod = buildTestModule([
      { id: "1", title: "First task" },
      { id: "2", title: "Second task" },
    ]);
    renderWithModule(mod);
    await waitFor(() => {
      expect(screen.getByText("First task")).toBeInTheDocument();
      expect(screen.getByText("Second task")).toBeInTheDocument();
    });
  });

  it("adds a new task via the form", async () => {
    const user = userEvent.setup();
    renderWithModule(buildTestModule());

    await user.type(screen.getByPlaceholderText("New task title…"), "Buy coffee");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(screen.getByText("Buy coffee")).toBeInTheDocument();
    });
  });

  it("completes a task and shows line-through", async () => {
    const user = userEvent.setup();
    renderWithModule(buildTestModule([{ id: "t1", title: "Fix bug" }]));

    await waitFor(() => screen.getByText("Fix bug"));
    await user.click(screen.getByRole("button", { name: "Complete" }));

    await waitFor(() => {
      expect(screen.getByText("Fix bug")).toHaveClass("line-through");
    });
  });

  it("does not show Complete button for already-completed tasks", async () => {
    renderWithModule(
      buildTestModule([{ id: "t1", title: "Done task", status: "completed" }]),
    );
    await waitFor(() => screen.getByText("Done task"));
    expect(screen.queryByRole("button", { name: "Complete" })).not.toBeInTheDocument();
  });
});
