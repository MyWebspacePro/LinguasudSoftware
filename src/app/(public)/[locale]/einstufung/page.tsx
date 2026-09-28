import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PlacementForm } from "@/components/placement-form";
import { isLocale, PUBLIC_COPY } from "@/lib/public-site";
import { listPlacementQuestions } from "@/server/services/public-placement";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: PUBLIC_COPY[locale].test } : {};
}

export default async function PlacementPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const questions = await listPlacementQuestions();
  return (
    <section className="public-section">
      <p className="public-eyebrow">Linguasud</p>
      <h1>{PUBLIC_COPY[locale].test}</h1>
      <p>{locale === "de" ? "Dieser kurze Test gibt nur eine erste Orientierung zwischen A1 und B2. Das Büro bespricht die passende Einstufung mit dir." : "This short check only gives an initial indication between A1 and B2. Our office will discuss your actual level with you."}</p>
      <PlacementForm locale={locale} questions={questions} />
      <p className="public-note"><Link href={`/${locale}/privacy`}>{PUBLIC_COPY[locale].privacy}</Link></p>
    </section>
  );
}
