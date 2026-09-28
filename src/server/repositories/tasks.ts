import "server-only";

import type { Task, TaskComment, TaskPriority, TaskStatus } from "@/lib/types";
import type { Sql } from "@/server/db";

type Row = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_on: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_by: string | null;
  completed_at: Date | null;
  created_at: Date;
};

const toTask = (row: Row): Task => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status,
  priority: row.priority,
  dueOn: row.due_on,
  assignedTo: row.assigned_to,
  assignedToName: row.assigned_to_name,
  createdBy: row.created_by,
  completedAt: row.completed_at ? row.completed_at.toISOString() : null,
  createdAt: row.created_at.toISOString(),
});

export type TaskListFilter = { status?: TaskStatus; assignedTo?: string };

export async function listTasks(sql: Sql, filter: TaskListFilter = {}): Promise<Task[]> {
  const rows = await sql<Row[]>`
    SELECT tasks.id, tasks.title, tasks.description, tasks.status, tasks.priority,
           to_char(tasks.due_on, 'YYYY-MM-DD') AS due_on, tasks.assigned_to,
           assignee.first_name || ' ' || assignee.last_name AS assigned_to_name,
           tasks.created_by, tasks.completed_at, tasks.created_at
    FROM tasks
    LEFT JOIN users assignee ON assignee.id = tasks.assigned_to
    WHERE (${filter.status ?? null}::text IS NULL OR tasks.status = ${filter.status ?? null})
      AND (${filter.assignedTo ?? null}::uuid IS NULL OR tasks.assigned_to = ${filter.assignedTo ?? null})
    ORDER BY (tasks.status = 'done'), tasks.due_on NULLS LAST, tasks.created_at DESC
  `;
  return rows.map(toTask);
}

export async function getTask(sql: Sql, id: string): Promise<Task | null> {
  const [row] = await sql<Row[]>`
    SELECT tasks.id, tasks.title, tasks.description, tasks.status, tasks.priority,
           to_char(tasks.due_on, 'YYYY-MM-DD') AS due_on, tasks.assigned_to,
           assignee.first_name || ' ' || assignee.last_name AS assigned_to_name,
           tasks.created_by, tasks.completed_at, tasks.created_at
    FROM tasks
    LEFT JOIN users assignee ON assignee.id = tasks.assigned_to
    WHERE tasks.id = ${id}
  `;
  return row ? toTask(row) : null;
}

export type TaskInput = {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueOn: string | null;
  assignedTo: string | null;
  createdBy: string | null;
};

export async function insertTask(sql: Sql, input: TaskInput): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO tasks (title, description, status, priority, due_on, assigned_to, created_by)
    VALUES (${input.title}, ${input.description}, ${input.status}, ${input.priority}, ${input.dueOn}, ${input.assignedTo}, ${input.createdBy})
    RETURNING id
  `;
  return row.id;
}

export type TaskPatch = Partial<Omit<TaskInput, "createdBy">> & { completed?: boolean };

export async function updateTask(sql: Sql, id: string, patch: TaskPatch): Promise<void> {
  const has = (key: keyof TaskPatch) => Object.prototype.hasOwnProperty.call(patch, key);
  await sql`
    UPDATE tasks SET
      title = CASE WHEN ${has("title")} THEN ${patch.title ?? null} ELSE title END,
      description = CASE WHEN ${has("description")} THEN ${patch.description ?? null} ELSE description END,
      status = CASE WHEN ${has("status")} THEN ${patch.status ?? null} ELSE status END,
      priority = CASE WHEN ${has("priority")} THEN ${patch.priority ?? null} ELSE priority END,
      due_on = CASE WHEN ${has("dueOn")} THEN ${patch.dueOn ?? null} ELSE due_on END,
      assigned_to = CASE WHEN ${has("assignedTo")} THEN ${patch.assignedTo ?? null} ELSE assigned_to END,
      completed_at = CASE WHEN ${has("completed")} THEN (CASE WHEN ${patch.completed ?? false} THEN now() ELSE NULL END) ELSE completed_at END
    WHERE id = ${id}
  `;
}

type CommentRow = {
  id: string;
  task_id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  created_at: Date;
};

export async function listComments(sql: Sql, taskId: string): Promise<TaskComment[]> {
  const rows = await sql<CommentRow[]>`
    SELECT comments.id, comments.task_id, comments.author_id,
           author.first_name || ' ' || author.last_name AS author_name,
           comments.body, comments.created_at
    FROM task_comments comments
    LEFT JOIN users author ON author.id = comments.author_id
    WHERE comments.task_id = ${taskId}
    ORDER BY comments.created_at
  `;
  return rows.map((row) => ({
    id: row.id,
    taskId: row.task_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function insertComment(sql: Sql, input: { taskId: string; authorId: string | null; body: string }): Promise<void> {
  await sql`INSERT INTO task_comments (task_id, author_id, body) VALUES (${input.taskId}, ${input.authorId}, ${input.body})`;
}
