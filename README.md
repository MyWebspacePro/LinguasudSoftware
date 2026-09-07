# Linguasud Software

Verwaltungssoftware für eine Sprachschule: Büroverwaltung, Teilnehmende, Lehrpersonen, Kurse, Räume, Lektionsplanung, Anwesenheit und Abrechnungsvorbereitung. Die Anwendung verwendet ausschliesslich PostgreSQL; es gibt keinen Demo-Daten-Fallback.

## Voraussetzungen

- Node.js 22 oder neuer
- npm 10 oder neuer

## Lokal starten

```bash
npm install
cp .env.example .env.local
npm run dev
```

Danach ist die Anwendung unter [http://localhost:3000](http://localhost:3000) erreichbar.

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
├── app/           # Routen, Layouts und globale Styles
├── components/    # Wiederverwendbare UI-Komponenten
└── lib/           # Konfiguration und fachunabhängige Helfer
```

Server Components sind der Standard. `"use client"` sollte nur dort eingesetzt werden, wo Browser-APIs, lokaler Zustand oder Interaktionen benötigt werden.

Das relationale Datenmodell und die verfügbaren Querverweise zwischen Kursen, Räumen, Standorten, Lehrpersonen, Teilnehmenden, Lektionen und Einschreibungen sind in [`docs/data-model.md`](docs/data-model.md) dokumentiert.

## Umgebungsvariablen

Neue Variablen werden in `.env.example` dokumentiert und in `src/lib/env.ts` validiert. Geheimnisse gehören ausschließlich in `.env.local` und werden nicht eingecheckt.

## Deployment mit Coolify

Die bestehende PostgreSQL-Datenbank in Coolify bleibt erhalten. Beim Start führt der Container alle noch nicht angewendeten Migrationen aus und legt das erste Bürokonto nur dann an, wenn dessen E-Mail-Adresse noch nicht existiert.

In Coolify sind für den App-Service diese Variablen zu setzen:

```text
DATABASE_URL=<interne PostgreSQL-Verbindungs-URL aus Coolify>
SESSION_SECRET=<langer zufälliger Geheimwert>
BOOTSTRAP_ADMIN_EMAIL=<E-Mail für das erste Bürokonto>
BOOTSTRAP_ADMIN_PASSWORD=<mindestens 12 Zeichen>
```

Nach dem Deployment bestätigt `https://linguasudsoftware.aiconso.eu/api/health` die Bereitschaft nur dann mit `{ "status": "ok" }`, wenn die App PostgreSQL erreicht. Ein anderer Status weist auf eine fehlende oder fehlerhafte Datenbankverbindung hin.
