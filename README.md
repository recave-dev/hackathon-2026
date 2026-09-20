Welcome to your new TanStack Start app!

# Getting Started

To run this application:

```bash
bun install
bun --bun run dev
```

# Building For Production

To build this application for production:

```bash
bun --bun run build
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Remove the demo pages in `src/routes/demo/`
2. Replace the Tailwind import in `src/styles.css` with your own styles
3. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
4. Remove `@tailwindcss/vite` and `tailwindcss` from `package.json`


## Deploy with Nitro

This project uses Nitro as a generic server adapter, so it can run on any Node-compatible host.

```bash
npm run build
node dist/server/index.mjs
```

The build output is a self-contained Node server. To deploy, push the `dist/` directory to your host (Render, Fly.io, your own VPS, etc.) and run the server command above.

For host-specific presets (Vercel, Netlify, Cloudflare, AWS Lambda, etc.) and tuning, see https://v3.nitro.build/deploy.



## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')
  
  useEffect(() => {
    getServerTime().then(setTime)
  }, [])
  
  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).



# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).

## Decision graph prototype

The repository also contains a TypeScript ingestion core for the CEO decision workspace. It indexes Markdown by section, looks up existing entities, accepts a structured LLM graph patch, validates exact source quotes and relation types, previews a diff, and applies accepted changes to SQLite. The original files remain the source of truth.

The graph demo and tests require Node 24.9 or newer for built-in SQLite and TypeScript type stripping:

```sh
npm test
npm run demo
npm run typecheck
```

`npm run demo` uses a deterministic extractor fixture and does not make a cloud call. To try the OpenAI adapter, set `OPENAI_API_KEY` and `OPENAI_MODEL`, then run `npm run demo -- --live`. The adapter has not been live-tested against a cloud account.

The graph can be imported from `./src/graph/index.ts` in server-side application code. `KnowledgeGraph` provides `ingestDocument`, `applyProposal`, `searchNodes`, `searchChunks`, and `buildDecisionContext`. The context method returns cited evidence for a later synthesis call; it does not generate a recommendation or a numeric forecast. See [the ingestion design](docs/graph-and-ingestion-design.md) and [project ideas](docs/glossary/project-ideas.md).

## Synthetic demo corpus

[Aster Systems corpus guide](knowledge/synthetic/README.md) describes the fictional Slack threads, customer and vendor emails, meeting notes, and KPI observations for the build-versus-partner demo. The server-side loader returns graph-ready source documents and typed KPI rows:

```ts
import { loadSyntheticDocuments, loadSyntheticKpis } from './src/corpus/synthetic.ts';

const sources = await loadSyntheticDocuments({ asOf: '2025-05-12' });
const kpis = await loadSyntheticKpis({ asOf: '2025-05-12' });
// Pass each source to graph.ingestDocument(source, extractor), then review its proposals.
```

Use `asOf: '2025-11-19'` to replay the measured pilot outcome and next decision. The loader excludes the canonical fact sheet and corpus README so a pre-decision view cannot pick up future facts from those files.

The repository includes two shared graph databases, `knowledge/synthetic/demo-v3-2025-05-12.sqlite` and `knowledge/synthetic/demo-v3-2025-11-19.sqlite`. To make a separate local copy, run `npm run import:synthetic -- --as-of 2025-05-12` or use `2025-11-19` for the outcome snapshot. The command prints the path of its ignored `local-demo-v3-<date>.sqlite` file. The web UI is not yet connected to these databases. [docs/usecases.md](docs/usecases.md) lists the demo questions and the data behind each one. `npm run agent:support -- --as-of 2025-11-17 --db knowledge/synthetic/demo-v3-2025-11-19.sqlite` replays the support pattern watcher agent and files its proposal for review.

## Live meeting assistant (Bolek)

`/meeting` is a single screen meant to sit on the meeting-room display. The assistant is called **Bolek** and has two listening modes (toggle in the header):

- **Na imię „Bolek”** (default): the room talks freely; Bolek reacts only when addressed. Either inline, „Bolek, kim jest Darek Wylon?”, or a bare „Bolek.” which arms it for the next sentence. Wake-word matching is local (`src/lib/wake-word.ts`, tolerant of recogniser misspellings); the request, with the name stripped, goes to Jev in `command` mode and resolves to a person or a topic.
- **Zawsze**: every utterance is judged; a card appears when someone asks about a cost, an owner, a deadline or a result, and a topic only mentioned lands in the "Wspomniano" tray.

Anything else said to Bolek goes through an **intent router and an action layer**. Jev's command-mode call includes an `intent` choice over the specs in `src/lib/intents.ts`; `src/server/actions.ts` runs the matching action and the screen renders its result:

| Intent | What runs | Screen |
| --- | --- | --- |
| `person` | none; Jev's person match | profile card |
| `data` | `src/server/graph-answer.ts`: every node and edge of the SQLite graph, precomputed spend totals per metric and month, and the best full-text and graph-neighbourhood passages go into one Claude Haiku 4.5 call via OpenRouter | answer card with headline, sentences, bullets and the quoted `[Cn]` passages; "brak w danych" when the graph has nothing |
| `meeting` | the whole session transcript (with speakers, times and line ids) goes to the model, which picks the scope itself ("ostatni temat", "całe spotkanie", a named topic) | note card: bullets, decisions, action items with owners, open questions, and the turns it read |
| `general` | plain model call, last few turns as context | answer card, "Wiedza ogólna" |
| `web` | OpenRouter's `:online` variant of the same model; the question travels without meeting context so the search is not steered by the agenda | answer card, "Z internetu", with the pages read |
| `report` | **background task**: graph answer + transcript → a Markdown memo (250–500 words); the server keeps the task in memory, the screen polls `getTask` every 2 s | a small card in the left tray with a spinner, highlighted "gotowe" when it lands (or the document itself if nothing else is on screen) |

Fast actions take 3–5 s; the report about 20–30 s and does not block other questions. Everything that leaves the main screen (a background task, or a result replaced by a newer question) sits as a small card in the **tray on the left** (`src/components/meeting/tray.tsx`): spinner while running, a highlighted "gotowe" badge when finished and not yet opened, click to bring it back. The transcript, results, scenario position and running tasks persist in `localStorage`, so a reload mid-meeting keeps the conversation. Adding an action means one entry in `src/lib/intents.ts` (its English criterion is what Jev sees) and one branch in `runAction`. `npm run intent-eval` (`scripts/intent-eval.ts`) sends typical requests through Jev and prints the intent it picks (last run 15/16; "co nowego u ConnectorCo" went to `data`, which is defensible since ConnectorCo is in the graph).

Cards are of two kinds: **people** (`src/demo/people.ts`, hardcoded profiles for Darek Wylon, Piotr Zieliński and Patrycja Sowa: role, what they own, what they are on now, recent activity, practical notes) and **topics** (`KNOWLEDGE_CARDS` in `src/demo/knowledge.ts`): figures first, the answer from the asked angle, then who is responsible, what happened before, and the sources.

- **Router:** each judged utterance goes to [TypeSafe Jev](https://docs.typesafe.ai/) through a server function (`src/server/meeting-assist.ts`). One call asks five questions against the same state: `needs_info` (noul), `asks_person` (noul), `person` (choice over the people cards plus `none`), `topic` (choice over the knowledge cards plus `none`) and `facet` (choice: cost, owner, deadline, status, history, options). Thresholds and the ambient/command decision live in `src/server/relevance.ts`.
- **Offline fallback:** without `TYPESAFE_API_KEY` the same module uses a keyword matcher, so the demo never goes dark. The header badge says which engine answered and how long it took.
- **Input:** three scripted board meetings (`src/demo/knowledge.ts`, `SCENARIOS`) with autoplay or step-by-step (`Space`), the microphone, or a text box for typing what was said.
- **Speech to text:** the microphone streams 16 kHz PCM16 from an AudioWorklet to a local WebSocket proxy (`npm run stt:proxy`, `scripts/stt-proxy.ts`), which forwards it to xAI Grok Voice Transcribe 2.0 (`wss://api.x.ai/v1/stt`, Polish, interim results, Smart Turn end-of-turn detection, the wake word boosted via `keyterm`). The proxy keeps `XAI_API_KEY` off the browser. Utterances arrive on `speech_final` and go straight into the wake-word matcher and Jev. If the proxy is down the button falls back to the browser's Web Speech API. `npm run stt:smoke <file.wav>` streams a WAV through the proxy and prints Grok's events; on macOS make one with `say -v Zosia -o bolek.wav --data-format=LEI16@16000 "Bolek, kim jest Darek Wylon?"`.
- **Self-check:** the bug icon toggles a debug panel with per-utterance engine output and a ✓/✗ against the scenario's expected card. `tests/relevance.test.ts` runs the offline matcher over every scripted line.

Run `npm run dev` and, in a second terminal, `npm run stt:proxy`. Copy `.env.example` to `.env` and set `XAI_API_KEY` for the microphone, and either `TYPESAFE_API_KEY` (direct, api.typesafe.ai) or `OPENROUTER_API_KEY` (OpenRouter's `/api/alpha/decisions` endpoint, model `typesafe/jev-1.13`; an `sk-or-` key in `TYPESAFE_API_KEY` is detected too). `npm run jev:eval` replays every scripted line through the live model and prints the routing decision, confidence, latency and a pass/fail against the scenario's expected card. Last run: 30/30 lines correct across the three scenarios, median 337 ms via OpenRouter.
