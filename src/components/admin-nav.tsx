"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { hasRole, type Role } from "@/lib/roles";
import { NotificationBell } from "@/components/notification-bell";

type NavItem = { href: string; label: string; roles?: Role[] };

const items: NavItem[] = [
  { href: "/verwaltung", label: "Übersicht" },
  { href: "/planer", label: "Belegungsplan", roles: ["office", "admin", "teacher"] },
  { href: "/aufgaben", label: "Aufgaben", roles: ["office", "admin", "finance"] },
  { href: "/abwesenheiten", label: "Abwesenheiten", roles: ["office", "admin", "teacher"] },
  { href: "/personen", label: "Personen", roles: ["office", "admin", "finance"] },
  { href: "/kurse", label: "Kurse", roles: ["office", "admin"] },
  { href: "/kursstammdaten", label: "Kursstammdaten", roles: ["office", "admin"] },
  { href: "/tarife", label: "Tarife", roles: ["office", "admin", "finance"] },
  { href: "/anmeldungen", label: "Anmeldungen", roles: ["office", "admin", "finance"] },
  { href: "/standorte", label: "Standorte", roles: ["office", "admin"] },
  { href: "/raeume", label: "Räume", roles: ["office", "admin"] },
  { href: "/vermietungen", label: "Raumvermietung", roles: ["office", "admin"] },
  { href: "/organisationen", label: "Kostenträger", roles: ["office", "admin", "finance"] },
  { href: "/rechnungen", label: "Rechnungen", roles: ["office", "admin", "finance"] },
  { href: "/honorare", label: "Honorare", roles: ["office", "admin", "finance"] },
  { href: "/finanzen", label: "Finanzen", roles: ["office", "admin", "finance"] },
  { href: "/webseite", label: "Website-Inhalte", roles: ["office", "admin"] },
  { href: "/anfragen", label: "Website-Anfragen", roles: ["office", "admin"] },
];

export function AdminNav({ user }: { user: { name: string; roles: Role[] } }) {
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    router.replace("/login");
    router.refresh();
  }

  const visible = items.filter((item) => !item.roles || hasRole(user, ...item.roles));

  return (
    <aside className="app__sidebar">
      <div className="brand">
        <span aria-hidden="true" className="brand__mark">
          L
        </span>
        <span>
          Linguasud
          <small>Verwaltung</small>
        </span>
      </div>

      <nav aria-label="Hauptnavigation" className="nav">
        {visible.map((item) => {
          const active = pathname === item.href || (item.href !== "/verwaltung" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`nav__link${active ? " is-active" : ""}`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar__footer">
        <NotificationBell />
        <div className="sidebar__user">
          <strong>{user.name}</strong>
          {user.roles.join(", ")}
        </div>
        <button
          className="button button--ghost button--small"
          disabled={leaving}
          onClick={() => void logout()}
          type="button"
        >
          {leaving ? "Abmelden …" : "Abmelden"}
        </button>
      </div>
    </aside>
  );
}
