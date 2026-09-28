export const TASK_STATUSES = ["open", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "normal", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueOn: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  createdBy: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type TaskComment = {
  id: string;
  taskId: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
  createdAt: string;
};
