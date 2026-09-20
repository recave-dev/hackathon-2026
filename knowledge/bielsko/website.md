---
id: bielsko-ai-website-2026-09
kind: note
date: 2026-09-15
topic: bielsko.ai website
---

# Strona bielsko.ai

Adres: https://bielsko.ai. Statyczna strona (Astro) w repozytorium GitHub `bielsko-ai/bielsko.ai`, hostowana na Netlify. Każdy pull request do gałęzi `main` po scaleniu wdraża się automatycznie w około 2 minuty.

## Sekcje strony głównej

1. Hero: nazwa społeczności i hasło „AI po bielsku”.
2. Następny meetup: numer edycji, data, godzina, miejsce, przycisk „Zarejestruj się” (link do Luma). Obecnie: „bielsko.ai 003 — jesień 2026, szczegóły wkrótce”.
3. Poprzednie edycje: karty 001 i 002 ze zdjęciami i liczbą uczestników.
4. Partnerzy: logotypy partnerów miejsca i sponsorów.
5. Kontakt: hello@bielsko.ai, LinkedIn, Meetup.com.

## Jak aktualizować „Następny meetup”

Dane są w pliku `src/content/next-meetup.json` (pola: `edition`, `date`, `time`, `venue`, `venueUrl`, `lumaUrl`). Zmiana pliku, pull request, scalenie. Za treść strony odpowiada Michał Staśkiewicz.
