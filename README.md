# Linguasud Software

Verwaltungssoftware für eine Sprachschule: Büroverwaltung, Teilnehmende, Lehrpersonen, Kurse, Räume, Lektionsplanung, Anwesenheit und Abrechnungsvorbereitung. Die Anwendung verwendet ausschliesslich PostgreSQL; es gibt keinen Demo-Daten-Fallback.

## Voraussetzungen

- Node.js 22.22.2 oder neuer
- npm 10 oder neuer

## Lokal starten

```bash
npm install
cp .env.example .env.local
 # PostgreSQL separat starten und DATABASE_URL in .env.local setzen
node --env-file=.env.local scripts/migrate.mjs
npm run dev
```

Danach führt `/` zur deutschen Website `/de`. Die englische Website liegt unter `/en`, die geschützte Verwaltung unter `/verwaltung` und die Anmeldung unter `/login`.

## Wichtige Befehle

```bash
npm run dev        # Entwicklungsserver
npm run build      # Produktions-Build
npm run start      # Produktionsserver
npm run lint       # ESLint
npm run typecheck  # TypeScript-Prüfung
npm run test       # Tests einmalig ausführen
npm run test:watch # Tests im Watch-Modus
npm run check      # Lint, Typen und Tests
```

## Struktur

```text
src/
├── app/           # Öffentliche und interne Routen, APIs, Styles
├── components/    # UI-Komponenten
├── lib/           # Typen und browser-/serverübergreifende Helfer
└── server/        # Datenzugriff und fachliche Services
```

Server Components sind der Standard. `"use client"` sollte nur dort eingesetzt werden, wo Browser-APIs, lokaler Zustand oder Interaktionen benötigt werden.

Der gewünschte Funktionsumfang steht in [`docs/pflichtenheft.md`](docs/pflichtenheft.md). Das aktuelle Schema wird durch die Migrationen in `database/migrations/` aufgebaut.

## Öffentliche Website

- `/de`, `/en`: öffentliche Inhalte; `/de/kurse` und `/en/kurse`: Gruppenkurse mit tatsächlich freien Plätzen. Die Kapazität ist die kleinere Zahl aus Kursart und Standardraum, minus aktive Anmeldungen. Volle/inaktive Kurse werden nicht veröffentlicht.
- Kursblätter können aus der Kursliste über die Browser-Druckfunktion als PDF gespeichert werden.
- `/de/kontakt`, `/en/kontakt`: Anfrage ohne Kontenerstellung, mit Büro-Aufgabe.
- `/de/einstufung`, `/en/einstufung`: unverbindlicher Deutsch-Kurztest (A1–B2). Das Büro bestätigt die Einstufung und ordnet Ergebnisse nach Identitätsprüfung zu; eine behauptete E-Mail-Adresse reicht zur automatischen Kontoverknüpfung nicht aus.
- Büro/Admin bearbeiten veröffentlichte Texte pro Sprache unter `/webseite` und bearbeiten Anfragen unter `/anfragen`. Texte werden als Klartext angezeigt. Personen- und Zahlungsdaten werden nicht öffentlich ausgegeben.

## Umgebungsvariablen

Neue Variablen werden in `.env.example` dokumentiert und in `src/lib/env.ts` validiert. Geheimnisse gehören ausschließlich in `.env.local` und werden nicht eingecheckt.

## Deployment mit Coolify

**Neubau-Stand: Die Schema-Baseline setzt eine frische, leere PostgreSQL-Datenbank voraus.** Die Migrationen sind keine Upgrade-Migration für die bisherige Mock-up-Datenbank. Deshalb den neuen Stand nicht gegen die bestehende Coolify-DB starten, bevor ein separater Migrations-/Übernahmeplan festgelegt wurde. Der Container führt vor dem Start ausstehende Migrationen aus und legt bei einer leeren Datenbank das erste Büro-/Adminkonto an.

In Coolify sind für den App-Service diese Variablen zu setzen:

```text
DATABASE_URL=<interne PostgreSQL-Verbindungs-URL aus Coolify>
BOOTSTRAP_ADMIN_EMAIL=<E-Mail für das erste Bürokonto>
BOOTSTRAP_ADMIN_PASSWORD=<mindestens 12 Zeichen>
NEXT_PUBLIC_APP_URL=<öffentliche Basis-URL, auch beim Docker-Build setzen>
```

`/api/health` bestätigt die Datenbankverbindung mit `{ "status": "ok" }`.

**Stand der Integrationen:** Die bexio-Anbindung ist derzeit nur eine Schnittstelle ohne produktive OAuth-Synchronisation. Der öffentliche Kurztest dient ausschliesslich der ersten Orientierung; seine Fragen und das Ergebnis ersetzen keine Einstufung durch die Sprachschule. Ein Mail-Provider muss separat konfiguriert und die Versand-Queue betrieben werden. Backups und Betriebsüberwachung sind noch einzurichten.
