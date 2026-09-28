import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isLocale, publicCourseKindName, publicLanguageName, PUBLIC_COPY } from "@/lib/public-site";
import { listPublicCourses } from "@/server/services/public-courses";
import { PrintButton } from "@/components/print-button";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? {
    title: PUBLIC_COPY[locale].courses,
    description: locale === "de" ? "Laufende Gruppenkurse mit freien Plätzen in Schaffhausen und Winterthur." : "Ongoing small-group language courses with available places in Schaffhausen and Winterthur.",
  } : {};
}

export default async function CoursesPage({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ language?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { language } = await searchParams;
  const copy = PUBLIC_COPY[locale];
  const all = await listPublicCourses();
  const languages = [...new Map(all.map((course) => [course.languageCode, publicLanguageName(course.languageCode, course.languageName, locale)])).entries()];
  const courses = language ? all.filter((course) => course.languageCode === language) : all;

  return (
    <section className="public-section">
      <div className="public-section-heading">
        <div><p className="public-eyebrow">Linguasud</p><h1>{copy.courses}</h1><p>{copy.subtitle}</p></div>
        <PrintButton label={copy.print} />
      </div>
      <nav className="public-filters" aria-label={locale === "de" ? "Sprache wählen" : "Select language"}>
        <Link aria-current={!language ? "page" : undefined} href={`/${locale}/kurse`}>{locale === "de" ? "Alle Sprachen" : "All languages"}</Link>
        {languages.map(([code, name]) => (
          <Link aria-current={language === code ? "page" : undefined} href={`/${locale}/kurse?language=${encodeURIComponent(code)}`} key={code}>{name}</Link>
        ))}
      </nav>
      {courses.length === 0 ? <p className="public-card">{copy.noCourses}</p> : (
        <div className="public-course-list">
          {courses.map((course) => (
            <article className="public-card" key={course.id}>
              <header className="public-course-header"><span>{publicLanguageName(course.languageCode, course.languageName, locale)} · {publicCourseKindName(course.kindCode, course.kind, locale)}</span><strong>{course.availableSeats} {copy.places}</strong></header>
              <h2>{course.level} · {course.location ?? copy.location}</h2>
              <p className="public-course-code">{course.code} {course.status === "planned" ? `· ${copy.planned}` : ""}</p>
              <ul className="public-schedule">
                {course.schedules.map((schedule, index) => (
                  <li key={`${schedule.weekday}-${schedule.startTime}-${index}`}>
                    {copy.days[schedule.weekday]} · {schedule.startTime} · {schedule.durationMinutes} {locale === "de" ? "Min." : "min"}
                  </li>
                ))}
              </ul>
              <p>{locale === "de" ? "Leitung" : "Teacher"}: {course.teacherFirstName}</p>
              <Link className="public-button" href={`/${locale}/kontakt?course=${encodeURIComponent(course.code)}`}>{copy.ask}</Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
