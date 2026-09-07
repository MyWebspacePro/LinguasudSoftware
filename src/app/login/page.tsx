import type { Metadata } from "next";

import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Anmelden",
  description: "Anmeldung zur Linguasud Kursverwaltung.",
};

export default function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-page__shell">
        <aside className="login-page__aside" aria-label="Linguasud Kursverwaltung">
          <a className="login-page__brand" href="/login">
            <span aria-hidden="true" className="login-page__brand-mark">L</span>
            <span>
              Linguasud
              <small>Kursverwaltung</small>
            </span>
          </a>

          <div className="login-page__intro">
            <p className="login-page__eyebrow">Willkommen zurück</p>
            <h1>Alles für Ihren Sprachkurs an einem Ort.</h1>
            <p>
              Verwalten Sie Termine, Räume und Kursteilnahmen sicher und übersichtlich.
            </p>
          </div>

          <ul className="login-page__benefits">
            <li><span aria-hidden="true">✓</span> Aktuelle Kurs- und Raumplanung</li>
            <li><span aria-hidden="true">✓</span> Geschützter Zugang nach Rolle</li>
            <li><span aria-hidden="true">✓</span> Für Büro, Lehrpersonen und Teilnehmende</li>
          </ul>
        </aside>

        <section className="login-page__content" aria-labelledby="login-title">
          <div className="login-page__form-wrap">
            <p className="login-page__eyebrow">Geschützter Bereich</p>
            <h2 id="login-title">Anmelden</h2>
            <p className="login-page__lead">Bitte melden Sie sich mit Ihren persönlichen Zugangsdaten an.</p>
            <LoginForm />
          </div>
          <p className="login-page__security">Ihre Verbindung ist verschlüsselt und Ihre Daten bleiben geschützt.</p>
        </section>
      </div>
    </main>
  );
}
