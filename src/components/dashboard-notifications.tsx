"use client";

import { useEffect, useState } from "react";

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
};

const taskDateFormatter = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short" });

function taskTypeLabel(taskType: string) {
  if (taskType === "course_level_changed") return "Niveauänderung";
  return "Aufgabe";
}

export function DashboardNotifications() {
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(async () => {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        const payload = await response.json() as { tasks?: DashboardTask[]; notifications?: DashboardTask[] };
        if (response.ok && !controller.signal.aborted) setTasks(payload.tasks ?? payload.notifications ?? []);
      } catch {
        // A task feed must never make the room planner unusable.
      }
    });
    return () => controller.abort();
  }, []);

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
    {error ? <p className="dashboard-notifications__error" role="alert">{error}</p> : null}
    {tasks.length === 0 ? <p className="dashboard-notifications__empty">Keine offenen Aufgaben.</p> : <div className="dashboard-notifications__list">{tasks.map((task) => <article key={task.id}><span className="dashboard-notifications__badge">{taskTypeLabel(task.task_type)}</span><div><strong>{task.title}</strong><p><b>{task.course_code ?? "Kurs"}</b>{task.language || task.level ? ` · ${task.language ?? ""} ${task.level ?? ""}` : ""}</p><p>{task.description}</p><small>{task.actor_name ?? "System"} · {taskDateFormatter.format(new Date(task.created_at))}</small></div><button className="dashboard-notifications__task-action" disabled={savingTaskId === task.id} onClick={() => void completeTask(task.id)} type="button">{savingTaskId === task.id ? "…" : "Erledigt"}</button></article>)}</div>}
  </section>;
}
