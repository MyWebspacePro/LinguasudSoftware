import Link from "next/link";
import { redirect } from "next/navigation";

import { NoAccess } from "@/components/no-access";
import { currentUser } from "@/lib/auth";
import { hasRole } from "@/lib/roles";

const settings = [
  { href: "/raeume", title: "Zimmerverwaltung", description: "Zimmer anlegen, bearbeiten, aktivieren, deaktivieren oder löschen." },
  { href: "/standorte", title: "Standortverwaltung", description: "Standorte anlegen, Reihenfolge festlegen, aktivieren, deaktivieren oder löschen." },
  { href: "/kursstammdaten", title: "Kursstammdaten", description: "Sprachen, Kursarten und Gruppengrössen verwalten." },
  { href: "/tarife", title: "Tarife", description: "Preislisten und Tarifpositionen pflegen." },
];

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "office", "admin")) return <NoAccess />;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Einstellungen</h1>
          <p>Grunddaten und Verwaltungsfunktionen der Software konfigurieren.</p>
        </div>
      </div>
      <div className="settings-grid">
        {settings.map((setting) => (
          <Link className="settings-card" href={setting.href} key={setting.href}>
            <h2>{setting.title}</h2>
            <p>{setting.description}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
