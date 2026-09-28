import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicInquiryForm } from "@/components/public-inquiry-form";
import { isLocale, PUBLIC_COPY } from "@/lib/public-site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: PUBLIC_COPY[locale].contact } : {};
}

export default async function ContactPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ course?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { course } = await searchParams;
  return (
    <section className="public-section">
      <p className="public-eyebrow">Linguasud</p>
      <h1>{PUBLIC_COPY[locale].contact}</h1>
      <p>{locale === "de" ? "Frag uns nach einem passenden Sprachkurs. Das Büro meldet sich bei dir." : "Ask us about a suitable language course. Our office will get back to you."}</p>
      <PublicInquiryForm courseCode={typeof course === "string" ? course : ""} locale={locale} />
      <p className="public-note"><Link href={`/${locale}/privacy`}>{PUBLIC_COPY[locale].privacy}</Link></p>
    </section>
  );
}
