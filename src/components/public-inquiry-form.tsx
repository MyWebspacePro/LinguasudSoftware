"use client";

import { type FormEvent, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import { CONSENT_COPY, type Locale } from "@/lib/public-site";

export function PublicInquiryForm({ locale, courseCode }: { locale: Locale; courseCode: string }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const isGerman = locale === "de";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(null);
    setSending(true);
    try {
      await api.post("/api/inquiries", {
        locale, salutation: data.get("salutation") || null,
        firstName: data.get("firstName"), lastName: data.get("lastName"),
        email: data.get("email"), phone: data.get("phone"),
        language: data.get("language"), courseForm: data.get("courseForm"),
        courseCode: data.get("courseCode"), selfAssessment: data.get("selfAssessment"),
        goal: data.get("goal"), message: data.get("message"),
        consent: data.get("consent") === "on", website: data.get("website"),
      });
      setDone(true);
      form.reset();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSending(false);
    }
  }

  if (done) return <p className="public-feedback" role="status">{isGerman ? "Vielen Dank. Das Büro meldet sich bei dir." : "Thank you. Our office will get back to you."}</p>;

  return (
    <form className="public-form" onSubmit={(event) => void submit(event)}>
      {error ? <p className="alert alert--error" role="alert">{error}</p> : null}
      <label className="public-hidden" aria-hidden="true">Website <input autoComplete="off" name="website" tabIndex={-1} /></label>
      <label>{isGerman ? "Anrede" : "Title"}
        <select name="salutation"><option value="">–</option><option value="frau">{isGerman ? "Frau" : "Ms"}</option><option value="herr">{isGerman ? "Herr" : "Mr"}</option><option value="divers">{isGerman ? "Divers" : "Other"}</option></select>
      </label>
      <label>{isGerman ? "Vorname" : "First name"}<input autoComplete="given-name" maxLength={120} name="firstName" required /></label>
      <label>{isGerman ? "Nachname" : "Last name"}<input autoComplete="family-name" maxLength={120} name="lastName" required /></label>
      <label>E-Mail<input autoComplete="email" name="email" required type="email" /></label>
      <label>{isGerman ? "Telefon (optional)" : "Phone (optional)"}<input autoComplete="tel" name="phone" type="tel" /></label>
      <label>{isGerman ? "Sprache" : "Language"}<input maxLength={80} name="language" /></label>
      <label>{isGerman ? "Unterrichtsform" : "Course type"}
        <select name="courseForm"><option value="">–</option><option value="group">{isGerman ? "Gruppe" : "Group"}</option><option value="private">{isGerman ? "Einzelunterricht" : "Private"}</option><option value="company">{isGerman ? "Firma" : "Company"}</option></select>
      </label>
      <label>{isGerman ? "Kurskennung (optional)" : "Course code (optional)"}<input defaultValue={courseCode} maxLength={80} name="courseCode" /></label>
      <label>{isGerman ? "Eigene Einschätzung (optional)" : "Current level (optional)"}<input maxLength={80} name="selfAssessment" /></label>
      <label>{isGerman ? "Lernziel (optional)" : "Learning goal (optional)"}<input maxLength={120} name="goal" /></label>
      <label className="public-form-wide">{isGerman ? "Nachricht (optional)" : "Message (optional)"}<textarea maxLength={2000} name="message" rows={4} /></label>
      <label className="public-consent public-form-wide"><input name="consent" required type="checkbox" />{CONSENT_COPY[locale]}</label>
      <button className="public-button" disabled={sending} type="submit">{sending ? "…" : isGerman ? "Anfrage senden" : "Send enquiry"}</button>
    </form>
  );
}
