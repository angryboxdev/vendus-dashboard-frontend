import { Task } from "../../domain/entities/task.ts";
import { TaskTitle } from "../../domain/entities/task-title.ts";
import type { TaskApiPort } from "../../domain/ports/out/task-api.port.ts";
import type { TaskStatus } from "../../domain/entities/task.ts";

const BASE_URL = "/api/tasks";

interface TaskDto {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
}

function fromDto(dto: TaskDto): Task {
  return Task.reconstitute({
    id: dto.id,
    title: TaskTitle.create(dto.title),
    status: dto.status,
    createdAt: new Date(dto.createdAt),
  });
}

function toDto(task: Task): Omit<TaskDto, "createdAt"> & { createdAt: string } {
  return {
    id: task.id,
    title: task.title.value,
    status: task.status,
    createdAt: task.createdAt.toISOString(),
  };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

/**
 * HTTP implementation of TaskApiPort.
 * Calls the backend via the Vite proxy at /api/tasks.
 * Swap this with InMemoryTaskApiAdapter in tasks.module.ts for offline use.
 */
export class HttpTaskApiAdapter implements TaskApiPort {
  async fetchAll(): Promise<Task[]> {
    const dtos = await request<TaskDto[]>(BASE_URL);
    return dtos.map(fromDto);
  }

  async create(task: Task): Promise<Task> {
    const dto = await request<TaskDto>(BASE_URL, {
      method: "POST",
      body: JSON.stringify(toDto(task)),
    });
    return fromDto(dto);
  }

  async update(task: Task): Promise<Task> {
    const dto = await request<TaskDto>(`${BASE_URL}/${task.id}`, {
      method: "PUT",
      body: JSON.stringify(toDto(task)),
    });
    return fromDto(dto);
  }
}
