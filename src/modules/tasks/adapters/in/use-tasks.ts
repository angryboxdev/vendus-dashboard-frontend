import { useCallback, useEffect, useState } from "react";
import type { Task } from "../../domain/entities/task.ts";
import { useTasksModule } from "../../tasks.module.tsx";

interface UseTasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
}

interface UseTasksResult extends UseTasksState {
  createTask: (title: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  reload: () => Promise<void>;
}

export function useTasks(): UseTasksResult {
  const { listTasks, createTask, completeTask } = useTasksModule();

  const [state, setState] = useState<UseTasksState>({
    tasks: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const tasks = await listTasks.execute();
      setState({ tasks, loading: false, error: null });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  }, [listTasks]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = useCallback(
    async (title: string) => {
      await createTask.execute(title);
      await load();
    },
    [createTask, load],
  );

  const handleComplete = useCallback(
    async (taskId: string) => {
      await completeTask.execute(taskId);
      await load();
    },
    [completeTask, load],
  );

  return {
    ...state,
    createTask: handleCreate,
    completeTask: handleComplete,
    reload: load,
  };
}
