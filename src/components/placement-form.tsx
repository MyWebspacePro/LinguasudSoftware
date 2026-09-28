"use client";

import { type FormEvent, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import type { Locale } from "@/lib/public-site";
import type { PlacementQuestion } from "@/server/services/public-placement";

export function PlacementForm({ questions, locale }: { questions: PlacementQuestion[]; locale: Locale }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const german = locale === "de";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (questions.some((question) => answers[question.id] === undefined)) {
      setError(german ? "Bitte beantworte alle Fragen." : "Please answer all questions.");
      return;
    }
    const data = new FormData(event.currentTarget);
    setError(null);
    setSending(true);
    try {
      const response = await api.post<{ level: string }>("/api/placement", {
        locale, firstName: data.get("firstName"), lastName: data.get("lastName"),
        email: data.get("email"), phone: data.get("phone"),
        consent: data.get("consent") === "on", website: data.get("website"),
        answers: questions.map((question) => ({ questionId: question.id, option: answers[question.id] })),
      });
      setResult(response.level);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSending(false);
    }
  }

  if (!questions.length) return <p>{german ? "Der Kurztest ist derzeit nicht verfügbar." : "The level check is currently unavailable."}</p>;
  if (result) return (
    <div className="public-feedback" role="status">
      <strong>{german ? "Vorläufige Orientierung" : "Provisional indication"}: {result}</strong>
      <p>{german ? "Dein Ergebnis wurde ans Büro übermittelt. Die Einstufung wird im Beratungsgespräch bestätigt." : "Your result has been sent to our office. Your level will be confirmed during your consultation."}</p>
    </div>
  );
  return (
    <form className="public-form" onSubmit={(event) => void submit(event)}>
      {error ? <p className="alert alert--error" role="alert">{error}</p> : null}
      <label className="public-hidden" aria-hidden="true">Website <input autoComplete="off" name="website" tabIndex={-1} /></label>
      <label>{german ? "Vorname" : "First name"}<input autoComplete="given-name" maxLength={120} name="firstName" required /></label>
      <label>{german ? "Nachname" : "Last name"}<input autoComplete="family-name" maxLength={120} name="lastName" required /></label>
      <label>E-Mail<input autoComplete="email" name="email" required type="email" /></label>
      <label>{german ? "Telefon (optional)" : "Phone (optional)"}<input autoComplete="tel" name="phone" type="tel" /></label>
      <div className="public-questions">
        {questions.map((question, index) => (
          <fieldset key={question.id}>
            <legend>{index + 1}. {question.prompt}</legend>
            {question.options.map((option, optionIndex) => (
              <label key={`${question.id}-${optionIndex}`}><input checked={answers[question.id] === optionIndex} name={`q-${question.id}`} onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))} required type="radio" />{option}</label>
            ))}
          </fieldset>
        ))}
      </div>
      <label className="public-consent public-form-wide"><input name="consent" required type="checkbox" />{german ? "Ich bin mit der Bearbeitung meiner Angaben zur Einstufung und Kontaktaufnahme einverstanden." : "I agree to processing my details for the level check and contacting me."}</label>
      <button className="public-button" disabled={sending} type="submit">{sending ? "…" : german ? "Ergebnis senden" : "Submit result"}</button>
    </form>
  );
}
