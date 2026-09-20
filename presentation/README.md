# Droker · prezentacja HackBB 2026

Krótka prezentacja webowa na ścieżkę **Wsparcie C-Level**. Osiem slajdów: problem, wartość produktu, dwa techniczne schematy (źródła → Company Graph → Bolek oraz routing wypowiedzi), dwie plansze z filmami demonstracyjnymi i podsumowanie. Bez lektora i bez automatycznych przejść.

## Filmy

Umieść swoje pliki tutaj:

- `public/demos/demo-1.mp4`
- `public/demos/demo-2.mp4`

Plansze 6 i 7 pokażą odtwarzacze automatycznie po dodaniu plików. Do tego czasu wyświetlają czytelne miejsca na filmy. Jeśli pliki mają inny format lub nazwę, zmień ścieżki w `src/slides/deck.tsx`. Filmów nie ma w repozytorium.

## Uruchomienie

```bash
cd presentation
npm install
npm run dev
```

Otwórz `http://localhost:3100`. Prezentacja nie wymaga kluczy API.

## Sterowanie i czas

Strzałki, PageUp/PageDown oraz przyciski w stopce zmieniają slajdy; `Home`/`End` prowadzą do początku/końca, a `F` włącza pełny ekran. Spacja przechodzi do następnego slajdu tylko poza planszami z filmem, aby nie przeskoczyć nagrania. Filmy uruchamia prezenter przyciskiem odtwarzania.

Przy limicie 10 minut i filmach o łącznej długości 7 minut zostają około 3 minuty na sześć krótkich slajdów i przejścia. Slajdy techniczne warto omówić po 20–25 sekund każdy; sprawdź długości rzeczywistych nagrań i przećwicz całość z zegarkiem. Schemat źródeł opisuje import plików demonstracyjnych, a nie działające konektory live.

Treść slajdów: `src/slides/deck.tsx`. Wygląd: `src/styles.css`.
