"use client";

import { type FormEvent, useState } from "react";

import { api, errorMessage } from "@/lib/api-client";
import type { PublicPage } from "@/server/services/public-pages";

export function PublicPageEditor({ initialPages }: { initialPages: PublicPage[] }) {
  const [pages, setPages] = useState(initialPages);
  const [draft, setDraft] = useState(initialPages[0]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function selectPage(key: string) {
    const page = pages.find((entry) => `${entry.locale}:${entry.slug}` === key);
    if (page) setDraft({ ...page });
    setNotice(null);
    setError(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.put<{ page: PublicPage }>("/api/cms/pages", draft);
      setPages((current) => current.map((page) => page.slug === result.page.slug && page.locale === result.page.locale ? result.page : page));
      setDraft(result.page);
      setNotice("Website-Inhalt gespeichert.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  if (!draft) return null;
  return (
    <div className="card">
      <p>Texte werden als Klartext angezeigt. Deutsch und Englisch werden getrennt bearbeitet; nur veröffentlichte Texte erscheinen öffentlich.</p>
      {error ? <p className="alert alert--error" role="alert">{error}</p> : null}
      {notice ? <p className="alert alert--success" role="status">{notice}</p> : null}
      <form onSubmit={(event) => void save(event)}>
        <div className="form-grid">
          <label className="field"><span>Seite und Sprache</span>
            <select onChange={(event) => selectPage(event.target.value)} value={`${draft.locale}:${draft.slug}`}>
              {pages.map((page) => <option key={`${page.locale}:${page.slug}`} value={`${page.locale}:${page.slug}`}>{page.locale.toUpperCase()} · {page.slug}</option>)}
            </select>
          </label>
          <label className="field"><span>Titel</span><input maxLength={160} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required value={draft.title} /></label>
          <label className="field field--full"><span>Text (Leerzeile trennt Absätze)</span>
            <textarea maxLength={12000} onChange={(event) => setDraft({ ...draft, body: event.target.value })} rows={9} value={draft.body} />
          </label>
          <label className="field"><span>SEO-Titel</span><input maxLength={160} onChange={(event) => setDraft({ ...draft, seoTitle: event.target.value })} value={draft.seoTitle} /></label>
          <label className="field"><span>SEO-Beschreibung</span><input maxLength={300} onChange={(event) => setDraft({ ...draft, seoDescription: event.target.value })} value={draft.seoDescription} /></label>
          <label className="checkbox"><input checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} type="checkbox" />Veröffentlichen</label>
        </div>
        <div className="form-actions"><button className="button" disabled={saving} type="submit">{saving ? "Speichern …" : "Speichern"}</button></div>
      </form>
    </div>
  );
}
