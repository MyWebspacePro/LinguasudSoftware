# Pflichtenheft – Linguasud Verwaltungssoftware

Stand: erarbeitet im Anforderungs-Durchgang (Module 1–13).

## 1. Kontext

- Fertige Verwaltungssoftware für eine Schweizer Sprachschule (Region Schaffhausen–Winterthur).
- Noch **nicht verkauft**; Betrieb auf eigenem VPS, später eventuell auf lokalem NAS.
- Die bisherige Applikation war ein Mock-up und wird durch einen sauberen Neubau ersetzt.
- Währung: **CHF**.

## 2. Rollen & Rechte (Modul 1)

Rollen: **Büro**, **Lehrperson**, **Teilnehmer**, **Finanzen/Buchhaltung**, **Admin**.

- **Ein Konto kann mehrere Rollen** haben (Lehrperson kann zusätzlich Teilnehmer und/oder Büro sein).
- Pro Person **ein Login**; die App bietet einen **Ansichtsumschalter** (Büro / Lehrperson / Teilnehmer). Kein zweiter Account.
- **Büro:** volle Verwaltung aller Stammdaten, Kurse, Räume, Planung, Anwesenheitsentscheide, Kursniveau-Einträge, Kommunikation, Historie. **Keine** finanziellen Auswertungen.
- **Lehrperson:** Anwesenheit erfassen; sieht Namen und Telefonnummern der Teilnehmenden ihrer Kurse; trägt Niveauwechsel ein (Büro bestätigt) – **einzige** Änderungsberechtigung; meldet Abwesenheit/Urlaub.
- **Teilnehmer:** kein Konto anlegen, keine Änderungen; sieht Lektionen (Ort/Zeit/abgesagt), Anwesenheiten, Rechnungen; kann Abwesenheit melden.
- **Finanzen/Buchhaltung:** Auswertungs-/Übersichtssicht. Zugriff: Chefin, Chef, Buchhaltungs-Mitarbeiterin, Admin. Normale Büromitarbeitende nicht.
- **Admin:** technische Rolle (Inhaber), sieht auch Finanzen.
- Deaktivierte Konten können sich **nicht** anmelden; Deaktivierung beendet offene Sitzungen.

## 3. Standorte & Räume (Modul 2)

- Standorte: **Vorstadt** (Hauptstandort, 1./2./4. Stock), **Stadthausgasse** (2. Standort SH, ca. 3. Stock), **Winterthur** (ca. 3. Stock, nur Kursräume).
- Standorte können jederzeit dazu kommen oder wegfallen; Pflege nur Büro.
- Räume: Name (z.B. Oxford, Brisbane, New York, Malta, Paris), Standort, Kapazität, **Etage**, aktiv/inaktiv. Keine weiteren Merkmale.
- **Raumvermietung:** fixe Zeiträume und Serien (z.B. Nothelferkurs alle 2 Wochen Fr abends + Sa; Kinderspielgruppe). Im Belegungsplan sichtbar, belegt den Raum wie ein Kurs.
- Vergabezeitfenster: 06:30–22:30; Kurse Mo–Sa (keine harten Öffnungszeiten, Abweichungen mit Warnung/Bestätigung).
- Standortwechsel: Schaffhausen-Kurse dürfen den Standort wechseln; **Winterthur bleibt Winterthur**.

## 4. Teilnehmende (Modul 3)

- Anrede (inkl. **divers**), Vorname, Nachname (robust für lange/ausländische Namen), E-Mail, **Telefon 1 + 2**, Kontaktkanäle (**WhatsApp/Signal** als Häkchen).
- Adresse: Strasse, PLZ, Ort, Adresszusatz.
- **Geburtsdatum nur bei Lehrpersonen/Büromitarbeitenden**, nicht bei Teilnehmenden.
- **Kostenträger:** Selbstzahler, Firma, Behörde („Haus der Kulturen“ SH bzw. Äquivalent Winterthur), Eltern (bei Kindern als Rechnungs-/Notfallkontakt).
- **Status pro Kursanmeldung:** Interessent / Probelektion / Aktiv / Inaktiv. Eine Person kann in verschiedenen Kursen unterschiedliche Status haben.
- Freie **Notizen mit Autor** und Datumstempel.
- Ansicht Teilnehmende: besuchte Kurse (gleichzeitig/nacheinander), offene Rechnungen, Historie.
- **Marketing:** „Wie auf uns aufmerksam geworden“.
- **Einwilligungen** (AGB/Datenschutz) mit Nachweis.
- **Suche:** Volltext + vielfältige Filter (z.B. nur Aktive).
- **Excel-Import** bestehender Kundendaten (ca. 17.000 Zeilen) nach Bereinigung.

## 5. Lehrpersonen (Modul 4)

- Eigene Verwaltung (getrennt von Teilnehmenden).
- Stammdaten wie Teilnehmende, zusätzlich **Muttersprache**, **Startniveau**, Geburtsdatum.
- **Kürzel:** 3 Buchstaben Vorname + 3 Buchstaben Nachname + laufende Nummer (z.B. `MARKEL01`); bei Gleichheit `02`.
- Qualifikationen: Sprache + Niveau (A0–C2). Diplome aktuell keine; Kursbestätigungen gewünscht.
- **Honorar:** pro Lehrperson **eigener Stundensatz je Kursart** (privat, 2er-Duo, 3er-, 4er-, 6er-Gruppe).
- Abwesenheit: meist keine Stellvertretung, ausser bei längeren Absenzen (Kursübernahme). Alle stundenweise bezahlt.
- **Lektion „absolviert“** markiert die Lehrperson am Lektionsende (nach Erfassung aller Anwesenheiten).
- **Monatsauswertung** geleisteter Lektionen → automatisch/per Knopf → Export für Lohn.

## 6. Kurse (Modul 5)

- Kein Enddatum im Normalfall (fortlaufend); Ausnahme Ferien-/Intensivkurse.
- Kursarten/Gruppengrössen **frei definierbar** (Einzel, Duo, 3er, 4er, 6er, Online, Firma, Gruppe).
- **Niveau:** A0–C2, keine Zwischenstufen. Realer Start meist A1.
- **Niveauwechsel:** Kurs läuft fort; Lehrperson meldet in der App, **Büro bestätigt/trägt ein**; Historie.
- **Kurskennung:** `SPRACHE-NIVEAU-KURSART-KÜRZEL-KURSNR`, z.B. `DEA2GRU-MARKEL01-01`.
  - Intern stets **stabile UUID**; die sichtbare Kennung ist **änderbar** (Niveau/Lehrkraftwechsel) mit **Kennungshistorie**.
  - Zusätzlich **Kurzkürzel** für den Belegungsplan.
- **Kapazität:** Gruppen max. 6 (Ausnahmen bei Probelektionen). Keine Warteliste; Einstieg jederzeit.
- Online-Kurse: Raum optional (manche von zu Hause, manche im Raum); optionaler Link.
- **Preis:** pro Anmeldung wird der **vereinbarte Preis gespeichert** (Tarif-Matrix + Historie).

### Tariflogik (konfigurierbar)
- **Gruppenkurse:** Hoch-/Niedertarif **je nach Zeit**; vormittags/nachmittags günstiger, über Mittag/abends teurer. Nicht für Privat-/Firmenkurse.
- Berechnung nach **Gruppengrösse × Lektionsdauer × Tarif**.
- **Normaltarif = 14 Lektionen, Niedertarif = 15 Lektionen** (Vorauspaket).
- Einzelunterricht: Staffeln nach gebuchten Lektionen; Normaltarif (über Mittag/abends Mo–Do) und Niedertarif (Vormittag/Nachmittag, Fr+Sa).
- **Keine Rabatte** (weder Studenten- noch Mengenrabatt).
- Preise werden **jährlich pflegbar** ohne Codeänderung.

## 7. Belegungsplan (Modul 6)

- 15-Minuten-Raster, **Drag’n’Drop**.
- Standardansicht: oben **Standorte**, darunter deren **Kursräume**, links **Uhrzeit**.
- **15 Min Übergabezeit** zwischen Belegungen; Überschreiten mit **Warnung + Bestätigung**.
- Übliche Lektionsdauern 45/60/75/90/120 Min.
- Kursrhythmus: 1×/Woche, alle 14 Tage, mehrfach/Woche; **gemischte Einheiten pro Woche möglich** (z.B. 90 + 60).
- **Provisorisch vs. fixiert:** Verschieben erzeugt zuerst einen gespeicherten **provisorischen** Stand (nur Büro sichtbar, Markierung/Rahmen). Erst beim **Fixieren** erhalten Lehrperson + Teilnehmende die Info.
- **Verschiebung gilt nur für den Einzeltermin**; dauerhafte Änderungen in den Kursdaten.
- Fixieren **pro Änderung und als Sammelaktion**; Verwerfen möglich.
- **Urlaub:** Kurs bleibt **ausgegraut** sichtbar (Zeitsperre).
- Vermietungen im selben Raster, belegt.
- Druckbarer Belegungsplan.

## 8. Anwesenheit (Modul 7)

- Status nur: **anwesend**, **entschuldigt abwesend**, **unentschuldigt abwesend**. (Kein „online“, „zu spät“ oder „Probelektion“ als Anwesenheitsstatus.)
- Ablauf: Lehrperson meldet sich an, erfasst Anwesenheiten und schliesst mit **„absolviert“** ab.
- Bei Abwesenheit erhält das **Büro** die Info und entscheidet **bezahlt / nicht bezahlt** (= entschuldigt/unentschuldigt).
- **Guthaben:** entschuldigt verlängert um einen Termin; unentschuldigt verbraucht.
- Lehrperson krank / angeordneter Urlaub: kein Guthabenverbrauch. Ab mehreren Monaten Kursübernahme.
- Büro darf alles nachtragen/ändern/korrigieren (mit Historie).
- Teilnehmende können Abwesenheit melden → Lehrperson + Büro informiert.

## 9. Rechnungen, Kostenträger, Finanzen (Modul 8)

- **Selbstzahler:** Paket 14/15 Lektionen wird bei Kurszuordnung mit feststehenden Kosten **im Voraus** in Rechnung gestellt.
- **Kostenträger:** Monatsrechnung im Nachhinein, aufgeschlüsselt (Datum/Teilnehmer/Lektionen/Betrag), **PDF/Export**; Providierung ggf. mit Kostennummer.
- **Zahlungsstatus:** kein manuelles Pflegen → **Synchronisation mit bexio**.
- **bexio:** REST-API v2.0 mit OAuth 2.0; Ressourcen u.a. `contact`, `kb_invoice`, `kb_offer`, `kb_order`, `article`, `payment_type`, `accounts`. Als **Adapter** umgesetzt; Webhook-Unterstützung für Zahlungseingänge zu verifizieren.
- **Mahnwesen:** in bexio.
- **Finanz-Auswertungen** (Chef/Chefin/Buchhaltung/Admin): Umsatz, offene Beträge, Honorare, „alles“.
- **Honorar:** Monatsliste geleisteter Lektionen × Lehrperson-Satz + „bezahlt“-Vermerk.

## 10. Kommunikation, Benachrichtigungen & Aufgaben (Modul 9)

- Kanäle: **E-Mail** (Priorität) und **App-Push** (Web Push). WhatsApp/Signal vorerst nur als Kontaktinfo (später).
- Anlässe: Kursabsage (sofort Push + E-Mail), Raumwechsel nach Fixierung, Teilnehmer-Abwesenheitsmeldung an Lehrperson + Büro, **Reminder 12 h vorher**, AGB/Datenschutz-E-Mail bei Anlage. **Niveauwechsel ohne Benachrichtigung** (nur Hinweis im Büro).
- **Aufgaben-System** (intern nur Büro): Titel, Beschreibung, Zuweisung an Person, Status (offen/in Arbeit/erledigt), Priorität, Fälligkeit, Kommentarverlauf, Historie, Verknüpfung zu Person/Kurs/Kostenträger. Ersatz für den bisherigen Thunderbird-Entwurf-Workflow.
- **App läuft vollständig ohne E-Mail-Versand**; In-App/Push funktionieren immer.
- E-Mail-Versand: **kein eigener SMTP-Server**; Transaktions-Mail-Dienst oder bestehender Mailhost, hinter einer austauschbaren Abstraktion + asynchroner Queue.
- E-Mail-Eingang ins System (IMAP) als spätere Ausbaustufe; Thunderbird-Ablösung optional.

## 11. Historie, Audit, Druck/Export (Modul 10)

- Vollständige Änderungshistorie pro Datensatz (wer/wann/vorher/nachher).
- Globale, durchsuchbare **Audit-Ansicht**.
- **Sicherheitsereignisse** (Login, Fehl-Login, Passwortänderung) protokollieren.
- Druck/PDF: Belegungsplan, Präsenzlisten, Teilnehmer-/Kurslisten, Kostenträger- und Honorar-Abrechnung, Kursbestätigungen.
- Export von allem, was eingegeben werden kann (Backup/Sicherung).

## 12. Öffentliche Website (Modul 11)

- Neue Website als **eigener Bereich derselben App**, mit einfachem **CMS** für Inhalte und **automatischen Kurslisten** aus der Verwaltung.
- Sprachen: **Deutsch + Englisch**. Hauptdomain **`.com`** (`.ch` optional).
- **Kursblätter** werden automatisch erzeugt (lesbar, mit freien Plätzen), pro Sprache.
- **Nur Anfragen**, keine Online-Buchung.
- **Anfrageformular** (Anrede, Name, E-Mail, Telefon, Sprache, Unterrichtsform, Selbsteinschätzung, Ziel, Nachricht) → erzeugt **Interessent + Aufgabe** im Büro.
- **Einstufungstest Deutsch:** Ergebnis wird dem richtigen Kunden (Interessent) zugeordnet.
- **Einwilligung** (Datenschutz) Pflicht.
- Seiten ungefähr: Start, Über uns, Sprachen, Kursarten, Preise, Kontakt, AGB/Datenschutz.

## 13. Büro-Dienstplan (Modul 12)

- 15-Minuten-Raster mit unterschiedlichen Schichtlängen.
- Zeigt die **Bürobesetzung** pro Zeitfenster.
- **Urlaubsplanung** der Mitarbeitenden.
- Annahme: Chef/Chefin plant und gibt frei; Mitarbeitende können Urlaub **beantragen**.
- Druckbar/Export.

## 14. Betrieb (Modul 13)

- VPS (aktuell ist Produktion = Test); später evtl. NAS.
- Backups → **Backblaze** und ggf. Spiegel-VPS.
- **Monitoring/Alarme**: Fehler/Betriebsstörungen melden, Aussencheck (Uptime).
- **Web-Push** über HTTPS (keine native App geplant).
- **2FA** und IP-Beschränkung: später.
- **DSG-Konzept** (Aufbewahrung/Löschung/Anonymisierung).

## 15. Technische Architektur (Vorschlag)

- **Next.js (App Router) + PostgreSQL**; öffentlicher und interner Bereich getrennt in einer App.
- Schichten: `server/services` + `repositories`, zentrale **Typen**, **API-Client**, zentrale Auth-/Fehler-Helfer; Zod an jeder Grenze.
- Auth: Mehrfachrollen (n:m) + Ansichtsumschalter, `active`-Durchsetzung, Session-Widerruf, Rate-Limit/Brute-Force-Schutz.
- Integrationen: bexio (OAuth2) hinter Adapter, E-Mail-Abstraktion + Queue, Web Push, PDF-Erzeugung, Excel-Import-Pipeline.
- Tests für Kernpfade (Auth, Abrechnung, Planung, Anwesenheit, Migrationen).

## 16. Umsetzungsphasen

0. **Basis & Sicherheit:** Repo/CI/Env, konsolidierte Schema-Baseline, Auth mit Mehrfachrollen, `active`, Rate-Limit, Docker-Härtung.
1. **Stammdaten:** Personen/Rollen, Organisationen/Kostenträger, Standorte/Räume.
2. **Kurse, Tarife, Anmeldungen, Guthaben.**
3. **Planer:** Drag’n’Drop, provisorisch/fixiert, Vermietung.
4. **Anwesenheit + Entscheid-Workflow.**
5. **Kommunikation, Aufgaben, Benachrichtigungen.**
6. **Rechnungen/bexio, Honorar, Finanz-Auswertungen.**
7. **Öffentliche Website + CMS + Kurslisten + Einstufungstest + Anfragen.**
8. **Dienstplan, Historie/Audit, Druck/Export, Excel-Import.**
9. **Betrieb** (Backups, Monitoring, DSG), Härtung, Abnahme.

## 17. Offene Punkte

- Excel-Import: Spaltenstruktur der Kundendatei liegt noch nicht vor.
- bexio: Webhook-Unterstützung für Zahlungseingänge verifizieren.
