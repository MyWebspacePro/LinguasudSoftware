import Link from "next/link";
import { notFound } from "next/navigation";

import { isLocale, PUBLIC_COPY } from "@/lib/public-site";

export default async function PublicLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = PUBLIC_COPY[locale];

  return (
    <div className="public-site">
      <header className="public-header">
        <Link className="public-logo" href={`/${locale}`}>{copy.brand}<span>Sprachschule</span></Link>
        <nav aria-label={locale === "de" ? "Hauptnavigation" : "Main navigation"} className="public-nav">
          <Link href={`/${locale}`}>{copy.home}</Link>
          <Link href={`/${locale}/kurse`}>{copy.courses}</Link>
          <Link href={`/${locale}/about`}>{copy.about}</Link>
          <Link href={`/${locale}/prices`}>{copy.prices}</Link>
          <Link href={`/${locale}/einstufung`}>{copy.test}</Link>
          <Link href={`/${locale}/kontakt`}>{copy.contact}</Link>
        </nav>
        <nav aria-label="Language" className="public-languages">
          <Link aria-current={locale === "de" ? "page" : undefined} href="/de">DE</Link>
          <Link aria-current={locale === "en" ? "page" : undefined} href="/en">EN</Link>
        </nav>
      </header>
      <main className="public-main">{children}</main>
      <footer className="public-footer">
        <span>© Linguasud · Schaffhausen & Winterthur</span>
        <span><Link href={`/${locale}/terms`}>{copy.terms}</Link> · <Link href={`/${locale}/privacy`}>{copy.privacy}</Link> · <Link href="/login">Login</Link></span>
      </footer>
    </div>
  );
}
