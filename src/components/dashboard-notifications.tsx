"use client";

import { useCallback, useEffect, useState } from "react";

type DashboardTask = {
  id: string;
  task_type: string;
  title: string;
  description: string;
  created_at: string;
  course_id: string | null;
  course_code: string | null;
  language: string | null;
  level: string | null;
  actor_name: string | null;
  lesson_id: string | null;
  lesson_date: string | null;
};

const taskDateFormatter = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short" });

function taskTypeLabel(taskType: string) {
  if (taskType === "course_level_changed") return "Niveauänderung";
  if (taskType === "attendance_excuse_review") return "Entschuldigung";
  return "Aufgabe";
}

export function DashboardNotifications({ onOpenCourse, onOpenAttendance }: { onOpenCourse?: (courseId: string) => void; onOpenAttendance?: (date: string) => void } = {}) {
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async (signal?: AbortSignal) => {
    setError(null);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store", credentials: "same-origin", signal });
      const payload = await response.json() as { tasks?: DashboardTask[]; notifications?: DashboardTask[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Büro-Aufgaben konnten nicht geladen werden.");
      if (!signal?.aborted) setTasks(payload.tasks ?? payload.notifications ?? []);
    } catch (loadError) {
      if (!signal?.aborted) setError(loadError instanceof Error ? loadError.message : "Büro-Aufgaben konnten nicht geladen werden.");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void loadTasks(controller.signal));
    return () => controller.abort();
  }, [loadTasks]);

  async function completeTask(taskId: string) {
    setSavingTaskId(taskId);
    setError(null);
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, status: "done" }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Aufgabe konnte nicht erledigt werden.");
      setTasks((current) => current.filter((task) => task.id !== taskId));
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : "Aufgabe konnte nicht erledigt werden.");
    } finally {
      setSavingTaskId(null);
    }
  }

  return <section className="dashboard-notifications" aria-label="Offene Büro-Aufgaben">
    <div className="dashboard-notifications__heading"><strong>Büro-Aufgaben</strong><span>{tasks.length}</span></div>
    {error ? <p className="dashboard-notifications__error" role="alert">{error} <button className="quiet-button" onClick={() => void loadTasks()} type="button">Erneut versuchen</button></p> : null}
    {tasks.length === 0 ? <p className="dashboard-notifications__empty">Keine offenen Aufgaben.</p> : <div className="dashboard-notifications__list">{tasks.map((task) => <article key={task.id}><span className="dashboard-notifications__badge">{taskTypeLabel(task.task_type)}</span><div><strong>{task.title}</strong><p>{task.course_id && task.course_code ? <button className="course-link" onClick={() => onOpenCourse?.(task.course_id as string)} type="button">{task.course_code}</button> : <b>{task.course_code ?? "Kurs"}</b>}{task.language || task.level ? ` · ${task.language ?? ""} ${task.level ?? ""}` : ""}</p><p>{task.description}</p><small>{task.actor_name ?? "System"} · {taskDateFormatter.format(new Date(task.created_at))}</small></div>{task.task_type === "attendance_excuse_review" && task.lesson_date ? <button className="dashboard-notifications__task-action" onClick={() => onOpenAttendance?.(task.lesson_date as string)} type="button">Prüfen</button> : <button className="dashboard-notifications__task-action" disabled={savingTaskId === task.id} onClick={() => void completeTask(task.id)} type="button">{savingTaskId === task.id ? "…" : "Erledigt"}</button>}</article>)}</div>}
  </section>;
}
