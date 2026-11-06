# Bifă ✓🔔

Aplicație iOS (SwiftUI + SwiftData) în care îți notezi lucruri și le bifezi: comenzi, plăți, de făcut, notițe, remindere — și orice listă nouă vrei tu, cu regulile ei.

## Ce face

- **3 tab-uri**
  - **Azi** – tot ce e întârziat, de azi și din următoarele 7 zile, din toate listele.
  - **Liste** – listele tale. Vin 5 presetate: *De făcut, Comenzi, Plăți, Notițe, Remindere*. Le poți reordona (Editează), schimba sau șterge, și poți crea liste noi.
  - **Remindere** – agenda tuturor reminderelor, pe zile.
- **Reguli pe fiecare listă** (glisează spre stânga pe o listă → *Reguli*, sau ⋯ → *Reguli listă*):
  - termen/dată (cu sau fără oră, și cum se numește: „Scadență”, „Livrare estimată”…)
  - sumă de bani + monedă, *plătit / neplătit*, *de plătit / de primit*
  - **sub-elemente** (ex: produsele unei comenzi, fiecare bifat separat; comanda apare „Parțial · 2/3 produse” și se bifează singură când vin toate)
  - persoană/magazin, cod/AWB, prioritate, grupuri
  - remindere: oprite / opționale / fiecare element e un reminder
  - **reminder automat** cu X zile înainte de termen, la ora aleasă
  - grupare (după dată / grup / deloc), sumar sus, ștergere automată a celor bifate după 1/7/30 zile
  - șabloane: poți copia regulile de la Comenzi/Plăți/etc. într-o listă nouă
- **Remindere cu sunet** la zi + oră, cu repetare (zilnic/săptămânal/lunar/anual) și scurtături („Peste o oră”, „Mâine 9:00”, „Cu o zi înainte”…). Din notificare poți **Bifa** sau **Amâna 10 min / 1 oră**.
- Swipe pe element: bifează, plătit/neplătit, șterge. Căutare în fiecare listă.

## Cum obții aplicația pe iPhone (fără Mac)

1. Urcă folderul ăsta într-un repo nou pe GitHub (de pe github.com: *New repository* → *uploading an existing file* → trage tot conținutul folderului `Bifa`, inclusiv folderul `.github`).
   > Pe Windows, folderul `.github` e uneori ascuns la drag & drop. Dacă nu apare în repo, creează din GitHub fișierul `.github/workflows/build.yml` și lipește conținutul lui.
2. În repo → tab-ul **Actions** → workflow-ul **Build IPA** pornește singur (sau *Run workflow*). Durează ~5 minute.
3. Când e verde, deschide rularea → jos la **Artifacts** descarcă `Bifa-ipa` (un zip cu `Bifa.ipa`).
4. Instalează IPA-ul pe telefon cu **Sideloadly** (Windows, gratuit) sau **AltStore**, logat cu Apple ID-ul tău.
   - Cu un Apple ID gratuit, aplicația trebuie re-semnată la **7 zile** (AltStore o face automat cât timp PC-ul e pornit; Sideloadly – reinstalezi). Datele rămân.
   - Pe iOS 16+ trebuie activat **Developer Mode** (Setări → Confidențialitate și securitate → Mod dezvoltator).
   - Cu un cont Apple Developer plătit (99$/an) ține un an și poți folosi TestFlight.
5. La primul reminder, aplicația îți cere voie pentru notificări — apasă *Permite*.

## Structură

```
project.yml                 – specificația proiectului (XcodeGen generează .xcodeproj pe GitHub)
.github/workflows/build.yml – build-ul automat care scoate Bifa.ipa
Bifa/BifaApp.swift          – pornire, tab-uri
Bifa/Models/                – ListCategory (liste + reguli), Entry (elemente), SubItem (produse/pași)
Bifa/Services/              – NotificationManager (remindere, Bifează/Amână din notificare)
Bifa/Views/                 – ecranele
tools/make_icon.py          – generează iconița (python tools/make_icon.py)
```

Dacă ai Mac: `brew install xcodegen && xcodegen generate && open Bifa.xcodeproj`.
