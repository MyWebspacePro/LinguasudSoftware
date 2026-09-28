export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const PAGE_SLUGS = ["start", "about", "prices", "terms", "privacy"] as const;
export type PageSlug = (typeof PAGE_SLUGS)[number];

export type PublicInquiry = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  language: string | null;
  courseForm: string | null;
  message: string | null;
  handled: boolean;
  participantId: string | null;
  createdAt: string;
};

export type PlacementRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  resultLevel: string | null;
  participantId: string | null;
  createdAt: string;
};

export const CONSENT_COPY = {
  de: "Ich bin mit der Bearbeitung meiner Angaben zur Beantwortung dieser Anfrage bzw. Einstufung und Kontaktaufnahme einverstanden.",
  en: "I agree to the processing of my details to respond to my enquiry or level check and to contact me.",
} as const;

const englishLanguages: Record<string, string> = {
  DE: "German", EN: "English", FR: "French", IT: "Italian", ES: "Spanish", XX: "Other languages",
};

const englishCourseKinds: Record<string, string> = {
  PRV: "Private", DUO: "Duo", KL3: "Small group (3)", KL4: "Small group (4)",
  GRU: "Small group (up to 6)", ONL: "Online private",
};

export function publicLanguageName(code: string, name: string, locale: Locale): string {
  return locale === "en" ? englishLanguages[code] ?? name : name;
}

export function publicCourseKindName(code: string, name: string, locale: Locale): string {
  return locale === "en" ? englishCourseKinds[code] ?? name : name;
}

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
