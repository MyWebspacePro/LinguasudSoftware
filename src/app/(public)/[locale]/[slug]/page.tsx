import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isLocale, isPageSlug, PUBLIC_COPY } from "@/lib/public-site";
import { getPublicPage } from "@/server/services/public-pages";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isPageSlug(slug) || slug === "start") return {};
  const page = await getPublicPage(locale, slug);
  return { title: page.seoTitle || page.title, description: page.seoDescription };
}

export default async function EditorialPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !isPageSlug(slug) || slug === "start") notFound();
  const page = await getPublicPage(locale, slug);
  return (
    <article className="public-section public-editorial">
      <p className="public-eyebrow">Linguasud</p>
      <h1>{page.title}</h1>
      {page.body.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      <Link className="public-button" href={`/${locale}/kontakt`}>{PUBLIC_COPY[locale].ask}</Link>
    </article>
  );
}
