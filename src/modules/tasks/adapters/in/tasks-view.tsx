import { useState } from "react";
import { useTasks } from "./use-tasks.ts";

export function TasksView() {
  const { tasks, loading, error, createTask, completeTask } = useTasks();
  const [newTitle, setNewTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      await createTask(newTitle.trim());
      setNewTitle("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-semibold mb-4">Tasks</h1>

      <form onSubmit={(e) => { void handleSubmit(e); }} className="flex gap-2 mb-6">
        <input
          className="flex-1 border rounded px-3 py-1.5 text-sm"
          placeholder="New task title…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={submitting || !newTitle.trim()}
          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="space-y-2">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center gap-3 border rounded px-3 py-2">
            <span
              className={`flex-1 text-sm ${task.status === "completed" ? "line-through text-gray-400" : ""}`}
            >
              {task.title.value}
            </span>
            {task.status === "pending" && (
              <button
                onClick={() => { void completeTask(task.id); }}
                className="text-xs text-green-700 hover:underline"
              >
                Complete
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
