"use client";

import { type FormEvent, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/types";
import type { Person, Task, TaskComment, TaskPriority, TaskStatus } from "@/lib/types";

const STATUS_LABELS: Record<TaskStatus, string> = { open: "Offen", in_progress: "In Arbeit", done: "Erledigt" };
const PRIORITY_LABELS: Record<TaskPriority, string> = { low: "Tief", normal: "Normal", high: "Hoch" };

export function TaskManager({ initialTasks, people }: { initialTasks: Task[]; people: Person[] }) {
  const [items, setItems] = useState(initialTasks);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "normal" as TaskPriority,
    dueOn: "",
    assignedTo: "",
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const { task } = await api.post<{ task: Task }>("/api/tasks", {
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        dueOn: form.dueOn || null,
        assignedTo: form.assignedTo || null,
      });
      setItems((current) => [task, ...current]);
      setForm({ title: "", description: "", priority: "normal", dueOn: "", assignedTo: "" });
      setNotice("Aufgabe angelegt.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(task: Task, status: TaskStatus) {
    setError(null);
    try {
      const { task: updated } = await api.patch<{ task: Task }>(`/api/tasks/${task.id}`, { status });
      setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function openTask(task: Task) {
    setSelectedId(task.id);
    try {
      const data = await api.get<{ comments: TaskComment[] }>(`/api/tasks/${task.id}/comments`);
      setComments(data.comments);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || !commentBody.trim()) return;
    setError(null);
    try {
      const data = await api.post<{ comments: TaskComment[] }>(`/api/tasks/${selectedId}/comments`, { body: commentBody.trim() });
      setComments(data.comments);
      setCommentBody("");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  const selected = items.find((task) => task.id === selectedId) ?? null;

  return (
    <>
      {error ? <div className="alert alert--error" role="alert">{error}</div> : null}
      {notice ? <div className="alert alert--success">{notice}</div> : null}

      <div className="card">
        <h2>Neue Aufgabe</h2>
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <label className="field">
              <span>Titel</span>
              <input maxLength={200} onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} />
            </label>
            <label className="field">
              <span>Zugewiesen an</span>
              <select onChange={(event) => setForm({ ...form, assignedTo: event.target.value })} value={form.assignedTo}>
                <option value="">–</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.firstName} {person.lastName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Priorität</span>
              <select onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })} value={form.priority}>
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Fällig am</span>
              <input onChange={(event) => setForm({ ...form, dueOn: event.target.value })} type="date" value={form.dueOn} />
            </label>
            <label className="field field--full">
              <span>Beschreibung</span>
              <textarea onChange={(event) => setForm({ ...form, description: event.target.value })} rows={2} value={form.description} />
            </label>
          </div>
          <div className="form-actions">
            <button className="button" disabled={saving} type="submit">
              Aufgabe anlegen
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Aufgaben</h2>
        {items.length === 0 ? (
          <p className="empty">Keine Aufgaben.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Titel</th>
                <th>Zugewiesen</th>
                <th>Priorität</th>
                <th>Fällig</th>
                <th>Status</th>
                <th aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {items.map((task) => (
                <tr key={task.id}>
                  <td>{task.title}</td>
                  <td>{task.assignedToName ?? "–"}</td>
                  <td>{PRIORITY_LABELS[task.priority]}</td>
                  <td>{task.dueOn ?? "–"}</td>
                  <td>
                    <select onChange={(event) => void setStatus(task, event.target.value as TaskStatus)} value={task.status}>
                      {TASK_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="button button--secondary button--small" onClick={() => void openTask(task)} type="button">
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected ? (
        <div className="card">
          <h2>{selected.title}</h2>
          {selected.description ? <p>{selected.description}</p> : null}
          <h3>Kommentare</h3>
          <ul className="comment-list">
            {comments.map((comment) => (
              <li key={comment.id}>
                <strong>{comment.authorName ?? "System"}</strong> <time>{new Date(comment.createdAt).toLocaleString("de-CH")}</time>
                <p>{comment.body}</p>
              </li>
            ))}
          </ul>
          <form onSubmit={(event) => void addComment(event)}>
            <div className="form-grid">
              <label className="field field--full">
                <span>Kommentar</span>
                <input onChange={(event) => setCommentBody(event.target.value)} value={commentBody} />
              </label>
            </div>
            <div className="form-actions">
              <button className="button button--secondary button--small" type="submit">
                Kommentar hinzufügen
              </button>
              <button className="button button--secondary button--small" onClick={() => setSelectedId(null)} type="button">
                Schliessen
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
