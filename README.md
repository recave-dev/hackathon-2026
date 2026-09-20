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

`/meeting` is a single screen meant to sit on the meeting-room display. The assistant is called **Bolek**, never speaks, and confirms every action with a short chime (`src/lib/chime.ts`, synthesised in WebAudio: a rising fourth when something lands, one soft note when the screen is cleared or the room leaves, a falling pair on failure). It has two listening modes (toggle in the header):

- **Na imię „Bolek”** (default): the room talks freely; Bolek reacts only when addressed. Either inline, „Bolek, ile płacimy za Pipedrive?”, or a bare „Bolek.” which arms it for the next sentence. Wake-word matching is local (`src/lib/wake-word.ts`, tolerant of recogniser misspellings), as are „Bolek, dzięki” (hide) and „kończymy spotkanie” / „wyjdź do menu” (back to the dashboard, with or without the name).
- **Zawsze**: every utterance is judged; a card appears when someone asks about a cost, an owner, a deadline or a result of a known entity.

### Cards straight from the company graph

Nothing on the screen is hand-written demo data. Every addressed request goes through one [TypeSafe Jev](https://docs.typesafe.ai/) call (`src/server/relevance.ts`, ~350 ms via OpenRouter) that answers, against the same state: `needs_info`, `asks_person`, `person` (a choice over the **person nodes of the graph**), `topic` (a choice over the graph's **products, organizations, decisions and metrics**, with hints built from their attributes), `facet` (cost, owner, deadline, status, history, options) and `intent`. The lists Jev chooses from are the graph catalog in `src/server/graph-cards.ts`, cached per database; when Jev picks the spend metric or the purchase decision of a product the room actually named, the router redirects to the product.

For a resolved person or topic the card is then built **deterministically** by `buildTopicCard` / `buildPersonCard` in a few milliseconds: the entity's neighbourhood (decisions and actions about it, the claims that informed them, the options they considered, the people assigned, the observations measuring its metrics), summed spend by month from observation nodes, the approver / owner / requester from edges and attributes, dated events for the timeline, open items, and quoted evidence with paths. The facet picks the headline and the one-sentence answer: „Łącznie 1 224 EUR za 6 faktur od czerwca 2025 do listopada 2025, ostatnio 272 EUR miesięcznie, limit 300 EUR.” No language model touches the card, so there is nothing to hallucinate and nothing to wait for. `tests/graph-cards.test.ts` pins the numbers.

### Intents

| Intent | Where it goes |
| --- | --- |
| `person`, `ask_company` with a resolved entity | graph card, no model |
| `ui_close`, `ui_background`, `ui_open`, `ui_present`, `ui_send` | handled on the screen (tray, presentations, sending a confirmed draft) |
| `ask_meeting` („zrób punkty”, „co ustaliliśmy”) | `quickNotes`: one Haiku call over the transcript, shown as a note card |
| `ask_web` („jaki jest kurs euro?”) | `quickWeb`: one web-searching call, shown with its sources |
| `produce` (email, document, chart, report, screenshot), `ask_company` without an entity, `ask` | **Bolek the agent** |

`npm run intent:eval` checks Jev's triage and entity resolution against the live model (last run 24/24), `npm run jev:eval` replays every scripted line (last run 51/51, p50 354 ms). Without a key the same module uses an offline keyword matcher over the graph catalog (`tests/relevance.test.ts` runs it over every scripted line).

### Bolek the agent

Requests that produce something, and company questions Jev could not pin to an entity, go to **Bolek the agent** (`src/server/agent.ts`): a tool-use loop over Claude Sonnet 5 via OpenRouter (`AGENT_MODEL`). The agent reads the **meeting session** (`src/server/session.ts`: every transcript line, one JSON file per meeting under `.data/sessions/`, plus a rolling context digest refreshed by Haiku every few lines, `src/server/context.ts`) and decides which tools to call:

| Tool | What it does |
| --- | --- |
| `find_contact` | a colleague's email by name in any Polish case; the team directory (`src/server/directory.ts`) is seeded into the graph as person entities with an `email` attribute |
| `company_knowledge`, `list_entities`, `get_entity` | search the SQLite company graph (entity label/alias match + full-text passages + precomputed spend totals), list a kind, walk one entity's relations and evidence |
| `search_web` | OpenRouter's `:online` search, summary with page sources |
| `page_screenshot` | headless Chrome (puppeteer-core, the installed Google Chrome) opens a URL and the PNG is written to `public/shots/` and shown from `/shots/<file>`; with no `LANDING_URL` Bolek asks for the address |
| `draft_email` | prepares a mail from Bolek's mailbox (`SMTP_*`); the room confirms with „Bolek, wyślij" or the button, then `sendDraft` sends it over SMTP and a confirmation card (recipient, subject, time, collapsible body) takes the screen |
| `create_document` | Markdown document kept in the session, rendered on screen |
| `meeting_notes` | bullets, decisions, action items, open questions from the transcript |
| `chart` | bar or line chart (Recharts) from numbers the agent already has |
| `write_report` | background task; the report lands in the tray when done |

The agent runs as a job (`askAgent` returns a job id, `pollAgent` streams its current activity and finished steps to the loading card every 700 ms). Results carry attachments (screenshot, chart, document, email draft, note, task, citations) that the agent card renders, and a collapsible list of the tool calls with timings. The screen is a **stack of pages** (`FitToScreen` shrinks a long answer to the viewport): a new card or result lands at the bottom, earlier ones move up; „Bolek, przesuń w górę / w dół" or the arrow keys scroll by whole pages. Background work that finished while something else was on screen shows up as a "Gotowe" pill in the corner; click it or say „Bolek, otwórz raport". Adding a tool is one entry in `TOOLS` in `src/server/tools.ts`: schema, description, handler. `npm run agent:eval` drives the agent from the terminal.

- **Input:** scripted meetings (`src/demo/knowledge.ts`, `SCENARIOS`; the first one, „Zarząd — narzędzia i pilot”, walks through Pipedrive cost, approver, LeadBooster, the e-Doręczenia pilot and its options, all from the graph) with autoplay or step-by-step (`Space`), the microphone, or a text box for typing what was said. Scenario expectations name graph entity ids, so the debug rail's ✓/✗ and the tests check the same thing.
- **Speech to text:** the microphone streams 16 kHz PCM16 from an AudioWorklet to a local WebSocket proxy (`npm run stt:proxy`, `scripts/stt-proxy.ts`), which forwards it to xAI Grok Voice Transcribe 2.0 (`wss://api.x.ai/v1/stt`, Polish, interim results, Smart Turn end-of-turn detection, the wake word boosted via `keyterm`). The proxy keeps `XAI_API_KEY` off the browser. Utterances arrive on `speech_final` and go straight into the wake-word matcher and Jev. If the proxy is down the button falls back to the browser's Web Speech API. `npm run stt:smoke <file.wav>` streams a WAV through the proxy and prints Grok's events; on macOS make one with `say -v Zosia -o bolek.wav --data-format=LEI16@16000 "Bolek, kim jest Karol Bąk?"`.
- **Self-check:** the bug icon (or `d`) toggles a debug panel with per-utterance engine output and a ✓/✗ against the scenario's expected entity.

Run `npm run dev` and, in a second terminal, `npm run stt:proxy`. Copy `.env.example` to `.env` and set `XAI_API_KEY` for the microphone, and either `TYPESAFE_API_KEY` (direct, api.typesafe.ai) or `OPENROUTER_API_KEY` (OpenRouter's `/api/alpha/decisions` endpoint, model `typesafe/jev-1.13`; an `sk-or-` key in `TYPESAFE_API_KEY` is detected too). `npm run jev:eval` replays every scripted line through the live model and prints the routing decision, confidence, latency and a pass/fail against the scenario's expected card. Last run: 30/30 lines correct across the three scenarios, median 337 ms via OpenRouter.
