# Droker · prezentacja na hackathon

Pitch deck dla tematu #1 (*Zanim zdecydujesz*, patrz [`../docs/hackathon-rules.md`](../docs/hackathon-rules.md)) jako aplikacja [TanStack Start](https://tanstack.com/start). Każdy slajd czyta **Bolek**: głos z xAI Grok Voice, a ten sam orb, który w produkcie stoi na wyświetlaczu sali spotkań, porusza się w rytm głosu i podlatuje do elementu slajdu, o którym akurat mówi.

## Uruchomienie

```bash
cd presentation
cp .env.example .env      # wpisz XAI_API_KEY
npm install
npm run dev               # http://localhost:3100
```

Przed występem warto zsyntezować całą narrację do cache (`.cache/tts`, ignorowany przez git), żeby na scenie nic nie czekało na sieć:

```bash
npm run tts:prewarm
```

Bez klucza aplikacja działa dalej: Bolek mówi głosem przeglądarki (`speechSynthesis`, `pl-PL`), a wskazywanie elementów opiera się o zdarzenia `onboundary`.

## Sterowanie

| Klawisz | Działanie |
| --- | --- |
| `→` `Space` `PageDown` | następny slajd |
| `←` `PageUp` | poprzedni slajd |
| `Home` / `End` | pierwszy / ostatni slajd |
| `R` | powtórz narrację slajdu |
| `P` | pauza / wznów |
| `A` | automatyczne przejście po narracji (domyślnie włączone) |
| `V` | lektor włączony / wyłączony |
| `F` | pełny ekran |

Adres `?s=N` otwiera slajd N.

## Jak to działa

- `src/slides/deck.tsx`: slajdy jako komponenty na stałym kanwasie 1600×900 (`Stage` skaluje go do okna). Element, na który Bolek ma wskazać, owija się w `<Cue id="...">` (albo `<Card cue="...">`).
- `src/slides/narration.ts`: tekst narracji z markerami `{{cue-id}}` w miejscach, gdzie orb ma podlecieć do elementu; `[pause]` to tag mowy Groka.
- `src/routes/api/tts.ts` → `src/lib/tts-server.ts`: proxy do `POST https://api.x.ai/v1/tts` z `with_timestamps: true`. Klucz zostaje na serwerze, odpowiedź (mp3 w base64 + czasy znaków) trafia do cache na dysku.
- `src/lib/narrator.ts`: odtwarza klip przez `<audio>` → `AnalyserNode`; RMS sygnału zasila `levelRef` orba (stąd „rusza się, jak mówi”), offsety markerów mapuje na `graph_times` Groka i odpala cue w momencie wypowiedzenia słowa; postęp znaków zasila napis w pasku.
- `src/components/orb-pointer.tsx`: orb w spoczynku siedzi obok tytułu, przy cue szuka miejsca obok elementu (lewo / prawo / góra / dół), które nie zasłania innych elementów.
- `src/orb/`: kopia `NebulaOrb` z głównej aplikacji (three + react-three-fiber, fallback CSS bez WebGL).
