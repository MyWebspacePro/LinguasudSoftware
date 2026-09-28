import type { Metadata } from "next";

import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Anmelden",
  description: "Anmeldung zur Linguasud Verwaltung.",
};

export default function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-card">
        <h1>Linguasud</h1>
        <p className="lead">Verwaltung – bitte mit Ihren Zugangsdaten anmelden.</p>
        <LoginForm />
      </div>
    </main>
  );
}
