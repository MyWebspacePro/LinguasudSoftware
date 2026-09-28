import "server-only";

import { z } from "zod";

import type { SessionUser } from "@/lib/auth";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/types";
import type { Task, TaskComment } from "@/lib/types";
import { recordChange } from "@/server/audit";
import { db } from "@/server/db";
import { notFound } from "@/server/http";
import * as repo from "@/server/repositories/tasks";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss im Format YYYY-MM-DD sein.");

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).nullish(),
  status: z.enum(TASK_STATUSES).default("open"),
  priority: z.enum(TASK_PRIORITIES).default("normal"),
  dueOn: dateString.nullish(),
  assignedTo: z.uuid().nullish(),
});

export const taskUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(4000).nullish(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    dueOn: dateString.nullish(),
    assignedTo: z.uuid().nullish(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Keine Änderungen angegeben." });

export const taskCommentSchema = z.object({ body: z.string().trim().min(1).max(2000) });

export function listTasks(filter: repo.TaskListFilter): Promise<Task[]> {
  return repo.listTasks(db(), filter);
}

export function getTask(id: string): Promise<Task | null> {
  return repo.getTask(db(), id);
}

export function listComments(taskId: string): Promise<TaskComment[]> {
  return repo.listComments(db(), taskId);
}

export async function createTask(actor: SessionUser, input: z.infer<typeof taskCreateSchema>): Promise<Task> {
  return db().begin(async (tx) => {
    const id = await repo.insertTask(tx, {
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority,
      dueOn: input.dueOn ?? null,
      assignedTo: input.assignedTo ?? null,
      createdBy: actor.id,
    });
    const task = await repo.getTask(tx, id);
    if (!task) throw notFound("Aufgabe konnte nicht angelegt werden.");
    await recordChange(tx, {
      entityType: "task",
      entityId: id,
      eventType: "created",
      summary: `Aufgabe «${task.title}» angelegt`,
      after: task,
      actorId: actor.id,
    });
    return task;
  });
}

export async function updateTask(actor: SessionUser, id: string, patch: z.infer<typeof taskUpdateSchema>): Promise<Task> {
  const { status, ...rest } = patch;
  const completed = status === "done" ? true : status === "open" || status === "in_progress" ? false : undefined;
  return db().begin(async (tx) => {
    const before = await repo.getTask(tx, id);
    if (!before) throw notFound("Aufgabe wurde nicht gefunden.");
    await repo.updateTask(tx, id, { ...rest, ...(status ? { status } : {}), ...(completed === undefined ? {} : { completed }) });
    const task = await repo.getTask(tx, id);
    if (!task) throw notFound("Aufgabe wurde nicht gefunden.");
    await recordChange(tx, {
      entityType: "task",
      entityId: id,
      eventType: "updated",
      summary: `Aufgabe «${task.title}» geändert`,
      before,
      after: task,
      actorId: actor.id,
    });
    return task;
  });
}

export async function addComment(actor: SessionUser, taskId: string, input: z.infer<typeof taskCommentSchema>): Promise<TaskComment[]> {
  return db().begin(async (tx) => {
    const task = await repo.getTask(tx, taskId);
    if (!task) throw notFound("Aufgabe wurde nicht gefunden.");
    await repo.insertComment(tx, { taskId, authorId: actor.id, body: input.body });
    return repo.listComments(tx, taskId);
  });
}
