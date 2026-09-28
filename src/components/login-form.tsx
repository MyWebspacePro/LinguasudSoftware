"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type LoginResponse = { error?: string };

export function LoginForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json().catch(() => null)) as LoginResponse | null;

      if (!response.ok) {
        setError(data?.error ?? "Die Anmeldung war nicht möglich. Bitte versuche es erneut.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Die Verbindung zum Server konnte nicht hergestellt werden. Bitte versuche es erneut.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      {error ? (
        <p className="login-form__error" role="alert">
          {error}
        </p>
      ) : null}

      <label className="login-form__field" htmlFor="email">
        <span>E-Mail-Adresse</span>
        <input
          autoComplete="email"
          id="email"
          inputMode="email"
          name="email"
          placeholder="name@beispiel.ch"
          required
          type="email"
        />
      </label>

      <label className="login-form__field" htmlFor="password">
        <span>Passwort</span>
        <span className="login-form__password-control">
          <input
            autoComplete="current-password"
            id="password"
            minLength={8}
            name="password"
            required
            type={isPasswordVisible ? "text" : "password"}
          />
          <button
            aria-label={isPasswordVisible ? "Passwort verbergen" : "Passwort anzeigen"}
            className="login-form__password-toggle"
            onClick={() => setIsPasswordVisible((visible) => !visible)}
            type="button"
          >
            {isPasswordVisible ? "Verbergen" : "Anzeigen"}
          </button>
        </span>
      </label>

      <button className="login-form__submit" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Anmeldung läuft …" : "Anmelden"}
      </button>

      <p className="login-form__hint">
        Kein Zugang oder Passwort vergessen? Bitte wende dich an das Büro von Linguasud.
      </p>
    </form>
  );
}
