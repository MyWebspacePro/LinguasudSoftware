import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isLocale, PUBLIC_COPY } from "@/lib/public-site";
import { listPublicCourses } from "@/server/services/public-courses";
import { getPublicPage } from "@/server/services/public-pages";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: locale === "de" ? "Sprachschule in Schaffhausen und Winterthur" : "Language school in Schaffhausen and Winterthur" };
}

export default async function PublicHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = PUBLIC_COPY[locale];
  const [courses, page] = await Promise.all([listPublicCourses(), getPublicPage(locale, "start")]);

  return (
    <>
      <section className="public-hero">
        <p className="public-eyebrow">Linguasud · Schaffhausen · Winterthur</p>
        <h1>{page.published ? page.title : copy.intro}</h1>
        <p>{page.published && page.body ? page.body : copy.subtitle}</p>
        <div className="public-actions">
          <Link className="public-button" href={`/${locale}/kurse`}>{copy.browse}</Link>
          <Link className="public-button public-button--secondary" href={`/${locale}/kontakt`}>{copy.ask}</Link>
        </div>
      </section>
      <section className="public-section" aria-labelledby="available-title">
        <div className="public-section-heading">
          <div><p className="public-eyebrow">{locale === "de" ? "Fortlaufende Kurse" : "Ongoing courses"}</p><h2 id="available-title">{copy.courses}</h2></div>
          <Link href={`/${locale}/kurse`}>{locale === "de" ? "Alle ansehen →" : "View all →"}</Link>
        </div>
        {courses.length === 0 ? <p>{copy.noCourses}</p> : (
          <div className="public-cards">
            {courses.slice(0, 3).map((course) => (
              <article className="public-card" key={course.id}>
                <p className="public-eyebrow">{course.languageName} · {course.kind}</p>
                <h3>{course.level} · {course.location ?? copy.location}</h3>
                <p>{course.availableSeats} {copy.places}</p>
                <Link href={`/${locale}/kurse`}>{copy.browse} →</Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
