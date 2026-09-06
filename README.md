# Linguasud Software

Solides Fundament für eine moderne Webanwendung mit Next.js, React und TypeScript.

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

## Umgebungsvariablen

Neue Variablen werden in `.env.example` dokumentiert und in `src/lib/env.ts` validiert. Geheimnisse gehören ausschließlich in `.env.local` und werden nicht eingecheckt.
