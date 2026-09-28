import "server-only";

import { z } from "zod";

import { LOCALES, PAGE_SLUGS, type Locale, type PageSlug } from "@/lib/public-site";
import { recordChange } from "@/server/audit";
import { db } from "@/server/db";

export type PublicPage = { slug: PageSlug; locale: Locale; title: string; body: string; seoTitle: string; seoDescription: string; published: boolean };

const fallback: Record<Locale, Record<PageSlug, Pick<PublicPage, "title" | "body" | "seoTitle" | "seoDescription">>> = {
  de: {
    start: { title: "Sprachen lernen bei Linguasud", body: "", seoTitle: "Linguasud", seoDescription: "Sprachkurse in Schaffhausen und Winterthur" },
    about: { title: "Über Linguasud", body: "Wir bieten Sprachkurse in Schaffhausen und Winterthur an. Kontaktiere uns für eine persönliche Beratung.", seoTitle: "Über uns", seoDescription: "Linguasud Sprachschule" },
    prices: { title: "Preise", body: "Die aktuellen Konditionen hängen von Kursart, Dauer und Unterrichtszeit ab. Frag uns nach einer unverbindlichen Offerte.", seoTitle: "Preise", seoDescription: "Preise für Sprachkurse bei Linguasud" },
    terms: { title: "AGB", body: "Bitte kontaktiere unser Büro für die aktuell gültigen Allgemeinen Geschäftsbedingungen.", seoTitle: "AGB", seoDescription: "Allgemeine Geschäftsbedingungen" },
    privacy: { title: "Datenschutz", body: "Wir verwenden die Angaben aus Anfrage und Einstufungstest ausschliesslich, um deine Anfrage zu bearbeiten und dich dazu zu kontaktieren. Zur Auskunft oder Löschung deiner Angaben kontaktiere unser Büro.", seoTitle: "Datenschutz", seoDescription: "Umgang mit Daten aus Anfragen und Einstufungstests" },
  },
  en: {
    start: { title: "Learn with Linguasud", body: "", seoTitle: "Linguasud", seoDescription: "Language courses in Schaffhausen and Winterthur" },
    about: { title: "About Linguasud", body: "We offer language courses in Schaffhausen and Winterthur. Contact us for personal advice.", seoTitle: "About us", seoDescription: "Linguasud language school" },
    prices: { title: "Prices", body: "Prices depend on the course type, duration and time of day. Ask us for a non-binding quote.", seoTitle: "Prices", seoDescription: "Language course prices at Linguasud" },
    terms: { title: "Terms", body: "Please contact our office for the currently applicable terms and conditions.", seoTitle: "Terms", seoDescription: "Terms and conditions" },
    privacy: { title: "Privacy", body: "We use the details submitted through enquiries and level checks only to process your enquiry and contact you about it. Contact our office to request access to or deletion of your information.", seoTitle: "Privacy", seoDescription: "How enquiry and level-check data is handled" },
  },
};

export const publicPageSchema = z.object({
  slug: z.enum(PAGE_SLUGS),
  locale: z.enum(LOCALES),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().max(12000),
  seoTitle: z.string().trim().max(160),
  seoDescription: z.string().trim().max(300),
  published: z.boolean(),
});

type Row = { slug: PageSlug; locale: Locale; title: string; body: string | null; seo_title: string | null; seo_description: string | null; published: boolean };
function fromRow(row: Row): PublicPage {
  return { slug: row.slug, locale: row.locale, title: row.title, body: row.body ?? "", seoTitle: row.seo_title ?? "", seoDescription: row.seo_description ?? "", published: row.published };
}

export async function getPublicPage(locale: Locale, slug: PageSlug): Promise<PublicPage> {
  const [row] = await db()<Row[]>`
    SELECT slug, locale, title, body, seo_title, seo_description, published FROM cms_pages
    WHERE locale = ${locale} AND slug = ${slug} AND published = true
  `;
  return row ? fromRow(row) : { locale, slug, ...fallback[locale][slug], published: false };
}

export async function listEditablePages(): Promise<PublicPage[]> {
  const rows = await db()<Row[]>`
    SELECT slug, locale, title, body, seo_title, seo_description, published
    FROM cms_pages ORDER BY locale, slug
  `;
  const stored = new Map(rows.map((row) => [`${row.locale}:${row.slug}`, fromRow(row)]));
  return LOCALES.flatMap((locale) => PAGE_SLUGS.map((slug) => stored.get(`${locale}:${slug}`) ?? { locale, slug, ...fallback[locale][slug], published: false }));
}

export async function savePublicPage(input: z.infer<typeof publicPageSchema>, actorId: string): Promise<PublicPage> {
  return db().begin(async (tx) => {
    const [row] = await tx<(Row & { id: string })[]>`
      INSERT INTO cms_pages (slug, locale, title, body, seo_title, seo_description, published, updated_by)
      VALUES (${input.slug}, ${input.locale}, ${input.title}, ${input.body}, ${input.seoTitle}, ${input.seoDescription}, ${input.published}, ${actorId})
      ON CONFLICT (slug, locale) DO UPDATE SET
        title = EXCLUDED.title, body = EXCLUDED.body, seo_title = EXCLUDED.seo_title,
        seo_description = EXCLUDED.seo_description, published = EXCLUDED.published,
        updated_by = EXCLUDED.updated_by
      RETURNING id, slug, locale, title, body, seo_title, seo_description, published
    `;
    await recordChange(tx, { entityType: "cms_page", entityId: row.id, eventType: "updated", summary: `Website ${input.locale}/${input.slug} bearbeitet`, after: input, actorId });
    return fromRow(row);
  });
}
