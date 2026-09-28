export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const PAGE_SLUGS = ["start", "about", "prices", "terms", "privacy"] as const;
export type PageSlug = (typeof PAGE_SLUGS)[number];

export function isLocale(value: string): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

export function isPageSlug(value: string): value is PageSlug {
  return PAGE_SLUGS.some((slug) => slug === value);
}

export const PUBLIC_COPY = {
  de: {
    brand: "Linguasud",
    home: "Start",
    courses: "Freie Kursplätze",
    contact: "Anfrage",
    test: "Deutsch-Einstufung",
    about: "Über uns",
    prices: "Preise",
    terms: "AGB",
    privacy: "Datenschutz",
    intro: "Sprachen lernen in Schaffhausen und Winterthur",
    subtitle: "Finde einen fortlaufenden Sprachkurs in einer kleinen Gruppe. Ein Einstieg ist jederzeit auf Anfrage möglich.",
    browse: "Kurse entdecken",
    ask: "Beratung anfragen",
    places: "freie Plätze",
    noCourses: "Derzeit sind keine Gruppenkurse mit freien Plätzen veröffentlicht. Frag uns nach einer passenden Lösung.",
    print: "Kursblatt drucken / als PDF speichern",
    location: "Standort auf Anfrage",
    days: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
    planned: "Geplant",
  },
  en: {
    brand: "Linguasud",
    home: "Home",
    courses: "Available courses",
    contact: "Enquiry",
    test: "German level check",
    about: "About us",
    prices: "Prices",
    terms: "Terms",
    privacy: "Privacy",
    intro: "Learn languages in Schaffhausen and Winterthur",
    subtitle: "Find an ongoing language course in a small group. Ask us about joining at any time.",
    browse: "Browse courses",
    ask: "Ask for advice",
    places: "places available",
    noCourses: "No group courses with available places are listed right now. Ask us about other options.",
    print: "Print course sheet / save as PDF",
    location: "Location on request",
    days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    planned: "Planned",
  },
} as const;
