"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api-client";
import type { Notification } from "@/lib/types";

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await api.get<{ notifications: Notification[] }>("/api/notifications");
        if (active) setItems(data.notifications);
      } catch {
        // ignore
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const unread = items.filter((item) => !item.readAt).length;

  async function markAllRead() {
    try {
      const data = await api.patch<{ notifications: Notification[] }>("/api/notifications", { all: true });
      setItems(data.notifications);
    } catch {
      // ignore
    }
  }

  return (
    <div className="bell">
      <button className="button button--ghost button--small" onClick={() => setOpen((value) => !value)} type="button">
        Benachrichtigungen{unread > 0 ? ` (${unread})` : ""}
      </button>
      {open ? (
        <div className="bell__panel" role="dialog" aria-label="Benachrichtigungen">
          {items.length === 0 ? (
            <p className="empty" style={{ padding: "0.5rem" }}>
              Keine Benachrichtigungen.
            </p>
          ) : (
            <>
              <ul className="bell__list">
                {items.slice(0, 20).map((item) => (
                  <li className={item.readAt ? "" : "is-unread"} key={item.id}>
                    <strong>{item.title}</strong>
                    {item.body ? <span>{item.body}</span> : null}
                    <time>{new Date(item.createdAt).toLocaleString("de-CH")}</time>
                  </li>
                ))}
              </ul>
              {unread > 0 ? (
                <button className="button button--secondary button--small" onClick={() => void markAllRead()} type="button">
                  Alle als gelesen markieren
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
